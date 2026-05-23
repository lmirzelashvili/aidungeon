// WebSocket game server. Lockstep rounds: collect actions (turn order) → one judge
// call → broadcast verdict (spec §9). Authoritative state lives in GameSession.

import http from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import { WebSocketServer } from "ws";
import { Lobby } from "./lobby.js";
import { judgeMode } from "./judge.js";

const PORT = process.env.PORT || 8787;
const app = express();
app.get("/health", (_req, res) => res.json({ ok: true, judge: judgeMode() }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const lobby = new Lobby();

// Track which clients belong to which session for broadcasting.
const sessionClients = new Map(); // code -> Set<ws>

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(code) {
  const session = lobby.get(code);
  const clients = sessionClients.get(code);
  if (!session || !clients) return;
  const state = session.publicState();
  for (const ws of clients) send(ws, { type: "state", state });
}

function attach(ws, code) {
  if (!sessionClients.has(code)) sessionClients.set(code, new Set());
  sessionClients.get(code).add(ws);
  const session = lobby.get(code);
  if (session) session.onChange = () => broadcast(code);
}

wss.on("connection", (ws) => {
  ws.id = randomUUID();
  ws.playerId = null;
  ws.code = null;

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: "error", message: "Malformed message." });
    }

    try {
      await handle(ws, msg);
    } catch (err) {
      send(ws, { type: "error", message: err.message || "Something went wrong." });
    }
  });

  ws.on("close", () => {
    if (ws.code) {
      const session = lobby.get(ws.code);
      if (session && ws.playerId) {
        session.setConnected(ws.playerId, false);
        broadcast(ws.code);
      }
      const clients = sessionClients.get(ws.code);
      if (clients) {
        clients.delete(ws);
        // Reap fully-empty sessions after a short grace period.
        if (session && session.isEmpty()) {
          setTimeout(() => {
            const s = lobby.get(ws.code);
            if (s && s.isEmpty()) {
              lobby.remove(ws.code);
              sessionClients.delete(ws.code);
            }
          }, 60_000);
        }
      }
    }
  });
});

async function handle(ws, msg) {
  switch (msg.type) {
    case "create": {
      const mode = msg.mode === "solo" ? "solo" : "coop";
      const session = lobby.create(mode);
      const player = session.addPlayer(ws.id, msg.name);
      ws.playerId = player.id;
      ws.code = session.code;
      attach(ws, session.code);
      send(ws, { type: "joined", code: session.code, playerId: player.id });
      // Solo runs start immediately.
      if (mode === "solo") session.startRun(player.id);
      broadcast(session.code);
      break;
    }
    case "join": {
      const session = lobby.get(msg.code);
      if (!session) throw new Error("No lobby with that code.");
      const player = session.addPlayer(ws.id, msg.name);
      ws.playerId = player.id;
      ws.code = session.code;
      attach(ws, session.code);
      send(ws, { type: "joined", code: session.code, playerId: player.id });
      broadcast(session.code);
      break;
    }
    case "start": {
      requireSession(ws).startRun(ws.playerId);
      broadcast(ws.code);
      break;
    }
    case "submit": {
      await requireSession(ws).submitAction(ws.playerId, msg.text);
      // submitAction broadcasts via onChange when it advances/adjudicates.
      break;
    }
    case "continue": {
      requireSession(ws).continueAfterVerdict(ws.playerId);
      break;
    }
    case "new_run": {
      requireSession(ws).newRun(ws.playerId);
      break;
    }
    default:
      send(ws, { type: "error", message: `Unknown message type: ${msg.type}` });
  }
}

function requireSession(ws) {
  const session = lobby.get(ws.code);
  if (!session) throw new Error("You're not in a lobby.");
  return session;
}

server.listen(PORT, () => {
  console.log(`[server] listening on :${PORT} — judge mode: ${judgeMode()}`);
});
