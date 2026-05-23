# Prompt & Circumstance

> Talk your way out, or get talked into the ground.

A co-op prompt-the-dungeon roguelike. You and your friends crawl through a dungeon
armed with random, absurd objects and a text box. Each room is an obstacle; you beat
it by writing prompts that combine your junk creatively and build on each other. An AI
acts as the world *and* the judge — it decides whether your plan works, how much it
helps, and punishes overreach with consequences.

This repo is the **MVP prototype** (spec §10): prompt-primary, light/stubbed execution,
co-op + solo, and a designed 6-room first level ("The Drowned Keep").

## What's built

- **Authoritative WebSocket server** (Node + `ws`) holding all run state. Lockstep rounds:
  collect actions in **turn order** → one judge call → broadcast verdict (§9).
- **AI world-judge** (§5): scores a rubric (plausibility / synergy / effectiveness /
  creativity), flags the exploited weakness, and detects backfire — emitted as strict JSON.
  Uses **Claude** (`@anthropic-ai/sdk`, forced tool-use) when `ANTHROPIC_API_KEY` is set,
  and **auto-falls back to a deterministic mock judge** so it's fully playable offline.
- **Deterministic resolution in code** (§5.3): damage =
  `base · (effectiveness/10) · synergyMult · weaknessBonus`, backfire when
  `plausibility < 3` or the AI flags it, integrity / health / win-lose all server-side.
- **Glass-box spectacle verdict UI** (React + Tailwind): type-on narration, visible scores,
  integrity & health bars, backfire/counterattack moments. Responsive (desktop + mobile).
- **Solo** and **co-op (2–3 players via join code)** on the same client.

## Run it

Requires Node 18+ (built on Node 22).

```bash
npm run install:all   # install root, server, and client deps
npm run dev            # runs server (:8787) + client (:5173) together
```

Open http://localhost:5173.
- **Solo** starts a run immediately.
- **Host co-op** gives you a 4-letter code; friends open the same URL and **Join** with it.
  (For co-op the players need to reach the server — same machine/LAN, or expose :5173 and
  :8787. Override the socket URL with `VITE_WS_URL` if needed.)

## Play it from your phone (GitHub Codespaces)

GitHub Pages can't host this (it only serves static files; this app needs the
Node WebSocket server). **Codespaces** can, and works from the GitHub mobile site:

1. On github.com, open this repo → **Code** → **Codespaces** → create one on this branch.
   (`.devcontainer/` auto-installs deps.)
2. In the Codespaces terminal, run `npm run serve`.
3. Open the **Ports** tab, find port **8787**, set its visibility to **Public**,
   and open the forwarded URL — that link works in your phone browser, and you can
   share it with friends for co-op.

## Single-process serve (one port, for any host)

```bash
npm run serve   # builds the client, then the server serves it + the WebSocket on PORT (default 8787)
```

The server serves the built client from the same origin, so HTTP and the WebSocket
share one port — deployable to Render/Railway/Fly/Codespaces with no extra config.

### Enable the live AI judge

By default it runs the offline mock judge. To use Claude:

```bash
export ANTHROPIC_API_KEY=sk-...
npm run dev
```

Optionally set `JUDGE_MODEL` (defaults to `claude-haiku-4-5` for fast verdicts).

## How a round works

1. Each room shows the obstacle (with a hidden weakness), its integrity, and the shared
   inventory of absurd tools.
2. Players write actions **in turn order**, each able to see and build on teammates'
   submitted setups (synergy is the core skill).
3. After everyone's locked in, the judge rules once on the **combined** attempt.
4. The verdict is shown as a spectacle: narration + glass-box scores + damage + any backfire.
5. Break the obstacle to advance and grab loot; clear the final room to win, or wipe to lose.

## Layout

```
server/src/
  content.js   hardcoded rooms, obstacles (hidden props), tools  (§6)
  judge.js     live Claude judge + mock fallback                 (§5)
  game.js      authoritative session, deterministic resolution   (§5.3)
  lobby.js     session registry + join codes
  index.js     WebSocket server / message protocol               (§9)
client/src/
  net.js       singleton WebSocket client + useGame hook
  App.jsx      screen routing
  components/   Home, Lobby, Game, Verdict, ui
```

## Not in this MVP (spec §10/§11)

Real-time execution beat (stubbed out), PvP Arena, progression/unlockables, accounts,
procedural generation at scale, clip export.
