// In-memory session registry + join-code generation.

import { GameSession } from "./game.js";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars

export class Lobby {
  constructor() {
    this.sessions = new Map(); // code -> GameSession
  }

  generateCode() {
    let code;
    do {
      code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    } while (this.sessions.has(code));
    return code;
  }

  create(mode) {
    const code = this.generateCode();
    const session = new GameSession(code, mode);
    this.sessions.set(code, session);
    return session;
  }

  get(code) {
    return this.sessions.get((code || "").toUpperCase());
  }

  remove(code) {
    this.sessions.delete(code);
  }
}
