# OpenClaw Simple Pair

Simple pairing service for OpenClaw with coherent web + Telegram admin flow.

## Core flow

- Start pairing: `POST /simple_pair` (owner)
- User claim: `/pair` page (resolve -> explicit pair action)
- Approve:
  - single pending: `/simple_pair_approve` -> `approve-latest`
  - multiple pending: explicit `requestId` approval

## Handoff model

- One-time handoff after approval (`/pair/handoff/*`)
- No gateway token exposure in handoff response/UI
- Proxy session cookie (`sp_handoff_session`) + validator endpoint

## Run

```bash
npm install
npm test
npm run build
npm start
```

## Docs

- `docs/IMPLEMENTATION-NOTES.md` — implemented endpoints/behavior
- `docs/VALIDATION.md` — test + smoke validation commands
- `docs/AUTH-MODE-SWITCH.md` — trusted-proxy switchover, rollback, security notes
