# Student-Registrator Refactor Tasks

## Meta
- Scope: `apps/student-registrator` (React + Tauri/Rust) clean architecture refactor.
- Branch: current branch only; no new branch.
- Rule: zero behavior change (UI, routes, IPC contract, storage semantics, error semantics).
- 300-line rule: all source files (`.ts/.tsx/.rs/.css`) <= 300 lines, generated artifacts excluded.

## Phase Status

| Phase | Goal | Status | Risks | Done Criteria |
|---|---|---|---|---|
| 0 | Work-item bootstrap + archive + baseline | DONE | Baseline noto'g'ri bo'lsa regressiya chalkashadi | Archive tayyor, root deliverablelar yaratilgan, 5 ta verification log yozilgan |
| 1 | Frontend skeleton + boundary enforce | DONE | Import alias/regression | `src/app/pages/widgets/features/entities/shared` + lint boundary ishlaydi |
| 2 | Frontend API/IPC split + compat | DONE | Auth/session/error drift | `src/api.ts` thin facade, shared http/ipc/media qatlamlari ishlaydi |
| 3 | Frontend big file split (TS/TSX) | TODO | Page behavior drift | Barcha TS/TSX fayl <=300 |
| 4 | CSS split | TODO | Style cascade drift | Barcha CSS <=300, selector specificity saqlangan |
| 5 | Rust skeleton + infra split | TODO | Module wiring drift | Rust qatlamlari ajratilgan, behavior saqlangan |
| 6 | Rust commands/usecase split | TODO | IPC contract drift | Command nom/payload/error 1:1, barcha `.rs` <=300 |
| 7 | Cleanup + boundary audit | TODO | Circular deps | Dead code tozalangan, boundary qoidalari bajarilgan |
| 8 | Final docs + handoff | TODO | Noto'liq mapping | `tasks.md`, `implementation-plan.md`, `architecture-map.md` to'liq |

## Task Checklist

- [x] T0.1 Root `work-item` hujjatlarini arxivlash.
  - Goal: eski backend hujjatlari yo'qolmasligi.
  - Files: `work-item/archive/backend-ddd/*`.
  - Status: DONE
  - Risk: eski kontentni yo'qotish.
  - Done: arxiv fayllari yaratildi.

- [x] T0.2 Student-registrator root deliverablelarni yaratish.
  - Goal: bu modul uchun yangi hujjat bazasi.
  - Files: `work-item/tasks.md`, `work-item/implementation-plan.md`, `work-item/architecture-map.md`.
  - Status: DONE
  - Risk: noto'liq scope.
  - Done: fayllar yaratildi va boshlang'ich kontent yozildi.

- [x] T0.3 Baseline verification.
  - Goal: refaktor oldi real holatni qayd etish.
  - Files: none (verification only).
  - Status: DONE
  - Risk: yo'q.
  - Done: 5 ta build/check command natijasi yozildi.

- [x] T1.1 Frontend arxitektura skeletini yaratish va entrypointlarni app qatlamiga ko'chirish.
  - Goal: app/page/widget/entity/shared ownershipni aniq ajratish.
  - Files: `apps/student-registrator/src/app/*`, `apps/student-registrator/src/App.tsx`, `apps/student-registrator/src/main.tsx`.
  - Status: DONE
  - Risk: entrypoint regressiya.
  - Done: `App.tsx` va `main.tsx` thin proxy, real bootstrap `src/app/*`ga ko'chdi.

- [x] T1.2 Alias + lint boundary qoidalarini qo'shish.
  - Goal: qatlamlararo import yo'nalishini nazorat qilish.
  - Files: `apps/student-registrator/tsconfig.app.json`, `apps/student-registrator/vite.config.ts`, `apps/student-registrator/eslint.config.js`.
  - Status: DONE
  - Risk: noto'g'ri alias sabab import xatolari.
  - Done: aliaslar ishladi, typecheck/build PASS.

- [x] T2.1 `src/api.ts` ni shared http/ipc/media qatlamlariga bo'lish.
  - Goal: monolit API faylni clean boundary bo'yicha ajratish.
  - Files: `apps/student-registrator/src/shared/http/*`, `apps/student-registrator/src/shared/ipc/*`, `apps/student-registrator/src/shared/media/*`, `apps/student-registrator/src/api.ts`.
  - Status: DONE
  - Risk: auth/session/error semantik drift.
  - Done: `src/api.ts` thin facade, barcha funksiyalar yangi qatlamlardan re-export.

- [x] T2.2 `src/api/*` va eski import yo'llari uchun thin shimlarni saqlash.
  - Goal: backward compatibilityni buzmaslik.
  - Files: `apps/student-registrator/src/api/{index,auth,devices,students,provisioning,images}.ts`.
  - Status: DONE
  - Risk: test/import consumerlar sinishi.
  - Done: wrapperlar re-export rejimida saqlandi.

- [ ] T3.1 Yirik page/hook/feature fayllarni <=300 ga tushirish.
- [ ] T4.1 CSS fayllarni partiallarga bo'lib <=300 ga tushirish.
- [ ] T5.1 Rust clean architecture skeletini yaratish.
- [ ] T5.2 `hikvision.rs`, `storage.rs`, `api.rs`, `types.rs` split.
- [ ] T6.1 `commands.rs` ni interfaces/application/usecase qatlamlariga bo'lish.
- [ ] T6.2 `main.rs` ni `app::run()` style ga tushirish.
- [ ] T7.1 Dead code/circular dep cleanup.
- [ ] T8.1 Yakuniy docs va mappingni to'ldirish.

## Verification Log

| Phase | Command | Result | Notes |
|---|---|---|---|
| 0 | `npm run typecheck` (`apps/student-registrator`) | PASS | `tsc -p tsconfig.app.json --noEmit` muvaffaqiyatli |
| 0 | `npm run build` (`apps/student-registrator`) | PASS | `tsc -b && vite build` muvaffaqiyatli |
| 0 | `cargo check` (`apps/student-registrator/src-tauri`) | PASS | Rust check muvaffaqiyatli |
| 0 | `cargo build` (`apps/student-registrator/src-tauri`) | PASS | Rust build muvaffaqiyatli |
| 0 | `npm run build:desktop` (`apps/student-registrator`) | PASS | MSI + NSIS bundle yaratildi |
| 1 | `npm run typecheck` (`apps/student-registrator`) | PASS | App skeleton + alias bilan typecheck o'tdi |
| 1 | `npm run build` (`apps/student-registrator`) | PASS | Frontend build o'tdi |
| 1 | `cargo check` (`apps/student-registrator/src-tauri`) | PASS | Rust tomoni regressiyasiz |
| 1 | `cargo build` (`apps/student-registrator/src-tauri`) | PASS | Rust build o'tdi |
| 1 | `npm run build:desktop` (`apps/student-registrator`) | PASS | Desktop bundle yaratildi |
| 2 | `npm run typecheck` (`apps/student-registrator`) | PASS | `src/api.ts` splitdan keyin typecheck o'tdi |
| 2 | `npm run build` (`apps/student-registrator`) | PASS | `shared/http|ipc|media` bilan build o'tdi |
| 2 | `cargo check` (`apps/student-registrator/src-tauri`) | PASS | Frontend refaktor Rust buildga ta'sir qilmadi |
| 2 | `cargo build` (`apps/student-registrator/src-tauri`) | PASS | Rust build o'tdi |
| 2 | `npm run build:desktop` (`apps/student-registrator`) | PASS | MSI + NSIS bundle qayta yaratildi |
