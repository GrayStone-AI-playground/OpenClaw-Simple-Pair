# API Reference

## Pair session lifecycle

- `POST /simple_pair`
- `POST /pair/resolve`
- `POST /pair/claim`
- `GET /pair/claim-status`
- `POST /pair/approve`
- `POST /pair/approve-latest`

## Handoff

- `POST /pair/handoff/create`
- `POST /pair/handoff/redeem`

## Telegram owner helpers

- `POST /telegram/simple_pair`
- `POST /telegram/simple_pair/approve`
- `POST /telegram/simple_pair/approve-latest`
- `GET /telegram/simple_pair/pending`

## Misc

- `GET /health`
- `GET /pair/status`
- `GET /pair`
- `GET /pair/:code`
- `GET /pair/handoff/:id`
- `GET /pair/pending`
- `GET /audit/events`
