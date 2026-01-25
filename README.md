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
