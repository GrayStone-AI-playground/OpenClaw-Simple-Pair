# OpenClaw Simple Pair

Simple Pair service for short-code dashboard onboarding with owner approval.

## What it does

- Starts/reuses pairing windows via `/simple_pair` and `/telegram/simple_pair`
- Lets the browser resolve + claim with a short code (`/pair`)
- Requires explicit owner approval (`/pair/approve*` or telegram approve endpoints)
- Auto-approves matching **gateway device pairing** on simple-pair approval
- Generates one-time handoff links and redirects to tokenized dashboard URL
- Persists pair sessions across service restarts (file-backed mini DB)

## API

API routes are documented in [`docs/API.md`](docs/API.md).

## Security + persistence defaults

Configured via service env:

- `SIMPLE_PAIR_DB_PATH=./data/pair-store.json`
- `SIMPLE_PAIR_RETENTION_DAYS=14`
- `UMask=0077`

Runtime behavior:

- DB dir/file hardened to `0700/0600`
- one-time handoff IDs expire quickly and are single-use
- basic rate limits on resolve/claim routes

## Run

```bash
npm install
npm test
npm run build
npm start
```
