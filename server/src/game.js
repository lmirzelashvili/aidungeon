// Authoritative game session: one lobby + one run. Holds all run state server-side
// (spec §9). The judge only scores a rubric; ALL outcome math (damage, backfire,
// integrity, win/lose) is deterministic and lives here (spec §5.3).

import { STARTER_TOOLS, ROOMS, ROOM_COUNT } from "./content.js";
import { adjudicate, judgeMode } from "./judge.js";

const BASE_DAMAGE = 40;
const BACKFIRE_THRESHOLD = 3; // plausibility below this → guaranteed backfire (§5.3)
const MAX_PLAYERS = 3;

const clone = (o) => JSON.parse(JSON.stringify(o));

export class GameSession {
  constructor(code, mode) {
    this.code = code;
    this.mode = mode; // 'solo' | 'coop'
    this.players = []; // {id,name,health,action,submitted,connected}
    this.hostId = null;
    this.phase = "lobby"; // lobby|planning|adjudicating|verdict|won|lost
    this.inventory = clone(STARTER_TOOLS);
    this.roomIndex = 0;
    this.round = 1;
    this.obstacle = null;
    this.turnOrder = [];
    this.turnIndex = 0;
    this.lastVerdict = null;
    this.history = [];
    this.onChange = () => {};
  }

  addPlayer(id, name) {
    if (this.phase !== "lobby") throw new Error("Run already in progress.");
    if (this.players.length >= MAX_PLAYERS) throw new Error("Lobby is full (max 3).");
    const player = { id, name: name?.trim() || `Player ${this.players.length + 1}`, health: 100, action: null, submitted: false, connected: true };
    this.players.push(player);
    if (!this.hostId) this.hostId = id;
    return player;
  }

  setConnected(id, connected) {
    const p = this.players.find((x) => x.id === id);
    if (p) p.connected = connected;
  }

  isEmpty() {
    return this.players.every((p) => !p.connected);
  }

  startRun(byId) {
    if (byId !== this.hostId) throw new Error("Only the host can start the run.");
    if (this.phase !== "lobby") throw new Error("Run already started.");
    this.loadRoom(0);
  }

  loadRoom(index) {
    const room = ROOMS[index];
    const obstacle = clone(room.obstacle);
    obstacle.integrityMax = obstacle.integrity;
    obstacle.revealed_properties = [];
    this.obstacle = obstacle;
    this.roomIndex = index;
    this.round = 1;
    this.beginPlanning();
  }

  beginPlanning() {
    this.phase = "planning";
    this.turnOrder = this.players.map((p) => p.id);
    this.turnIndex = 0;
    for (const p of this.players) {
      p.action = null;
      p.submitted = false;
    }
  }

  currentTurnPlayerId() {
    return this.turnOrder[this.turnIndex] || null;
  }

  async submitAction(playerId, text) {
    if (this.phase !== "planning") throw new Error("Not accepting actions right now.");
    if (this.currentTurnPlayerId() !== playerId) throw new Error("It's not your turn.");
    const trimmed = (text || "").trim();
    if (!trimmed) throw new Error("Write an action first.");
    const p = this.players.find((x) => x.id === playerId);
    p.action = trimmed.slice(0, 600);
    p.submitted = true;
    this.turnIndex += 1;

    if (this.turnIndex >= this.turnOrder.length) {
      await this.runAdjudication();
    } else {
      this.onChange();
    }
  }

  async runAdjudication() {
    this.phase = "adjudicating";
    this.onChange();

    const input = {
      obstacle: this.obstacle,
      inventory: this.inventory,
      players: this.players.map((p) => ({ id: p.id, name: p.name, health: p.health, action: p.action })),
      round: this.round,
    };

    const verdict = await adjudicate(input);
    const resolved = this.resolve(verdict);
    this.lastVerdict = resolved;
    this.history.push(resolved);
    this.phase = "verdict";
    this.onChange();
  }

  // Deterministic resolution per §5.3. Returns the verdict augmented with the
  // server-computed fields the client renders.
  resolve(verdict) {
    const { effectiveness, synergy, plausibility } = verdict.scores;
    const synergyMultiplier = 1 + 0.5 * (synergy / 10);
    const weaknessBonus = verdict.exploited_property ? 1.8 : 1.0;
    const finalDamage = Math.round(BASE_DAMAGE * (effectiveness / 10) * synergyMultiplier * weaknessBonus);

    const appliedEffects = [];

    // Reveal an exploited hidden property to the players (glass-box).
    if (verdict.exploited_property && !this.obstacle.revealed_properties.includes(verdict.exploited_property)) {
      this.obstacle.revealed_properties.push(verdict.exploited_property);
      appliedEffects.push({ type: "weakness_revealed", value: verdict.exploited_property });
    }

    // Backfire: deterministic trigger (§5.3) — below plausibility threshold OR AI flagged it.
    const belowThreshold = plausibility < BACKFIRE_THRESHOLD;
    const backfireTriggered = belowThreshold || verdict.backfire.triggered;
    let backfire = { ...verdict.backfire, triggered: backfireTriggered };
    if (backfireTriggered) {
      // Scale severity to how far below threshold (or use AI's, whichever is harsher).
      const computed = belowThreshold ? Math.round(((BACKFIRE_THRESHOLD - plausibility) / BACKFIRE_THRESHOLD) * 10) : 0;
      backfire.severity = Math.max(verdict.backfire.severity || 0, computed, 1);
      this.applyBackfire(backfire, appliedEffects);
    }

    // Apply damage to the obstacle (reduced heavily if it was a hubris fail).
    const damage = verdict.outcome === "fail" ? Math.round(finalDamage * 0.25) : finalDamage;
    this.obstacle.integrity = Math.max(0, this.obstacle.integrity - damage);
    appliedEffects.push({ type: "obstacle_damage", value: damage });

    const broken = this.obstacle.integrity <= 0;

    // If it survives, it may counterattack (pressure/drama, §4.2).
    let counter = null;
    if (!broken && this.obstacle.counterattack && Math.random() < this.obstacle.counterattack.chance) {
      const dmg = this.obstacle.counterattack.damage;
      for (const p of this.players) if (p.health > 0) p.health = Math.max(0, p.health - dmg);
      counter = { damage: dmg, narration: this.obstacle.counterattack.narration };
      appliedEffects.push({ type: "counterattack", value: dmg });
    }

    return {
      ...verdict,
      final_damage: damage,
      applied_effects: appliedEffects,
      backfire,
      counter,
      obstacle_broken: broken,
      room_index: this.roomIndex,
      round: this.round,
    };
  }

  applyBackfire(backfire, appliedEffects) {
    const sev = backfire.severity;
    const effect = (backfire.effect || "").toLowerCase();
    const target = backfire.target;

    // Tool damage/destruction.
    const tool = this.inventory.find((t) => t.id === target || effect.includes(t.id));
    if (tool && /destroy|break|shatter|snap|melt|consum|lost/.test(effect)) {
      this.inventory = this.inventory.filter((t) => t.id !== tool.id);
      appliedEffects.push({ type: "tool_lost", value: tool.name });
      return;
    }

    // Obstacle hardening.
    if (/reinforce|harden|wall|seal|strengthen/.test(effect) || target === this.obstacle.id) {
      const gain = sev * 4;
      this.obstacle.integrity += gain;
      this.obstacle.integrityMax = Math.max(this.obstacle.integrityMax, this.obstacle.integrity);
      appliedEffects.push({ type: "obstacle_reinforced", value: gain });
      return;
    }

    // Default: a player gets hurt / put in a bad state.
    const victim = this.players.find((p) => p.id === target) || this.players[Math.floor(Math.random() * this.players.length)];
    const dmg = sev * 6;
    victim.health = Math.max(0, victim.health - dmg);
    appliedEffects.push({ type: "player_hurt", value: dmg, playerId: victim.id, playerName: victim.name });
  }

  continueAfterVerdict(byId) {
    if (this.phase !== "verdict") throw new Error("Nothing to continue.");
    if (byId !== this.hostId) throw new Error("Only the host can continue.");

    // Party wipe check.
    if (this.players.every((p) => p.health <= 0)) {
      this.phase = "lost";
      this.onChange();
      return;
    }

    if (this.lastVerdict.obstacle_broken) {
      const room = ROOMS[this.roomIndex];
      if (room.loot) this.inventory.push(clone(room.loot));
      if (this.roomIndex + 1 >= ROOM_COUNT) {
        this.phase = "won";
        this.onChange();
        return;
      }
      this.loadRoom(this.roomIndex + 1);
    } else {
      this.round += 1;
      this.beginPlanning();
    }
    this.onChange();
  }

  newRun(byId) {
    if (byId !== this.hostId) throw new Error("Only the host can start a new run.");
    this.inventory = clone(STARTER_TOOLS);
    this.lastVerdict = null;
    this.history = [];
    for (const p of this.players) p.health = 100;
    this.loadRoom(0);
    this.onChange();
  }

  // Sanitized snapshot for clients. Hidden properties are stripped — only revealed
  // ones are shown (glass-box reveals, not cheating).
  publicState() {
    return {
      code: this.code,
      mode: this.mode,
      phase: this.phase,
      hostId: this.hostId,
      judgeMode: judgeMode(),
      roomIndex: this.roomIndex,
      roomCount: ROOM_COUNT,
      round: this.round,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        health: p.health,
        connected: p.connected,
        submitted: p.submitted,
        action: p.submitted ? p.action : null, // reveal submitted actions so teammates can build on them
      })),
      currentTurnPlayerId: this.phase === "planning" ? this.currentTurnPlayerId() : null,
      inventory: clone(this.inventory),
      obstacle: this.obstacle
        ? {
            id: this.obstacle.id,
            name: this.obstacle.name,
            visible_description: this.obstacle.visible_description,
            integrity: this.obstacle.integrity,
            integrityMax: this.obstacle.integrityMax,
            revealed_properties: this.obstacle.revealed_properties,
          }
        : null,
      verdict: this.lastVerdict,
    };
  }
}
