# Backend DDD Implementation Plan

## Principles
- Zero behavior change: endpoint/path/method, status code, headers/cookies, auth, validation, business outcome va DB side-effectlar 1:1 saqlanadi.
- Refactor-only: move/split/rename/composition; yangi feature qo'shilmaydi.
- Route registration order/prefix va Fastify plugin/hook/decorator behavior aynan saqlanadi.
- Har phase yakunida verification: `npm run typecheck` va `npm run build`.

## Phase 0 - Audit & Baseline (DONE)
- Scope:
  - `server.ts` bootstrap, `src/routes/*`, `src/modules/*` route handlers, DB access points, cross-cutting (`authz`, `httpErrors`, `audit`, realtime/cron) inventarizatsiyasi.
  - 300+ qatorli backend fayllarni aniqlash.
- Expected changes: kod o'zgarishi yo'q, faqat hujjatlashtirish.
- Rollback: kerak emas.
- Verification:
  - `npm run typecheck` (PASS)
  - `npm run build` (PASS)

## Phase 1 - DDD Skeleton + App Composition Root (IN_PROGRESS)
- Scope:
  - `src/app` ichida Fastify instansiya yaratish, plugin/hook/decorator registratsiyasi, route wiring va start/shutdown oqimini ajratish.
  - `server.ts`ni bootstrap entrypointga soddalashtirish.
- Expected changes (move/refactor only):
  - Bootstrapping logikasi modularlashadi, runtime behavior o'zgarmaydi.
- Rollback strategy:
  - `server.ts` va `src/app/**` o'zgarishlarini alohida commit; muammo bo'lsa revert.
- Verification:
  - `npm run typecheck`
  - `npm run build`
