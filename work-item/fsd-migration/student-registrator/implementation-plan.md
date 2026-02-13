# Student-Registrator Implementation Plan

## Principles
- Zero behavior change: UI/route flow, IPC contract, storage semantics, error semantics saqlanadi.
- Refactor only: move/split/re-export, yangi feature yo'q.
- 300-line rule: all source files (`.ts/.tsx/.rs/.css`) <=300.
- Verification gate after each phase:
  - `npm run typecheck`
  - `npm run build`
  - `cargo check`
  - `cargo build`
  - `npm run build:desktop`

## Phase 0 - Work-item bootstrap + baseline (DONE)
- Scope:
  - Eski root backend hujjatlarini arxivlash (`work-item/archive/backend-ddd/*`).
  - Root deliverablelarni yaratish (`work-item/tasks.md`, `work-item/implementation-plan.md`, `work-item/architecture-map.md`).
  - Baseline build/check loglarini yig'ish.
- Rollback:
  - Arxiv va docs commitini revert.
- Verification:
  - 5/5 PASS.

## Phase 1 - Frontend skeleton + boundary (DONE)
- Scope:
  - `src/app`, `src/pages`, `src/widgets`, `src/features`, `src/entities`, `src/shared` folder ownership.
  - `App.tsx`, `main.tsx` thin proxyga o'tkazish.
  - Alias/lint boundary qo'shish.
- Expected changes:
  - Import yo'nalishi qatlam bo'yicha aniq bo'ladi.
- Rollback:
  - Skeleton va configlar alohida commitlarda.
- Verification:
  - 5/5 PASS.
  - `npm run typecheck` PASS
  - `npm run build` PASS
  - `cargo check` PASS
  - `cargo build` PASS
  - `npm run build:desktop` PASS

## Phase 2 - Shared HTTP/IPC/media split (DONE)
- Scope:
  - `src/api.ts`ni shared qatlamlarga bo'lish.
  - Eski `src/api.ts` va `src/api/*`da thin facade saqlash.
- Expected changes:
  - Public API surface o'zgarmaydi, internal ownership tozalanadi.
- Rollback:
  - Domain-by-domain split commitlari (`http`, `ipc`, `media`).
- Verification:
  - 5/5 PASS.
  - `npm run typecheck` PASS
  - `npm run build` PASS
  - `cargo check` PASS
  - `cargo build` PASS
  - `npm run build:desktop` PASS

## Phase 3 - TS/TSX split <=300
- Scope:
  - `pages/*`, `features/*`, `hooks/*`, `services/excel.service.ts`ni bo'lish.
- Expected changes:
  - UI logic bo'laklanadi, behavior saqlanadi.
- Rollback:
  - Har katta fayl uchun alohida commit.
- Verification:
  - 5 ta command.

## Phase 4 - CSS split <=300
- Scope:
  - `index.css`, `layout.css`, `table.css`, `students.css`, `devices.css` partiallarga bo'linadi.
- Expected changes:
  - selector/specificity/import order saqlanadi.
- Rollback:
  - Har CSS entry alohida commit.
- Verification:
  - 5 ta command + vizual smoke.

## Phase 5 - Rust skeleton + infra split
- Scope:
  - `app/interfaces/tauri/application/domain/infrastructure/shared` strukturasi.
  - `hikvision`, `storage`, `api`, `types` split.
- Expected changes:
  - Business orchestration va adapterlar ajraladi.
- Rollback:
  - Har modul split alohida commit.
- Verification:
  - 5 ta command.

## Phase 6 - Rust commands/usecases split
- Scope:
  - `commands.rs` -> `interfaces/tauri/commands/*` + `application/usecases/*`.
  - `main.rs` minimal runner.
- Expected changes:
  - Command names/payload mapping 1:1 saqlanadi.
- Rollback:
  - Command guruhlari bo'yicha commit.
- Verification:
  - 5 ta command.

## Phase 7 - Cleanup + boundary audit
- Scope:
  - Dead code tozalash, circular dep kamaytirish, shimlarni audit qilish.
- Verification:
  - 5 ta command.

## Phase 8 - Final docs
- Scope:
  - `tasks.md`, `implementation-plan.md`, `architecture-map.md`ni yakunlash.
- Verification:
  - Docs consistency + path coverage.

## Risk Controls
- IPC drift: command nomlari va payload fieldlari ustida parity checklist yuritiladi.
- Style drift: CSS import order lock qilinadi, partial splitda selectorlar ko'chiriladi.
- Auth/session drift: `sessionStorage/localStorage` oqimi aynan saqlanadi.
- Coupling risk: thin shimlar orqali incremental migration.
