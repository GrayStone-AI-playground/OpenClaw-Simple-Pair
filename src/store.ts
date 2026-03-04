import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PairSession } from "./types.js";

type PairStoreSnapshot = {
  sessions: PairSession[];
  updatedAt: string;
};

export class PairStore {
  private sessions = new Map<string, PairSession>();
  private byCode = new Map<string, string>();
  private dirty = false;

  private readonly dbPath: string;
  private readonly retentionMs: number;

  constructor() {
    const configured = process.env.SIMPLE_PAIR_DB_PATH || "./data/pair-store.json";
    this.dbPath = path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
    const retentionDays = Number(process.env.SIMPLE_PAIR_RETENTION_DAYS || 14);
    this.retentionMs = Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;

    this.loadFromDisk();
    this.expireOld();
    this.pruneOld();
    this.flushIfDirty();
  }

  create(ttlSeconds: number, createdBy: PairSession["createdBy"]) {
    this.expireOld();
    this.pruneOld();

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
    this.markDirtyAndFlush();
    return session;
  }

  get(sessionId: string) {
    this.expireOld();
    this.flushIfDirty();
    return this.sessions.get(sessionId);
  }

  findByCode(code: string) {
    this.expireOld();
    this.flushIfDirty();
    const normalized = code.trim().toUpperCase();
    const sid = this.byCode.get(normalized);
    return sid ? this.sessions.get(sid) : undefined;
  }

  active() {
    this.expireOld();
    this.flushIfDirty();
    return [...this.sessions.values()].find((s) => s.state !== "approved" && s.state !== "expired");
  }

  setClaimed(sessionId: string, meta: NonNullable<PairSession["claimMeta"]>) {
    const s = this.get(sessionId);
    if (!s) return undefined;
    if (s.state !== "issued") return s;
    s.state = "pending_approval";
    s.claimMeta = meta;
    s.requestId = crypto.randomUUID();
    this.markDirtyAndFlush();
    return s;
  }

  approve(requestId: string) {
    this.expireOld();
    const s = [...this.sessions.values()].find((x) => x.requestId === requestId);
    if (!s) return undefined;
    if (s.state === "approved") return s;
    if (s.state !== "pending_approval") return undefined;
    s.state = "approved";
    this.markDirtyAndFlush();
    return s;
  }

  pendingList() {
    this.expireOld();
    this.flushIfDirty();
    const pending = [...this.sessions.values()].filter((s) => s.state === "pending_approval" && s.requestId);
    pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return pending;
  }

  latestPending() {
    return this.pendingList()[0];
  }

  expireOld() {
    const now = Date.now();
    for (const s of this.sessions.values()) {
      if (s.state !== "approved" && new Date(s.expiresAt).getTime() <= now && s.state !== "expired") {
        s.state = "expired";
        this.dirty = true;
      }
    }
  }

  private pruneOld() {
    const now = Date.now();
    for (const [sid, s] of this.sessions.entries()) {
      const createdAtMs = new Date(s.createdAt).getTime();
      if (Number.isFinite(createdAtMs) && now - createdAtMs > this.retentionMs) {
        this.sessions.delete(sid);
        this.byCode.delete(s.shortCode);
        this.dirty = true;
      }
    }
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(this.dbPath)) return;
      const raw = fs.readFileSync(this.dbPath, "utf8");
      const parsed = JSON.parse(raw) as PairStoreSnapshot;
      const list = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
      for (const s of list) {
        if (!s?.sessionId || !s?.shortCode) continue;
        this.sessions.set(s.sessionId, s);
        this.byCode.set(String(s.shortCode).toUpperCase(), s.sessionId);
      }
    } catch (err) {
      console.error("simple-pair: failed loading store from disk:", err);
    }
  }

  private flushIfDirty() {
    if (!this.dirty) return;
    this.flushToDisk();
  }

  private markDirtyAndFlush() {
    this.dirty = true;
    this.flushToDisk();
  }

  private flushToDisk() {
    try {
      const dir = path.dirname(this.dbPath);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const snapshot: PairStoreSnapshot = {
        sessions: [...this.sessions.values()],
        updatedAt: new Date().toISOString()
      };
      const tmp = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmp, this.dbPath);
      try {
        fs.chmodSync(this.dbPath, 0o600);
        fs.chmodSync(dir, 0o700);
      } catch {
        // best-effort hardening
      }
      this.dirty = false;
    } catch (err) {
      console.error("simple-pair: failed writing store to disk:", err);
    }
  }

  private genCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return `${out.slice(0, 4)}-${out.slice(4)}`;
  }
}
