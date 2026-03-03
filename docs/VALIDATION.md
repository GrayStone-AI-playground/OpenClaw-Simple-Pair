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
PORT=<PORT> node dist/index.js

# in another shell
BASE_URL="http://<HOST>:<PORT>"

curl -sS -H 'content-type: application/json' -H 'x-role: owner' -d '{}' "$BASE_URL/simple_pair"
curl -sS -H 'content-type: application/json' -d '{"code":"<SHORT_CODE>"}' "$BASE_URL/pair/resolve"
curl -sS -H 'content-type: application/json' -d '{"sessionId":"<SESSION_ID>","client":{"kind":"web"}}' "$BASE_URL/pair/claim"

# approve latest (single pending)
curl -sS -H 'content-type: application/json' -H 'x-role: owner' -d '{}' "$BASE_URL/pair/approve-latest"

# explicit approve (multi-pending safe path)
curl -sS -H 'content-type: application/json' -H 'x-role: owner' -d '{"requestId":"<REQUEST_ID>"}' "$BASE_URL/pair/approve"

# handoff
curl -sS -H 'content-type: application/json' -d '{"sessionId":"<APPROVED_SESSION_ID>"}' "$BASE_URL/pair/handoff/create"
curl -i -sS -H 'content-type: application/json' -d '{"handoffId":"<HANDOFF_ID>"}' "$BASE_URL/pair/handoff/redeem"
curl -sS -H 'Cookie: sp_handoff_session=<COOKIE_VALUE>' "$BASE_URL/auth/session/validate"
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
