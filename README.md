# OpenClaw Simple Pair

OpenClaw Simple Pair is a companion service that makes first-time device onboarding easier across many device types (phones, TVs, terminals, constrained browsers) without requiring users to type long gateway setup tokens.

It separates onboarding into two distinct concerns:

1. **Pairing** (device approval workflow)
2. **Dashboard authentication handoff** (post-pair login convenience)

This split is intentional. You can use only the Pairing layer if you want to keep your existing dashboard auth flow unchanged.

---

## What this repo is trying to achieve

- Provide a clean `/simple_pair` + `/pair` flow that is easier than raw token copy/paste.
- Keep Telegram and web admin behavior coherent.
- Support safe approval behavior when multiple pending requests exist.
- Prepare for tokenless dashboard entry using one-time handoff + proxy session cookies.

---

## Unified flow model (Pairing + Auth)

You can run this system in two modes:

- **Pairing-only mode**: use device pairing workflow, keep existing dashboard auth (token/paste/manual).
- **Pairing + handoff mode**: use pairing plus one-time handoff and proxy session for smoother dashboard entry.

### End-to-end pairing flow (with Telegram/Web mapping)

1. **Admin starts pairing session**
   - Web/API: `POST /simple_pair`
   - Telegram command: `/simple_pair`
   - Behavior: reuses active issued session; otherwise creates a new one.

2. **User claims pairing session**
   - Web: open `/pair` (or `/pair/:code` prefill), resolve code, click **Pair this device**.
   - Output includes next admin step and request context.

3. **Admin approves pending request**
   - Web/API fast path: `POST /pair/approve-latest`
   - Telegram fast path: `/simple_pair_approve`
   - If multiple pending:
     - Web/API explicit: `POST /pair/approve` with `requestId`
     - Telegram explicit: `/simple_pair_approve <requestId>`

### Optional auth handoff flow (post-approval)

4. **User initiates dashboard handoff**
   - Web: click **Complete Dashboard Sign-in** on `/pair` after approval.
   - Backend issues one-time handoff id (`/pair/handoff/*`).

5. **One-time redeem + proxy session**
   - Redeem endpoint sets short-lived HttpOnly cookie (`sp_handoff_session`).
   - Validator endpoint (`/auth/session/validate`) confirms session and emits identity header for proxy integration.

6. **Dashboard access**
   - For true tokenless access, run Gateway in trusted-proxy mode and wire reverse proxy forward-auth (details in `docs/AUTH-MODE-SWITCH.md`).

---

## Run

```bash
npm install
npm test
npm run build
npm start
```

---

## Documentation map

- `docs/IMPLEMENTATION-NOTES.md`
  - Current behavior and implementation details
- `docs/API-REFERENCE.md`
  - Endpoint inventory (pairing, telegram helpers, auth handoff)
- `docs/VALIDATION.md`
  - Test/build/smoke validation commands and expected outcomes
- `docs/AUTH-MODE-SWITCH.md`
  - Trusted-proxy switchover requirements, rollback, and security notes

---

## Security notes

- Keep gateway bind loopback when possible.
- Keep trusted proxy IP list minimal and exact.
- Handoff tokens are one-time and short-lived.
- In multiple-pending scenarios, require explicit approval selection.
