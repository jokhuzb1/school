# Apps Separation Implementation Plan

## Principles
- Zero behavior change: runtime logic va contractlar o'zgarmaydi.
- Move/refactor only: faqat joylashuv va wiring.
- Safe-phase rollout: har fazadan keyin gate (`typecheck/build`, kerak joyda `test/lint`).
- Frontend parallel-work safety: invasive UI refactor qilinmaydi, faqat path/layout.

## Phase 0 - Audit & Baseline (DONE)
- Scope:
  - Backend/frontend entrypoint, script, Docker, env, path dependency inventari.
- Rollback:
  - Hujjat darajasida; kodga ta'sir yo'q.
- Verification:
  - Root backend: typecheck/build PASS.
  - Frontend: typecheck/build PASS.

## Phase 1 - Frontend Apps Root Start (DONE)
- Scope:
  - `frontend`dan `apps/frontend`ga safe migration start (copy-first, lock fallback).
  - Lint ignorelar uchun yangi pathni qo'shish.
- Expected changes:
  - `apps/frontend` canonical bo'lishga tayyorlanadi.
  - Eski `frontend/` vaqtincha legacy sifatida qolishi mumkin.
- Rollback:
  - `apps/frontend`ni olib tashlash va eski `frontend/`ni ishlatishda davom etish.
- Verification:
  - `apps/frontend`: `npm run typecheck`, `npm run build`.
  - root wrapper: `npm run frontend:typecheck`, `npm run frontend:build`.

### Phase 1 Current Result (2026-02-12)
- `apps/frontend` copy-first migration muvaffaqiyatli boshlandi.
- Lint ignore va root wrapper commandlar qo'shildi.
- Yakuniy cleanupda `frontend/` root legacy to'liq olib tashlandi, aktiv source faqat `apps/frontend`.

## Phase 2 - Backend Move Prep (DONE)
- Scope:
  - `process.cwd()` va root-relative yo'llarni boshqariladigan runtime path helperga o'tkazish.
  - `uploads`, `tools/mediamtx`, `.env` yuklash yo'llari parity check.
- Rollback:
  - Helper importlarini revert qilish.
- Verification:
  - Root backend gates PASS + smoke run.

### Phase 2 Current Result (2026-02-12)
- `src/app/runtime/paths.ts` qo'shildi (`APP_ROOT_DIR` override + `process.cwd()` default parity).
- `uploads/tools/.env` bog'liq kritik nuqtalar helperga o'tkazildi.
- `server.ts` va `src/config.ts` helperga o'tkazilib upload/env parity yakunlandi.
- Root backend gate: typecheck/build/test/lint PASS.

## Phase 3 - Backend to `apps/backend` (DONE)
- Scope:
  - `server.ts`, `src`, `prisma`, `scripts`, backend config fayllarini `apps/backend`ga ko'chirish.
  - Internal relative importlar parityda qoladi.
- Rollback:
  - Move revert (folder-level rollback).
- Verification:
  - `apps/backend`: typecheck/build/test/lint PASS.

### Phase 3 Current Result (2026-02-12)
- `apps/backend` copy-first backend app sifatida yaratildi (`server.ts`, `src`, `prisma`, `scripts`, config fayllar).
- `apps/backend` package backend-only scriptlar bilan tozalandi.
- Root default backend commandlari (`dev/build/typecheck/test/lint/start/db:*`) `apps/backend`ga delegatsiya qilindi.
- Rootdagi util skriptlar va test config ham parityda `apps/backend`ga nusxalandi (`check_schools.ts`, `fix-*`, `update-*`, `seed-today.ts`, `test-camera-stream.ts`, `vitest.config.ts`).
- `apps/backend` gate: `npm ci`, `typecheck/build/test/lint` PASS.

## Phase 4 - Root Wrappers & Deploy Adaptation (DONE)
- Scope:
  - Root `package.json`da backward-compatible wrappers.
  - Dockerfile/compose pathlarini yangi layoutga moslash.
- Rollback:
  - Eski root script va docker pathlarni tiklash.
- Verification:
  - Docker build PASS, compose backend service start PASS.

### Phase 4 Current Result (2026-02-12)
- Root wrapper commandlar qo'shildi: `backend:*`, `frontend:*`.
- Root default backend commandlar ham `apps/backend`ga delegatsiya qilindi (`dev/build/typecheck/test/lint/start/db:*`).
- Docker canonical joylashuvi `apps/backend`ga o'tdi: root `docker-compose.yml` backend build'ni `apps/backend/Dockerfile`ga ulaydi, root `Dockerfile` olib tashlandi.
- Root va app-level gate'lar PASS (`apps/backend` + `apps/frontend`).
- Local muhitda `docker` binary mavjud emas (`docker --version` fail), shu sabab docker runtime verify keyinroq (docker mavjud muhitda) bajariladi.

## Phase 5 - Final Cleanup (DONE)
- Scope:
  - Legacy duplicate pathlarni yopish (`frontend/` va old root backend residue).
  - Docs finalization.
- Verification:
  - Full gate PASS, ochiq checklist qolmasligi.

### Phase 5 Current Result (2026-02-12)
- Legacy root pathlar (`frontend/`, `src/`, `prisma/`, `scripts/`, `server.ts`, root util `*.ts`) dependency auditdan keyin to'liq olib tashlandi.
- Root artifact cleanup ham bajarildi (`.tmp/`, `.cargo-target-sr/`, `target_verify_*`, `image-for-face-id/`, root `dist/`, `tmp_rovodev_*`, `camera-debug.log`).
- Legacy transition qoidasi `legacy-policy.md` bilan yangilandi (canonical source: `apps/backend`, `apps/frontend`).
- Final docs (`tasks.md`, `implementation-plan.md`, `apps-map.md`) sinxron qilindi.
- Full gate PASS; yagona external blocker: docker runtime verify uchun lokal `docker` yo'q.
