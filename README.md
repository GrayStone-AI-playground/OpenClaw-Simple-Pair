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

## Conceptual model

### A) Pairing layer (can be used standalone)

This is the core onboarding workflow.

**Admin starts pairing**
- Start from web/admin side via `/simple_pair`.
- If an issued session is active, it is reused.

**User claims pairing session**
- Open `/pair` (or `/pair/:code` prefill).
- Resolve short code.
- Explicitly click **Pair this device**.

**Admin approves**
- Fast path: approve latest when only one pending exists.
- Safe path: when multiple are pending, admin must choose explicit `requestId`.

This layer works independently of trusted-proxy auth and can be used even if dashboard auth remains token-based.

### B) Auth handoff layer (optional)

After pairing approval, this layer provides a one-time transition toward dashboard access:

- One-time handoff IDs (`/pair/handoff/*`)
- One-time redeem
- HttpOnly proxy session cookie (`sp_handoff_session`)
- Session validator endpoint (`/auth/session/validate`)

Important: full passwordless dashboard experience requires Gateway trusted-proxy integration (see docs below).

---

## Expected end-to-end flow

### Pairing flow

1. Admin starts `/simple_pair`.
2. User opens `/pair` and enters/resolves short code.
3. User clicks **Pair this device**.
4. Admin approves:
   - single pending: `/simple_pair_approve`
   - multiple pending: approve by explicit `requestId`

### Auth handoff flow (optional)

1. Pairing is approved.
2. User clicks **Complete Dashboard Sign-in**.
3. Backend issues one-time handoff and then a short-lived proxy session cookie.
4. Browser is redirected to dashboard path.
5. Reverse proxy + trusted-proxy auth integration validates cookie/identity path.

---

## API/route summary

### Pairing
- `POST /simple_pair`
- `GET /pair`
- `GET /pair/:code`
- `POST /pair/resolve`
- `POST /pair/claim`
- `GET /pair/claim-status`
- `GET /pair/pending`
- `POST /pair/approve`
- `POST /pair/approve-latest`

### Telegram-facing helper endpoints
- `POST /telegram/simple_pair`
- `GET /telegram/simple_pair/pending`
- `POST /telegram/simple_pair/approve`
- `POST /telegram/simple_pair/approve-latest`

### Auth handoff
- `POST /pair/handoff/create`
- `GET /pair/handoff/:id`
- `POST /pair/handoff/redeem`
- `GET /auth/session/validate`

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
