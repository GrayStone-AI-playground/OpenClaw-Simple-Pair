import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PairStore } from "./store.js";
import { requireApprove, requireStart } from "./auth.js";
import { AuditLog } from "./audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function error(res: express.Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

function nowMs() {
  return Date.now();
}

function createWindowRateLimiter(limit: number, windowMs: number) {
  const state = new Map<string, number[]>();
  return (key: string) => {
    const now = nowMs();
    const attempts = (state.get(key) || []).filter((t) => now - t < windowMs);
    if (attempts.length >= limit) {
      state.set(key, attempts);
      return false;
    }
    attempts.push(now);
    state.set(key, attempts);
    return true;
  };
}

const allowResolve = createWindowRateLimiter(12, 60_000);
const allowClaim = createWindowRateLimiter(10, 60_000);

type Handoff = { id: string; sessionId: string; expiresAt: number; used: boolean };
type ProxySession = { id: string; sessionId: string; user: string; expiresAt: number };
const handoffs = new Map<string, Handoff>();
const proxySessions = new Map<string, ProxySession>();

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const parts = header.split(';').map((x) => x.trim());
  const found = parts.find((p) => p.startsWith(name + '='));
  if (!found) return null;
  return decodeURIComponent(found.slice(name.length + 1));
}

export function createApp() {
  const app = express();
  const store = new PairStore();
  const audit = new AuditLog();
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/audit/events", requireApprove, (req, res) => {
    res.json({ events: audit.list(Number(req.query.limit || 100)) });
  });

  app.post("/simple_pair", requireStart, (req, res) => {
    const existing = store.active();
    if (existing && existing.state === "issued") {
      return res.json({
        ok: true,
        reused: true,
        sessionId: existing.sessionId,
        expiresAt: existing.expiresAt,
        shortCode: existing.shortCode,
        pairUrl: "/pair",
        prefillUrl: `/pair/${existing.shortCode}`,
        qrPayload: `/pair/${existing.shortCode}`
      });
    }

    const ttlSeconds = Number(req.body?.ttlSeconds || 300);
    const s = store.create(ttlSeconds, { type: "dashboard", id: "owner" });
    audit.record({ type: "simple_pair_started", actor: "dashboard:owner", sessionId: s.sessionId, ip: req.ip, ua: req.header("user-agent") });
    res.json({
      ok: true,
      reused: false,
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
    if (!allowResolve(req.ip || "unknown")) {
      return error(res, 429, "rate_limited", "too many resolve attempts");
    }

    const code = String(req.body?.code || "");
    const s = store.findByCode(code);
    if (!s) return error(res, 404, "not_found", "invalid code");
    if (s.state === "expired") return error(res, 410, "expired", "session expired");

    audit.record({ type: "pair_code_resolved", sessionId: s.sessionId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, sessionId: s.sessionId, expiresAt: s.expiresAt, requiresConfirm: true });
  });

  app.post("/pair/claim", (req, res) => {
    if (!allowClaim(req.ip || "unknown")) {
      return error(res, 429, "rate_limited", "too many claim attempts");
    }

    const sessionId = String(req.body?.sessionId || "");
    const deviceName = String(req.body?.deviceName || "");
    const clientKind = String(req.body?.client?.kind || "web");
    const s = store.get(sessionId);

    if (!s) return error(res, 404, "not_found", "session not found");
    if (s.state === "expired") return error(res, 410, "expired", "session expired");
    if (s.state !== "issued") return error(res, 409, "conflict", "already claimed");

    const claimed = store.setClaimed(sessionId, {
      ip: req.ip,
      ua: req.header("user-agent"),
      clientKind,
      deviceName
    });

    audit.record({ type: "pair_claimed", sessionId, requestId: claimed?.requestId, ip: req.ip, ua: req.header("user-agent") });
    res.json({
      ok: true,
      pending: true,
      requestId: claimed?.requestId,
      approval: {
        method: "simple_pair_backend",
        instruction: "Owner approval required",
        nextCommand: "/simple_pair_approve",
        webEndpoint: "POST /pair/approve or POST /pair/approve-latest"
      }
    });
  });

  app.get("/pair/claim-status", (req, res) => {
    const sessionId = String(req.query.sessionId || "");
    const s = store.get(sessionId);
    if (!s) return error(res, 404, "not_found", "session not found");
    res.json({ status: s.state, requestId: s.requestId });
  });

  app.post('/pair/handoff/create', (req, res) => {
    const sessionId = String(req.body?.sessionId || '');
    const s = store.get(sessionId);
    if (!s) return error(res, 404, 'not_found', 'session not found');
    if (s.state !== 'approved') return error(res, 409, 'not_ready', 'pairing not approved yet');

    const id = crypto.randomBytes(12).toString('base64url');
    const expiresAt = Date.now() + 60_000;
    handoffs.set(id, { id, sessionId, expiresAt, used: false });
    res.json({ ok: true, handoffId: id, handoffUrl: `/pair/handoff/${id}`, expiresAt: new Date(expiresAt).toISOString() });
  });

  app.post('/pair/handoff/redeem', (req, res) => {
    const handoffId = String(req.body?.handoffId || '');
    const h = handoffs.get(handoffId);
    if (!h) return error(res, 404, 'not_found', 'handoff not found');
    if (h.used) return error(res, 409, 'used', 'handoff already used');
    if (h.expiresAt < Date.now()) return error(res, 410, 'expired', 'handoff expired');

    h.used = true;
    const sid = crypto.randomBytes(18).toString('base64url');
    const expiresAt = Date.now() + 10 * 60_000;
    proxySessions.set(sid, { id: sid, sessionId: h.sessionId, user: 'paired-user', expiresAt });

    res.setHeader('Set-Cookie', `sp_handoff_session=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    const dashboardUrl = `${req.protocol}://${req.get('host') || 'localhost'}/`;
    res.json({
      ok: true,
      dashboardUrl,
      note: 'One-time handoff redeemed. Proxy session cookie issued. (Gateway trusted-proxy mode required for full passwordless dashboard login.)',
      proxyReady: true
    });
  });

  app.get('/auth/session/validate', (req, res) => {
    const sid = parseCookie(req.header('cookie'), 'sp_handoff_session');
    if (!sid) return error(res, 401, 'unauthorized', 'missing session cookie');

    const ps = proxySessions.get(sid);
    if (!ps) return error(res, 401, 'unauthorized', 'invalid session');
    if (ps.expiresAt < Date.now()) {
      proxySessions.delete(sid);
      return error(res, 401, 'expired', 'session expired');
    }

    res.setHeader('x-forwarded-user', ps.user);
    res.json({ ok: true, user: ps.user, sessionId: ps.sessionId, expiresAt: new Date(ps.expiresAt).toISOString() });
  });

  app.get("/pair/pending", requireApprove, (_req, res) => {
    const pending = store.pendingList().map((p) => ({
      requestId: p.requestId,
      sessionId: p.sessionId,
      createdAt: p.createdAt,
      deviceName: p.claimMeta?.deviceName,
      clientKind: p.claimMeta?.clientKind
    }));
    res.json({ pending });
  });

  app.post("/pair/approve", requireApprove, (req, res) => {
    const requestId = String(req.body?.requestId || "");
    const s = store.approve(requestId);
    if (!s) return error(res, 404, "not_found", "request not found or invalid state");
    audit.record({ type: "pair_approved", actor: "dashboard:owner", sessionId: s.sessionId, requestId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, approved: true, requestId });
  });

  app.post("/pair/approve-latest", requireApprove, (req, res) => {
    const pending = store.pendingList();
    if (pending.length === 0) return error(res, 404, "not_found", "no pending approval request");
    if (pending.length > 1) {
      return res.status(409).json({
        error: { code: "multiple_pending", message: "multiple pending approval requests; specify requestId" },
        pending: pending.map((p) => ({ requestId: p.requestId, sessionId: p.sessionId, createdAt: p.createdAt, deviceName: p.claimMeta?.deviceName }))
      });
    }
    const latest = pending[0];
    if (!latest?.requestId) return error(res, 404, "not_found", "no pending approval request");
    const s = store.approve(latest.requestId);
    if (!s) return error(res, 404, "not_found", "request not found or invalid state");
    audit.record({ type: "pair_approved", actor: "dashboard:owner", sessionId: s.sessionId, requestId: latest.requestId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, approved: true, requestId: latest.requestId, via: "latest" });
  });

  app.post("/telegram/simple_pair", (req, res) => {
    const owner = String(req.header("x-telegram-owner") || "false") === "true";
    if (!owner) return error(res, 403, "forbidden", "owner only");

    const existing = store.active();
    if (existing && existing.state === "issued") {
      return res.json({ ok: true, reused: true, message: `Simple Pair active. Code: ${existing.shortCode}. URL: /pair/${existing.shortCode}. Expires: ${existing.expiresAt}` });
    }

    const s = store.create(300, { type: "telegram", id: "owner" });
    audit.record({ type: "simple_pair_started", actor: "telegram:owner", sessionId: s.sessionId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, reused: false, message: `Simple Pair started. Code: ${s.shortCode}. URL: /pair/${s.shortCode}. Expires: ${s.expiresAt}` });
  });

  app.post("/telegram/simple_pair/approve", (req, res) => {
    const owner = String(req.header("x-telegram-owner") || "false") === "true";
    if (!owner) return error(res, 403, "forbidden", "owner only");

    const requestId = String(req.body?.requestId || "").trim();
    if (!requestId) return error(res, 400, "bad_request", "requestId is required");

    const s = store.approve(requestId);
    if (!s) return error(res, 404, "not_found", "request not found or invalid state");
    audit.record({ type: "pair_approved", actor: "telegram:owner", sessionId: s.sessionId, requestId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, approved: true, requestId, message: `Approved request: ${requestId}` });
  });

  app.get("/telegram/simple_pair/pending", (req, res) => {
    const owner = String(req.header("x-telegram-owner") || "false") === "true";
    if (!owner) return error(res, 403, "forbidden", "owner only");

    const pending = store.pendingList().map((p) => ({ requestId: p.requestId, sessionId: p.sessionId, createdAt: p.createdAt, deviceName: p.claimMeta?.deviceName }));
    res.json({ ok: true, pending });
  });

  app.post("/telegram/simple_pair/approve-latest", (req, res) => {
    const owner = String(req.header("x-telegram-owner") || "false") === "true";
    if (!owner) return error(res, 403, "forbidden", "owner only");

    const pending = store.pendingList();
    if (pending.length === 0) return error(res, 404, "not_found", "no pending approval request");
    if (pending.length > 1) {
      return res.status(409).json({
        error: { code: "multiple_pending", message: "multiple pending approval requests; specify requestId" },
        pending: pending.map((p) => ({ requestId: p.requestId, sessionId: p.sessionId, createdAt: p.createdAt, deviceName: p.claimMeta?.deviceName }))
      });
    }

    const latest = pending[0];
    if (!latest?.requestId) return error(res, 404, "not_found", "no pending approval request");
    const s = store.approve(latest.requestId);
    if (!s) return error(res, 404, "not_found", "request not found or invalid state");
    audit.record({ type: "pair_approved", actor: "telegram:owner", sessionId: s.sessionId, requestId: latest.requestId, ip: req.ip, ua: req.header("user-agent") });
    res.json({ ok: true, approved: true, requestId: latest.requestId, message: `Approved latest pending request: ${latest.requestId}` });
  });

  app.get("/pair", (_req, res) => {
    const active = store.active();
    if (!active) return res.status(404).send("Pairing is not active");
    res.sendFile(path.join(__dirname, "../public/pair.html"));
  });

  app.get('/pair/handoff/:id', (_req, res) => {
    res.sendFile(path.join(__dirname, '../public/handoff.html'));
  });

  app.get("/pair/:code", (req, res) => {
    const active = store.active();
    if (!active) return res.status(404).send("Pairing is not active");
    res.sendFile(path.join(__dirname, "../public/pair.html"));
  });

  return app;
}
