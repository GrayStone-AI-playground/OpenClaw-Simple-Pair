# Implementation Notes

This repository implements the approved v1 shape in standalone form.

## Included
- `POST /simple_pair` (owner-only)
- `/pair` and `/pair/:code` page (active-window gated)
- `POST /pair/resolve`
- `POST /pair/claim` (explicit action only)
- `GET /pair/claim-status`
- `POST /pair/approve` (owner-only)
- telegram starter stub: `POST /telegram/simple_pair`
- in-memory audit log + endpoint

## Auth model (current)
For standalone testing, role is passed via `x-role` header (`owner|viewer`).

## Integration target
When integrating into OpenClaw host app, replace `x-role` checks with dashboard session middleware and real permission mapping (`pairing:start`, `pairing:approve`).
