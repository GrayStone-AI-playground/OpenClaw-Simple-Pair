# Validation (2026-03-03 UTC)

## Automated

```bash
npm test
npm run build
```

Current test suite: **8 passing**.

## Local smoke checks

```bash
# run service
PORT=43143 node dist/index.js

# in another shell
curl -sS -H 'content-type: application/json' -H 'x-role: owner' -d '{}' http://127.0.0.1:43143/simple_pair
curl -sS -H 'content-type: application/json' -d '{"code":"<SHORT_CODE>"}' http://127.0.0.1:43143/pair/resolve
curl -sS -H 'content-type: application/json' -d '{"sessionId":"<SESSION_ID>","client":{"kind":"web"}}' http://127.0.0.1:43143/pair/claim

# approve latest (single pending)
curl -sS -H 'content-type: application/json' -H 'x-role: owner' -d '{}' http://127.0.0.1:43143/pair/approve-latest

# explicit approve (multi-pending safe path)
curl -sS -H 'content-type: application/json' -H 'x-role: owner' -d '{"requestId":"<REQUEST_ID>"}' http://127.0.0.1:43143/pair/approve

# handoff
curl -sS -H 'content-type: application/json' -d '{"sessionId":"<APPROVED_SESSION_ID>"}' http://127.0.0.1:43143/pair/handoff/create
curl -i -sS -H 'content-type: application/json' -d '{"handoffId":"<HANDOFF_ID>"}' http://127.0.0.1:43143/pair/handoff/redeem
curl -sS -H 'Cookie: sp_handoff_session=<COOKIE_VALUE>' http://127.0.0.1:43143/auth/session/validate
```

## Expected outcomes

- `/pair` inactive returns `404 Pairing is not active`
- `/simple_pair` returns session + short code
- `/pair/claim` returns `nextCommand: /simple_pair_approve`
- `/pair/approve-latest`:
  - one pending => approve success
  - multiple pending => `409 multiple_pending` + pending list
- `/pair/handoff/redeem`:
  - returns `proxyReady: true`
  - no `gatewayToken` field
  - sets `sp_handoff_session` cookie
- `/auth/session/validate` returns `{ ok: true, user, sessionId }` with valid cookie
