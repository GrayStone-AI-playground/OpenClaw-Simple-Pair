import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PairStore } from "./store.js";
import { requireApprove, requireStart } from "./auth.js";
import { AuditLog } from "./audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const store = new PairStore();
export const audit = new AuditLog();

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/audit/events", requireApprove, (req, res) => {
    res.json({ events: audit.list(Number(req.query.limit || 100)) });
  });

  app.post("/simple_pair", requireStart, (req, res) => {
    const ttlSeconds = Number(req.body?.ttlSeconds || 300);
    const s = store.create(ttlSeconds, { type: "dashboard", id: "owner" });
    audit.record({ type: "simple_pair_started", actor: "dashboard:owner", sessionId: s.sessionId, ip: req.ip, ua: req.header("user-agent") });
    res.json({
      ok: true,
      sessionId: s.sessionId,
      expiresAt: s.expiresAt,
      shortCode: s.shortCode,
      pairUrl: "/pair",
      prefillUrl: `/pair/${s.shortCode}`,
      qrPayload: `/pair/${s.shortCode}`
    });
  });

  app.get("/pair/status", (_req, res) => {
    const active = store.active();
    if (!active) return res.json({ active: false });
    return res.json({ active: true, expiresAt: active.expiresAt });
  });

  app.post("/pair/resolve", (req, res) => {
    const code = String(req.body?.code || "");
    const s = store.findByCode(code);
    if (!s || s.state === "expired") return res.status(404).json({ error: { code: "not_found", message: "invalid code" } });
    audit.record({ type: "pair_code_resolved", sessionId: s.sessionId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, sessionId: s.sessionId, expiresAt: s.expiresAt, requiresConfirm: true });
  });

  app.post("/pair/claim", (req, res) => {
    const sessionId = String(req.body?.sessionId || "");
    const deviceName = String(req.body?.deviceName || "");
    const clientKind = String(req.body?.client?.kind || "web");
    const s = store.get(sessionId);
    if (!s || s.state === "expired") return res.status(410).json({ error: { code: "expired", message: "session expired" } });
    if (s.state !== "issued") return res.status(409).json({ error: { code: "conflict", message: "already claimed" } });
    const claimed = store.setClaimed(sessionId, {
      ip: req.ip,
      ua: req.header("user-agent"),
      clientKind,
      deviceName
    });
    audit.record({ type: "pair_claimed", sessionId, requestId: claimed?.requestId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, pending: true, requestId: claimed?.requestId, approval: { method: "telegram_or_web", instruction: "Owner approve required" } });
  });

  app.get("/pair/claim-status", (req, res) => {
    const sessionId = String(req.query.sessionId || "");
    const s = store.get(sessionId);
    if (!s) return res.status(404).json({ error: { code: "not_found", message: "session not found" } });
    res.json({ status: s.state, requestId: s.requestId });
  });

  app.post("/pair/approve", requireApprove, (req, res) => {
    const requestId = String(req.body?.requestId || "");
    const s = store.approve(requestId);
    if (!s) return res.status(404).json({ error: { code: "not_found", message: "request not found or invalid state" } });
    audit.record({ type: "pair_approved", actor: "dashboard:owner", sessionId: s.sessionId, requestId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, approved: true, requestId });
  });

  app.post("/telegram/simple_pair", (req, res) => {
    const owner = String(req.header("x-telegram-owner") || "false") === "true";
    if (!owner) return res.status(403).json({ error: { code: "forbidden", message: "owner only" } });
    const s = store.create(300, { type: "telegram", id: "owner" });
    audit.record({ type: "simple_pair_started", actor: "telegram:owner", sessionId: s.sessionId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, message: `Simple Pair started. Code: ${s.shortCode}. URL: /pair/${s.shortCode}. Expires: ${s.expiresAt}` });
  });

  app.get("/pair", (_req, res) => {
    const active = store.active();
    if (!active) return res.status(404).send("Pairing is not active");
    res.sendFile(path.join(__dirname, "../public/pair.html"));
  });

  app.get("/pair/:code", (req, res) => {
    const active = store.active();
    if (!active) return res.status(404).send("Pairing is not active");
    res.sendFile(path.join(__dirname, "../public/pair.html"));
  });

  return app;
}
