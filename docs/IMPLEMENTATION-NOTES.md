# Implementation Notes

This repository implements the approved simple-pair flow with web + telegram coherence and hardened handoff.

## Included

- `POST /simple_pair` (owner-only)
  - reuses active **issued** session
  - creates new session when previous is pending/approved/expired
- `/pair` and `/pair/:code` page
  - active-window gated
  - `/pair/:code` prefill only (no auto-claim)
  - `Pair this device` button appears only after successful resolve
- `POST /pair/resolve` (per-IP rate limited)
- `POST /pair/claim` (explicit action, per-IP rate limited)
- `GET /pair/claim-status`
- `GET /pair/pending` (owner)
- `POST /pair/approve` (owner, by requestId)
- `POST /pair/approve-latest` (owner)
  - approves directly if one pending
  - returns `multiple_pending` list when >1

## Telegram-facing endpoints

- `POST /telegram/simple_pair`
- `GET /telegram/simple_pair/pending`
- `POST /telegram/simple_pair/approve` (by requestId)
- `POST /telegram/simple_pair/approve-latest` (single-pending fast path)

## Handoff (no token exposure)

- `POST /pair/handoff/create` (requires approved pair session)
- `GET /pair/handoff/:id` (handoff UI)
  - redirects to `/` on the same origin after redeem (avoids host mismatch cookie loss)
- `POST /pair/handoff/redeem` (one-time, 60s handoff)
  - issues `sp_handoff_session` cookie
  - does **not** return gateway token
- `GET /auth/session/validate`
  - validates proxy session cookie
  - emits `x-forwarded-user`

## Auth model notes

- Local standalone tests use `x-role: owner|viewer` and `x-telegram-owner: true|false`.
- For production-like tokenless dashboard, use OpenClaw trusted-proxy mode and Caddy forward_auth (see `docs/AUTH-MODE-SWITCH.md`).
