# Legacy Path Policy

## Canonical Source of Truth

- Backend canonical source: `apps/backend/**`
- Web frontend canonical source: `apps/frontend/**`

## Legacy Paths Status

- Root legacy source pathlar (`frontend/**`, `server.ts`, `src/**`, `prisma/**`, `scripts/**`, root backend util `*.ts`) cleanup bosqichida olib tashlangan.
- Endi runtime/source bo'yicha yagona canonical joylashuv: `apps/backend/**` va `apps/frontend/**`.

## Rule

- Yangi o'zgarishlar faqat `apps/backend/**` va `apps/frontend/**` ichida qilinadi.
- Rootda yangi source qo'shmaslik: barcha backend/frontend feature/refactor faqat `apps/*` ichida amalga oshiriladi.

## Operational Note

- Docker runtime verify local muhitda `docker` mavjud bo'lganda alohida bajariladi.
