# Validation (2026-03-03 UTC)

## Commands

```bash
npm test
npm run build
```

Server smoke test and endpoint checks:

```bash
PORT=43143 node dist/index.js

# separate shell (curl checks)
curl -sS -o /tmp/pair_inactive.out -w '%{http_code}' http://127.0.0.1:43143/pair
curl -sS -H 'content-type: application/json' -H 'x-role: owner' -d '{"ttlSeconds":300}' http://127.0.0.1:43143/simple_pair
curl -sS -o /tmp/pair_active.out -w '%{http_code}' http://127.0.0.1:43143/pair
curl -sS -o /tmp/pair_prefill.out -w '%{http_code}' http://127.0.0.1:43143/pair/<SHORT_CODE>
curl -sS http://127.0.0.1:43143/pair/status
curl -sS -H 'content-type: application/json' -d '{"code":"<SHORT_CODE>"}' http://127.0.0.1:43143/pair/resolve
curl -sS -H 'content-type: application/json' -d '{"sessionId":"<SESSION_ID>","client":{"kind":"web"}}' http://127.0.0.1:43143/pair/claim
curl -sS -H 'content-type: application/json' -H 'x-role: owner' -d '{"requestId":"<REQUEST_ID>"}' http://127.0.0.1:43143/pair/approve
curl -sS 'http://127.0.0.1:43143/pair/claim-status?sessionId=<SESSION_ID>'
```

## Results (sample run)

- `npm test`: **PASS** (4 tests)
- `npm run build`: **PASS**
- `/pair` before start: **404** (`Pairing is not active`)
- `POST /simple_pair` (owner): **200** with `sessionId`, `shortCode`, `prefillUrl`
- `/pair` after start: **200**
- `/pair/:code` while active: **200**
- `GET /pair/status`: **active: true** + `expiresAt`
- `POST /pair/resolve`: **200** + `requiresConfirm: true`
- `POST /pair/claim`: **200** + `pending: true` + `requestId`
- `POST /pair/approve` (owner): **200** + `approved: true`
- `GET /pair/claim-status`: `status: approved`
- `/pair` after approval: **404** (window no longer active)
