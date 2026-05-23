import { useSyncExternalStore, useCallback } from "react";

// In dev, Vite serves the client on :5173 while the server is on :8787, so we
// target that port explicitly. In single-process/deployed mode the client is
// served by the game server itself, so we use the same origin (and wss on https).
function defaultWsUrl() {
  if (location.port === "5173") return `ws://${location.hostname}:8787`;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}`;
}
const WS_URL = import.meta.env.VITE_WS_URL || defaultWsUrl();

// Singleton connection manager so a single socket survives React StrictMode
// double-mounts and component re-renders.
class Net {
  constructor() {
    this.ws = null;
    this.status = "idle"; // idle | connecting | open | closed
    this.playerId = null;
    this.code = null;
    this.game = null; // latest server state snapshot
    this.error = null;
    this.queue = [];
    this.listeners = new Set();
    this.snapshot = this.computeSnapshot();
  }

  computeSnapshot() {
    return {
      status: this.status,
      playerId: this.playerId,
      code: this.code,
      game: this.game,
      error: this.error,
    };
  }

  emit() {
    this.snapshot = this.computeSnapshot();
    for (const l of this.listeners) l();
  }

  subscribe(cb) {
    this.listeners.add(cb);
    this.ensureConnected();
    return () => this.listeners.delete(cb);
  }

  getSnapshot() {
    return this.snapshot;
  }

  ensureConnected() {
    if (this.ws && (this.status === "open" || this.status === "connecting")) return;
    this.status = "connecting";
    this.emit();
    const ws = new WebSocket(WS_URL);
    this.ws = ws;
    ws.onopen = () => {
      this.status = "open";
      while (this.queue.length) ws.send(JSON.stringify(this.queue.shift()));
      this.emit();
    };
    ws.onclose = () => {
      this.status = "closed";
      this.emit();
    };
    ws.onerror = () => {
      this.error = "Connection error. Is the server running on :8787?";
      this.emit();
    };
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.handle(msg);
    };
  }

  handle(msg) {
    switch (msg.type) {
      case "joined":
        this.playerId = msg.playerId;
        this.code = msg.code;
        this.error = null;
        break;
      case "state":
        this.game = msg.state;
        break;
      case "error":
        this.error = msg.message;
        break;
    }
    this.emit();
  }

  send(msg) {
    if (this.status === "open" && this.ws) this.ws.send(JSON.stringify(msg));
    else {
      this.queue.push(msg);
      this.ensureConnected();
    }
  }

  clearError() {
    this.error = null;
    this.emit();
  }
}

const net = new Net();

export function useGame() {
  const snap = useSyncExternalStore(
    (cb) => net.subscribe(cb),
    () => net.getSnapshot()
  );

  const createSession = useCallback((mode, name) => net.send({ type: "create", mode, name }), []);
  const joinSession = useCallback((code, name) => net.send({ type: "join", code, name }), []);
  const start = useCallback(() => net.send({ type: "start" }), []);
  const submit = useCallback((text) => net.send({ type: "submit", text }), []);
  const cont = useCallback(() => net.send({ type: "continue" }), []);
  const newRun = useCallback(() => net.send({ type: "new_run" }), []);
  const clearError = useCallback(() => net.clearError(), []);

  return { ...snap, createSession, joinSession, start, submit, cont, newRun, clearError };
}
