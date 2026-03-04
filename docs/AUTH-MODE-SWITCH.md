# Trusted-Proxy Auth Switchover Notes

This project now supports a tokenless one-time handoff on the simple-pair side via a short-lived proxy session cookie.

## What changed in simple-pair

- `POST /pair/handoff/redeem` no longer returns gateway token.
- It now issues `sp_handoff_session` (HttpOnly, Secure, SameSite=Lax, 10m).
- `GET /auth/session/validate` validates the cookie and returns identity context.
- Response includes `x-forwarded-user` header from validator path.

## Gateway auth model required for full passwordless dashboard

To complete tokenless dashboard access, OpenClaw Gateway must run in:

- `gateway.auth.mode = "trusted-proxy"`
- `gateway.trustedProxies = ["<PROXY_IP_V4>", "<PROXY_IP_V6>"]` (for same-host Caddy, typically loopback addresses)
- `gateway.auth.trustedProxy.userHeader = "x-forwarded-user"`
- optional `allowUsers` e.g. `"paired-user"`

## Caddy integration pattern

Use forward auth for dashboard paths and bypass for simple-pair routes:

- simple-pair direct: `/pair*`, `/simple_pair*`, `/telegram/simple_pair*`, `/audit/events`, `/auth/session/validate`
- dashboard/proxied app: all remaining paths

forward_auth should call `/auth/session/validate` on simple-pair backend and copy `X-Forwarded-User`.

### Hybrid local/proxied layout (recommended)

For setups that need both:
- strict trusted-proxy for user-facing dashboard handoff, and
- reliable local automation/control access,

run a separate loopback-only bridge listener (for example `127.0.0.1:18790`) that injects required trusted-proxy headers and reverse-proxies to gateway `127.0.0.1:18789`.

This keeps:
- direct raw gateway (`18789`) guarded by trusted-proxy checks,
- proxied dashboard path functioning tokenless,
- local automation calls working via the bridge.

### Cookie/hostname gotcha

`sp_handoff_session` is host-scoped. If handoff redeem occurs on one hostname and redirect jumps to another hostname (e.g. `gateway-host` -> `gateway.example.com`), validator sees `missing session cookie`.

Mitigation: handoff UI should redirect to `/` on the current origin after redeem, not to a potentially different absolute host.

## Rollback plan

If trusted-proxy mode causes auth problems:

1. Restore token mode:
   - `openclaw config set gateway.auth.mode token`
2. Remove/ignore trusted-proxy fields (optional cleanup)
3. Restart gateway service
4. Keep simple-pair service running; fallback remains functional

## Security notes

- Keep gateway bind loopback where possible.
- Keep `trustedProxies` minimal and exact.
- Do not expose validator endpoint to untrusted backends.
- Handoff is one-time and short-lived by design.
