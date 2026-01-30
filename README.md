Attendance System

Setup & run

1. Install dependencies:

```
npm install
```

2. Run Prisma migrate:

```
npm run db:migrate
```

3. Seed database:

```
npm run db:seed
```

4. Start dev server:

```
npm run dev
```

Webhook URLs: use `/webhook/:schoolId/in` and `/webhook/:schoolId/out` (see `/schools/:id/webhook-info`).

Production notes:
- Set `JWT_SECRET`, `CORS_ORIGINS`, `SSE_TOKEN_TTL_SECONDS`, and `REDIS_URL` (for horizontal scale pub/sub).
- SSE uses short-lived tokens via `/auth/sse-token` when `NODE_ENV=production`.
- Webhook secrets are enforced in production (query param `secret` or header `x-webhook-secret`).
