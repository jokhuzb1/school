# Backend DDD Implementation Plan

## Principles
- Zero behavior change: endpoint/path/method, request/response shape, status code, auth/authz, validation, DB side-effectlar 1:1 saqlanadi.
- Refactor-only: move/split/composition; yangi feature kiritilmaydi.
- Fastify plugin/hook/decorator behavior va route registration order/prefix saqlanadi.
- Har phase yakunida `npm run typecheck` va `npm run build`.

## Phase 0 - Audit & Baseline (DONE)
- Scope:
  - Backend entrypoint, route registry, module ownership, DB access nuqtalari inventarizatsiyasi.
  - 300+ qatorli fayllarni aniqlash.
- Expected changes:
  - Kod o'zgarmaydi, faqat reja va risk xaritasi tayyorlanadi.
- Rollback strategy:
  - Kerak emas (analysis-only).
- Verification:
  - `npm run typecheck` -> PASS
  - `npm run build` -> PASS

## Phase 1 - App Composition Root (DONE)
- Scope:
  - `server.ts`ni bootstrap wrapperga aylantirish.
  - `src/app/server/create-server.ts` va `src/app/server/start-server.ts`ga Fastify wiringni ajratish.
- Expected changes:
  - Strukturaviy refaktor, runtime behavior o'zgarmaydi.
- Rollback strategy:
  - `server.ts` + `src/app/server/*` bo'yicha alohida revert mumkin.
- Verification:
  - `npm run typecheck` -> PASS
  - `npm run build` -> PASS

## Phase 2 - Medium Module Route Split (DONE)
- Scope:
  - `attendance`, `schools`, `users`, `sse` route fayllarini `interfaces/http`da registratorlarga bo'lish.
  - `presentation` fayllarni thin-wrapperga o'tkazish.
- Expected changes:
  - Katta route fayllari endpoint-guruhlarga ajraladi.
- Rollback strategy:
  - Modul-kesimida revert (`attendance` alohida, `schools` alohida, ...).
- Verification:
  - `npm run typecheck` -> FAIL->PASS (path fixdan so'ng)
  - `npm run build` -> FAIL->PASS (shu fixlardan so'ng)

## Phase 3 - Heavy Module Split (DONE)
- Scope:
  - `cameras`, `attendance/dashboard`, `attendance/webhook`, `students` route oqimlarini bo'lish.
  - `students`da import/provisioning oqimlari uchun helper/service ajratish.
  - `attendanceStats`ni kichik application fayllarga bo'lish.
- Expected changes:
  - Katta handlerlar bo'linadi, contract o'zgarmaydi.
- Rollback strategy:
  - Modul-kesimida qaytarish (`students`, `dashboard`, `cameras`, `webhook`).
- Verification:
  - `npm run typecheck` -> FAIL->PASS (type/path fixlar bilan)
  - `npm run build` -> FAIL->PASS

## Phase 4 - HTTP Interfaces Standardization (DONE)
- Scope:
  - `auth`, `classes`, `devices`, `holidays`, `search` route fayllarini ham `interfaces/http`ga ko'chirish.
  - `presentation` qatlamini to'liq wrapper formatiga o'tkazish.
- Expected changes:
  - HTTP ownership bir xil pattern bo'yicha standartlashadi.
- Rollback strategy:
  - Har modulni alohida wrapper+copy revert qilish mumkin.
- Verification:
  - `npm run typecheck` -> FAIL->PASS (`devices` service import yo'li fix)
  - `npm run build` -> FAIL->PASS

## Phase 5 - Final Cleanup & Gate (DONE)
- Scope:
  - Yakuniy line-limit audit (`src/**`).
  - Hujjatlar (`tasks.md`, `implementation-plan.md`, `ddd-map.md`)ni final holatga keltirish.
- Expected changes:
  - Faqat strukturaviy yakunlash va verification log.
- Rollback strategy:
  - Documentation alohida qaytarilishi mumkin, kod gate allaqachon verifikatsiyadan o'tgan.
- Verification:
  - `npm run typecheck` -> PASS
  - `npm run build` -> PASS
  - `src/**`da `>300` qatorli fayl -> 0 ta

## Risk Controls
- Contract driftni kamaytirish: endpoint bodylari imkon qadar 1:1 ko'chirildi, faqat fayl bo'linishi qilindi.
- Auth driftni kamaytirish: `requireRoles/requireSchoolScope/*scope` chaqiriqlari oldingi joylashuv semantikasi bilan saqlandi.
- DB driftni kamaytirish: Prisma query payloadlari va transaction oqimlari funksional o'zgartirilmadi.
- Frontend conflictdan qochish: backend va `work-item/*`dan tashqaridagi frontend ishlar bilan merge/revert qilinmadi.
