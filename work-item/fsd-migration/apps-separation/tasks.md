# Apps Separation Tasks

## Meta
- Scope: backend va web-frontendni `apps/*` ichiga ajratish (desktop `apps/student-registrator`ga tegilmaydi).
- Principle: zero behavior change (API contract, auth, validation, DB, frontend UX flow, build output semantics).
- Branch: joriy branch (yangi branch yo'q).
- Sana: 2026-02-12.

## Phase Status

| Phase | Goal | Status | Risks | Done Criteria |
|---|---|---|---|---|
| 0 | Audit + migration baseline | DONE | Yashirin bog'liqliklar o'tkazib yuborilishi | Path/config/deploy dependency ro'yxati to'liq |
| 1 | Frontendni `apps/frontend`ga ko'chirish (safe start) | DONE | File lock, deploy root drift | `apps/frontend` canonical, root legacy `frontend` olib tashlangan |
| 2 | Backend move-prep (path/cwd hardening) | DONE | upload/tools/.env yo'l drift | runtime pathlar helperga yig'ilgan, parity gate PASS |
| 3 | Backendni `apps/backend`ga ko'chirish | DONE | Docker/Prisma/script regressiya | `apps/backend` paketida `dev/build/typecheck/test/lint` PASS + root default backend commandlar `apps/backend`ga yo'nalgan + root util skriptlar parityda ko'chirilgan |
| 4 | Root wrapperlar + CI/deploy yangilash | DONE | Eski commandlar sinishi | root commandlar backward-compatible + docker wiring yangilangan |
| 5 | Final cleanup + dead path removal | DONE | Legacy shadow path qolib ketishi | root legacy pathlar o'chirilgan, canonical source faqat `apps/*`, yakuniy gate PASS |

## Task Checklist

- [x] A0.1 Scope auditini yakunlash (backend/frontend/deploy bog'liqliklari).
  - Goal: ko'chirishdan oldin risklarni aniq ko'rish.
  - Impacted: `package.json`, `Dockerfile`, `docker-compose.yml`, `server.ts`, `src/**`, `frontend/**`.
  - Risk: noto'g'ri inventory noto'g'ri migrationga olib boradi.
  - Done criteria: dependency va run/build entrypointlar hujjatlashtirilgan.

- [x] A1.1 `apps/frontend` nusxa-kesim init (move lock fallback).
  - Goal: frontendni `apps/*` ichida ishga tushirishni boshlash.
  - Impacted: `apps/frontend/**` (copy), `.eslintrc.cjs`, `.eslintignore`.
  - Risk: parallel frontend ishlar bilan kolliziya.
  - Done criteria: `apps/frontend`da local package mavjud, compile qilinadi.

- [x] A1.3 Root wrapper commandlar qo'shildi (`frontend:*`).
  - Goal: rootdan yangi app pathni standart ishlatish.
  - Impacted: `package.json`.
  - Risk: script naming kolliziyasi.
  - Done criteria: rootdan `frontend:typecheck` va `frontend:build` PASS.

- [x] A1.2 Frontend root switch + eski `frontend/`ni controlled retire.
  - Goal: bitta canonical frontend root qoldirish.
  - Impacted: `frontend/package.json`, `frontend/README.md`, root script wrappers.
  - Risk: lock sabab physical move/delete kechikishi.
  - Done criteria: `frontend` aktiv source emas, command-level delegatsiya `apps/frontend`ga o'tgan va yakunda root `frontend/` olib tashlangan.

- [x] A2.1 Backend runtime path hardening (`uploads/tools/.env`) - step 1.
  - Goal: `apps/backend` move oldidan root-path drift riskini pasaytirish.
  - Impacted: `src/app/runtime/paths.ts`, `src/prisma.ts`, `src/modules/attendance/interfaces/http/webhook.routes.ts`, `src/modules/students/interfaces/http/students.routes.helpers.ts`, `src/modules/cameras/services/mediamtx-runner.service.ts`, `scripts/setup-mediamtx.ts`.
  - Risk: noto'g'ri helper defaulti runtime fayl yo'lini o'zgartirib yuborishi.
  - Done criteria: default `process.cwd()` parity saqlangan, backend gates PASS.

- [x] A2.2 Backend entry/upload root parity audit (`server.ts` + static path contract).
  - Goal: upload yozish va static serving bir xil rootdan ishlashi.
  - Impacted: `server.ts`, `src/config.ts`, `src/app/runtime/paths.ts`.
  - Risk: prod path drift.
  - Done criteria: root va `apps/backend` ikkala holatda ham `.env`/`uploads` parity saqlangan.

- [x] A3.1 Backend copy-first move to `apps/backend`.
  - Goal: yangi backend app rootni ishga tushirish.
  - Impacted: `apps/backend/**`.
  - Risk: duplicate source divergence.
  - Done criteria: `apps/backend`da `npm ci` + `typecheck/build/test/lint` PASS.

- [x] A3.2 Backend canonical switch (command-level).
  - Goal: root backenddan `apps/backend`ga amaliy o'tish.
  - Impacted: `package.json` root scriptlari va `prisma.seed`.
  - Risk: operational command drift.
  - Done criteria: root `dev/build/typecheck/test/lint/start/db:*` commandlari `apps/backend`ga delegatsiya qilinadi.

- [x] A3.3 Root backend util skriptlar va test config parity migration.
  - Goal: rootdagi backendga oid yakka skriptlar ham `apps/backend` ichida mavjud bo'lishi.
  - Impacted: `apps/backend/{check_schools.ts,fix-admin.ts,fix-cam1.ts,fix_school_id.ts,get_secrets.ts,seed-today.ts,test-camera-stream.ts,update-cam1.ts,update-camera-urls.ts,update-to-main.ts,vitest.config.ts}`.
  - Risk: script import yo'li yoki env konteksti drift bo'lishi.
  - Done criteria: fayllar `apps/backend`ga nusxalangan, asosiy gate'lar PASS.

- [x] A4.1 Root command wrappers (`backend:*`, `frontend:*`) backward-compat.
  - Goal: rootdan yangi app joylashuvlarini boshqarish.
  - Impacted: `package.json`.
  - Risk: script naming collision.
  - Done criteria: root wrapper gates PASS (`backend:*`, `frontend:*`).

- [x] A4.2 Docker/compose build context update.
  - Goal: docker build source canonical ravishda `apps/backend`da bo'lishi.
  - Impacted: `docker-compose.yml`, `apps/backend/Dockerfile`, root `Dockerfile` (removed).
  - Risk: image build verify qilinmasa yashirin regressiya qolishi.
  - Done criteria: compose backend build `apps/backend` contextga o'tgan, root `Dockerfile` olib tashlangan.

- [x] A5.1 Final docs + mapping + acceptance gate.
  - Goal: migratsiya yakuniy holatini formal yopish.
  - Impacted: `work-item/fsd-migration/apps-separation/{tasks.md,implementation-plan.md,apps-map.md,legacy-policy.md}`.
  - Risk: doc/code drift.
  - Done criteria: phase/status/checklist sinxron, final gate PASS, qolgan blockerlar aniq qayd etilgan.

- [x] A5.2 Legacy root source hard cleanup.
  - Goal: eski duplicate source kodni to'liq olib tashlash.
  - Impacted: `frontend/**`, `src/**`, `prisma/**`, `scripts/**`, `server.ts`, root backend util `*.ts`, `vitest.config.ts`.
  - Risk: yashirin import yoki operational bog'liqlik sinishi.
  - Done criteria: dependency auditda missing=0, legacy pathlar o'chirilgan, root gate (`typecheck/build/test/lint/frontend:*`) PASS.

- [x] A5.3 Root artifact hygiene cleanup.
  - Goal: rootdagi vaqtinchalik/keraksiz artifactlarni olib tashlash.
  - Impacted: `.tmp/**`, `.cargo-target-sr/**`, `target_verify_2026021295QSk9/**`, `image-for-face-id/**`, `tmp_rovodev_commit_a0b0ca0.tsx`, local `dist/`, `camera-debug.log`.
  - Risk: noto'g'ri artifactni o'chirish.
  - Done criteria: dependency auditda bog'liqlik yo'q, root gate (`typecheck/build/frontend:*`) PASS.

- [x] A5.4 Root package manifest removal (full app-local mode).
  - Goal: package boshqaruvini to'liq `apps/backend` va `apps/frontend` ichiga o'tkazish.
  - Impacted: root `package.json`, root `package-lock.json`, `README.md`.
  - Risk: root-level command odatlari sinishi.
  - Done criteria: root manifestlar olib tashlangan, app-local gate (`apps/backend` + `apps/frontend`) PASS.

## Verification Log

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-02-12 | `npm run typecheck` (root backend) | PASS | Baseline |
| 2026-02-12 | `npm run build` (root backend) | PASS | Baseline |
| 2026-02-12 | `npm run typecheck` (`frontend`) | PASS | Baseline (move oldidan) |
| 2026-02-12 | `npm run build` (`frontend`) | PASS | Baseline (move oldidan) |
| 2026-02-12 | `npm ci` (`apps/frontend`) | PASS | copy-first frontend install |
| 2026-02-12 | `npm run typecheck` (`apps/frontend`) | PASS | new app root gate |
| 2026-02-12 | `npm run build` (`apps/frontend`) | PASS | new app root gate |
| 2026-02-12 | `npm run typecheck` (root backend) | PASS | frontend ko'chirishdan keyin parity check |
| 2026-02-12 | `npm run build` (root backend) | PASS | frontend ko'chirishdan keyin parity check |
| 2026-02-12 | `npm run frontend:typecheck` (root wrapper) | PASS | wrapper gate |
| 2026-02-12 | `npm run frontend:build` (root wrapper) | PASS | wrapper gate |
| 2026-02-12 | `npm run typecheck` (root backend) | PASS | path hardening step 1 dan keyin |
| 2026-02-12 | `npm run build` (root backend) | PASS | path hardening step 1 dan keyin |
| 2026-02-12 | `npm run test` (root backend) | PASS | 4 file, 15 test |
| 2026-02-12 | `npm run lint` (root backend) | PASS | ESLint error yo'q |
| 2026-02-12 | `rg -n "process\\.cwd\\(" src scripts server.ts` | PASS | faqat `src/app/runtime/paths.ts`da qoldi (markazlashtirilgan) |
| 2026-02-12 | `npm ci` (`apps/backend`) | PASS | backend app package install |
| 2026-02-12 | `npm run typecheck` (`apps/backend`) | PASS | backend app gate |
| 2026-02-12 | `npm run build` (`apps/backend`) | PASS | backend app gate |
| 2026-02-12 | `npm run test` (`apps/backend`) | PASS | 4 file, 15 test |
| 2026-02-12 | `npm run lint` (`apps/backend`) | PASS | ESLint error yo'q |
| 2026-02-12 | `npm run backend:typecheck` (root wrapper) | PASS | wrapper gate |
| 2026-02-12 | `npm run backend:build` (root wrapper) | PASS | wrapper gate |
| 2026-02-12 | `npm run backend:test` (root wrapper) | PASS | wrapper gate |
| 2026-02-12 | `npm run backend:lint` (root wrapper) | PASS | wrapper gate |
| 2026-02-12 | `npm run typecheck` (root backend) | PASS | `server.ts/config.ts` parity update'dan keyin |
| 2026-02-12 | `npm run build` (root backend) | PASS | `server.ts/config.ts` parity update'dan keyin |
| 2026-02-12 | `npm run typecheck` (`apps/backend`) | PASS | parity update'dan keyin |
| 2026-02-12 | `npm run build` (`apps/backend`) | PASS | parity update'dan keyin |
| 2026-02-12 | `npm run typecheck` (root default) | PASS | root default commandlar `apps/backend`ga switch qilingandan keyin |
| 2026-02-12 | `npm run build` (root default) | PASS | root default commandlar `apps/backend`ga switch qilingandan keyin |
| 2026-02-12 | `npm run test` (root default) | PASS | root default commandlar `apps/backend`ga switch qilingandan keyin |
| 2026-02-12 | `npm run lint` (root default) | PASS | root default commandlar `apps/backend`ga switch qilingandan keyin |
| 2026-02-12 | `npm run typecheck` (`frontend` legacy wrapper) | PASS | `frontend` -> `apps/frontend` delegatsiya ishladi |
| 2026-02-12 | `npm run build` (`frontend` legacy wrapper) | PASS | `frontend` -> `apps/frontend` delegatsiya ishladi |
| 2026-02-12 | `npm run typecheck` (root final re-check) | PASS | `apps/backend` delegatsiya yakuniy tekshiruv |
| 2026-02-12 | `npm run build` (root final re-check) | PASS | `apps/backend` delegatsiya yakuniy tekshiruv |
| 2026-02-12 | `npm run test` (root final re-check) | PASS | 4 file, 15 test |
| 2026-02-12 | `npm run lint` (root final re-check) | PASS | ESLint error yo'q |
| 2026-02-12 | `npm run frontend:typecheck` (root final re-check) | PASS | `apps/frontend` gate |
| 2026-02-12 | `npm run frontend:build` (root final re-check) | PASS | `apps/frontend` gate |
| 2026-02-12 | `npm run typecheck` (root post-final) | PASS | root `predev/dev` delegatsiya tune'dan keyin |
| 2026-02-12 | `npm run build` (root post-final) | PASS | root `predev/dev` delegatsiya tune'dan keyin |
| 2026-02-12 | `npm run test` (root post-final) | PASS | 4 file, 15 test |
| 2026-02-12 | `npm run lint` (root post-final) | PASS | ESLint error yo'q |
| 2026-02-12 | `npm run frontend:typecheck` (root post-final) | PASS | `apps/frontend` gate |
| 2026-02-12 | `npm run frontend:build` (root post-final) | PASS | `apps/frontend` gate |
| 2026-02-12 | `npm run db:generate` (root delegated) | PASS | `apps/backend` prisma delegatsiya ishladi |
| 2026-02-12 | `npm run typecheck` (root, post util-script migration) | PASS | `apps/backend` delegatsiya |
| 2026-02-12 | `npm run build` (root, post util-script migration) | PASS | `apps/backend` delegatsiya |
| 2026-02-12 | `npm run frontend:typecheck` (root, post util-script migration) | PASS | `apps/frontend` gate |
| 2026-02-12 | `npm run frontend:build` (root, post util-script migration) | PASS | `apps/frontend` gate |
| 2026-02-12 | `npm run test` (root, post util-script migration) | PASS | 4 file, 15 test |
| 2026-02-12 | `npm run lint` (root, post util-script migration) | PASS | ESLint error yo'q |
| 2026-02-12 | `npm run typecheck` (root, docker-inside update) | PASS | `apps/backend` delegatsiya |
| 2026-02-12 | `npm run build` (root, docker-inside update) | PASS | `apps/backend` delegatsiya |
| 2026-02-12 | `npm run test` (root, docker-inside update) | PASS | 4 file, 15 test |
| 2026-02-12 | `npm run lint` (root, docker-inside update) | PASS | ESLint error yo'q |
| 2026-02-12 | `parity audit (src/prisma/scripts/frontend + root util ts)` | PASS | `*_MISSING_IN_APP=0` |
| 2026-02-12 | `npm run typecheck` (root, post legacy removal) | PASS | `apps/backend` delegatsiya |
| 2026-02-12 | `npm run build` (root, post legacy removal) | PASS | `apps/backend` delegatsiya |
| 2026-02-12 | `npm run test` (root, post legacy removal) | PASS | 4 file, 15 test |
| 2026-02-12 | `npm run lint` (root, post legacy removal) | PASS | ESLint error yo'q |
| 2026-02-12 | `npm run frontend:typecheck` (root, post legacy removal) | PASS | `apps/frontend` gate |
| 2026-02-12 | `npm run frontend:build` (root, post legacy removal) | PASS | `apps/frontend` gate |
| 2026-02-12 | `root artifact dependency audit` | PASS | `.tmp/.cargo-target-sr/target_verify/image-for-face-id/tmp_rovodev` uchun bog'liqlik topilmadi |
| 2026-02-12 | `npm run typecheck` (root, post artifact cleanup) | PASS | `apps/backend` delegatsiya |
| 2026-02-12 | `npm run build` (root, post artifact cleanup) | PASS | `apps/backend` delegatsiya |
| 2026-02-12 | `npm run frontend:typecheck` (root, post artifact cleanup) | PASS | `apps/frontend` gate |
| 2026-02-12 | `npm run frontend:build` (root, post artifact cleanup) | PASS | `apps/frontend` gate |
| 2026-02-12 | `npm run typecheck` (`apps/backend`) | PASS | app-local gate (post root manifest removal) |
| 2026-02-12 | `npm run build` (`apps/backend`) | PASS | app-local gate (post root manifest removal) |
| 2026-02-12 | `npm run typecheck` (`apps/frontend`) | PASS | app-local gate (post root manifest removal) |
| 2026-02-12 | `npm run build` (`apps/frontend`) | PASS | app-local gate (post root manifest removal) |
| 2026-02-12 | `docker --version` | FAIL | local env'da docker binary yo'q, image verify bloklangan |

## Open Risks (Current)

- R1: Docker runtime verify local muhitda bloklangan (`docker` binary mavjud emas).
