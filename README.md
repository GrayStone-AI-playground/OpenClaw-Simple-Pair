# OpenClaw Simple Pair

OpenClaw Simple Pair is a companion service that makes first-time dashboard onboarding easier without forcing users to copy/paste long gateway tokens.

It intentionally separates two concerns:

1. **Pairing** (device approval workflow)
2. **Dashboard authentication handoff** (post-pair login convenience)

You can use pairing only, or pairing + handoff.

---

## Goals

- Provide a clean `/simple_pair` + `/pair` experience for phones, TVs, constrained browsers, and non-technical users.
- Keep Telegram and web-admin approval behavior aligned.
- Handle multi-pending approvals safely (explicit selection when needed).
- Preserve security controls while reducing onboarding friction.

---

## Flow model

### 1) Start pairing session
- Web/API: `POST /simple_pair`
- Telegram: `/simple_pair`
- Behavior: reuses active issued session when possible; otherwise creates a new one.

### 2) User claims pairing
- User opens `/pair` (or `/pair/:code` prefill), resolves code, then confirms claim.
- Backend records pending approval request.

### 3) Owner approves
- Fast path:
  - Web/API: `POST /pair/approve-latest`
  - Telegram: `/simple_pair_approve`
- Multiple pending requests:
  - Web/API: `POST /pair/approve` with `requestId`
  - Telegram: `/simple_pair_approve <requestId>`

### 4) Optional handoff login
- After approval, one-time handoff routes (`/pair/handoff/*`) provide smoother dashboard entry.
- Handoff redirects to a tokenized same-origin dashboard URL for practical token-mode compatibility.

---

## Current behavior highlights

- Short-code pairing flow with explicit claim/approve gates
- Telegram owner helpers for start + approve
- Auto-approval attempt for matching gateway device pairing during simple-pair approval
- File-backed persistence so records survive service restarts
- Short-lived one-time handoff IDs

---

## Security + persistence defaults

Configured via env:

- `SIMPLE_PAIR_DB_PATH=./data/pair-store.json`
- `SIMPLE_PAIR_RETENTION_DAYS=14`
- `UMask=0077`

Runtime hardening:

- Data directory/file permissions tightened to `0700` / `0600`
- Basic per-IP rate limits on resolve/claim
- One-time handoff IDs are single-use and expire quickly

---

## Run

```bash
npm install
npm test
npm run build
npm start
```

---

## Docs

- API routes: [`docs/API.md`](docs/API.md)
- Implementation details: [`docs/IMPLEMENTATION-NOTES.md`](docs/IMPLEMENTATION-NOTES.md)
- Validation checklist: [`docs/VALIDATION.md`](docs/VALIDATION.md)
