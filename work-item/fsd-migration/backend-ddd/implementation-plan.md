# Backend DDD Implementation Plan

## Principles
- Zero behavior change: endpoint/path/method, request/response contract, status code, auth/authz, validation, DB side-effectlar 1:1 saqlanadi.
- Refactor-only: move/split/extract. Yangi feature yo'q.
- Fastify plugin/hook/decorator behavior va route registration order/prefix saqlanadi.
- Har bosqichdan keyin gate: `npm run typecheck` + `npm run build`.

## Phase A - Baseline va xavfsiz split (DONE)
- Scope:
  - Inventory, composition root, interfaces/http ga ko'chirish, yirik fayllarni bo'lish.
- Rollback:
  - Modul-kesimida revert.
- Verification:
  - Typecheck/build PASS.

## Phase B - Strict DDD extraction (DONE)
- Scope:
  - Har modul uchun: `domain` (entity/value rules), `application` (use-case), `infrastructure` (Prisma/external adapter), `interfaces/http` (thin handlers).
  - Qilinganlar: `attendance`, `auth`, `holidays`, `search`, `classes`, `devices`, `schools`, `sse`, `students`, `users`, `cameras`.
  - Yakuniy hardening: `application` qatlamida bevosita `infrastructure` type-importlar port-style interfacelarga almashtirildi.
  - Qolganlar: yo'q.
- Expected changes:
  - Bevosita Prisma chaqiriqlari route handlerlardan application/infrastructurega ko'chadi.
  - HTTP qatlamida faqat auth, validation, DTO map, response mapping qoladi.
- Rollback:
  - Modul bo'yicha alohida commit/revert strategiyasi.
- Verification:
  - Har moduldan keyin typecheck/build.

## Phase C - Final hardening (DONE)
- Scope:
  - Circular dependency audit.
  - Dead code/unused export cleanup.
  - Docs finalization (`tasks.md`, `implementation-plan.md`, `ddd-map.md`).
- Verification:
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
  - `npm run lint`

## Latest Gate (2026-02-12)
- `npm run typecheck` - PASS
- `npm run build` - PASS
- `npm test` - PASS
- `npm run lint` - PASS
- `rg -n "../infrastructure/" src/modules -g "*application*.ts"` - PASS (match yo'q)
- `rg -n "\bprisma\." src/modules -g "*interfaces/http*.ts"` - PASS (match yo'q)
- `npm run typecheck` - PASS (final re-check)
- `npm run build` - PASS (final re-check)
- Final note: barcha modullar (`devices/schools/sse/students/users/cameras/attendance`) repo-adapter migrationdan keyin ham gate'lar PASS; `DELETE /schools/:id` masalasi backend zero-behavior-change policy sababli backend scope'dan chiqarildi.
