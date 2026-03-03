# API Reference

## Pairing

- `POST /simple_pair`
- `GET /pair`
- `GET /pair/:code`
- `POST /pair/resolve`
- `POST /pair/claim`
- `GET /pair/claim-status`
- `GET /pair/pending`
- `POST /pair/approve`
- `POST /pair/approve-latest`

## Telegram-facing helper endpoints

- `POST /telegram/simple_pair`
- `GET /telegram/simple_pair/pending`
- `POST /telegram/simple_pair/approve`
- `POST /telegram/simple_pair/approve-latest`

## Auth handoff

- `POST /pair/handoff/create`
- `GET /pair/handoff/:id`
- `POST /pair/handoff/redeem`
- `GET /auth/session/validate`
