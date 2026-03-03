# OpenClaw Simple Pair

Minimal implementation of the approved Simple Pair v1 flow:
- `/simple_pair` (owner-only start)
- `/pair` page with short-code resolve + explicit claim
- `/pair/approve` (owner-only web approval)
- Telegram starter hook (`/telegram/simple_pair` endpoint stub)

## Run

```bash
npm install
npm run test
npm run build
npm start
```

## Note
This repo provides standalone implementation scaffolding. Integrate with your OpenClaw dashboard auth/session middleware in your host application.
