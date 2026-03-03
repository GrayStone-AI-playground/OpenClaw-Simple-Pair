import crypto from "node:crypto";
import { PairSession } from "./types.js";

export class PairStore {
  private sessions = new Map<string, PairSession>();
  private byCode = new Map<string, string>();

  create(ttlSeconds: number, createdBy: PairSession["createdBy"]) {
    this.expireOld();
    const sessionId = `sp_${crypto.randomBytes(8).toString("hex")}`;
    const shortCode = this.genCode();
    const now = Date.now();
    const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
    const session: PairSession = {
      sessionId,
      shortCode,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      state: "issued",
      createdBy
    };
    this.sessions.set(sessionId, session);
    this.byCode.set(shortCode, sessionId);
    return session;
  }

  get(sessionId: string) {
    this.expireOld();
    return this.sessions.get(sessionId);
  }

  findByCode(code: string) {
    this.expireOld();
    const normalized = code.trim().toUpperCase();
    const sid = this.byCode.get(normalized);
    return sid ? this.sessions.get(sid) : undefined;
  }

  active() {
    this.expireOld();
    return [...this.sessions.values()].find((s) => s.state !== "approved" && s.state !== "expired");
  }

  setClaimed(sessionId: string, meta: NonNullable<PairSession["claimMeta"]>) {
    const s = this.get(sessionId);
    if (!s) return undefined;
    if (s.state !== "issued") return s;
    s.state = "pending_approval";
    s.claimMeta = meta;
    s.requestId = crypto.randomUUID();
    return s;
  }

  approve(requestId: string) {
    this.expireOld();
    const s = [...this.sessions.values()].find((x) => x.requestId === requestId);
    if (!s) return undefined;
    if (s.state === "approved") return s;
    if (s.state !== "pending_approval") return undefined;
    s.state = "approved";
    return s;
  }

  latestPending() {
    this.expireOld();
    const pending = [...this.sessions.values()].filter((s) => s.state === "pending_approval" && s.requestId);
    pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return pending[0];
  }

  expireOld() {
    const now = Date.now();
    for (const s of this.sessions.values()) {
      if (s.state !== "approved" && new Date(s.expiresAt).getTime() <= now) {
        s.state = "expired";
      }
    }
  }

  private genCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return `${out.slice(0, 4)}-${out.slice(4)}`;
  }
}
