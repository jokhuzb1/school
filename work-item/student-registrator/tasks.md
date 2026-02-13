# Student-Registrator Refactor Tasks

## Meta
- Scope: `apps/student-registrator` (React/Vite + Tauri/Rust)
- Branch: joriy branch (yangi branch yaratilmagan)
- Asosiy qoida: zero behavior change (UI/route/flow/IPC/storage/error semantikasi saqlandi)
- Line-limit qoida: barcha source (`.ts/.tsx/.css/.rs`) <= 300

## Phase Holati
| Phase | Scope | Status | Risk | Done mezon |
|---|---|---|---|---|
| 0 | Work-item bootstrap + baseline | DONE | Baseline yo'qolishi | Arxiv va baseline loglari mavjud |
| 1 | Frontend skeleton + boundary | DONE | import regressiya | `app/pages/widgets/features/entities/shared` skeleton ishlaydi |
| 2 | Shared HTTP/IPC/media split | DONE | API/auth drift | `src/api.ts` thin facade, shared qatlamlar ajratilgan |
| 3 | TS/TSX split <=300 | DONE | page workflow drift | barcha TS/TSX <=300 |
| 4 | CSS split <=300 | DONE | cascade/specificity drift | barcha CSS <=300, import order saqlangan |
| 5 | Rust infra split <=300 | DONE | adapter wiring drift | `hikvision.rs` modul-chunklarga ajratilgan |
| 6 | Rust commands split <=300 | DONE | IPC command drift | `commands.rs` include-chunkga ajratilgan, nom/payload o'zgarmagan |
| 7 | Cleanup + boundary audit | DONE | circular/unused | thin wrappers saqlangan, line-limit tozalangan |
| 8 | Final docs + handoff | DONE | docs eskirishi | root `work-item/*` yangilangan |

## Task Checklist
- [x] Frontend API/IPC/media ajratildi (`src/shared/http/*`, `src/shared/ipc/*`, `src/shared/media/*`)
  - Goal: boundary tozalash
  - Impacted: `apps/student-registrator/src/api.ts`, `apps/student-registrator/src/shared/**`
  - Risk: auth/session drift
  - Done criteria: typecheck PASS, API surface saqlangan

- [x] Yirik frontend page/feature/hook fayllar bo'lindi
  - Goal: modul ownership + <=300
  - Impacted: `apps/student-registrator/src/pages/**`, `apps/student-registrator/src/features/**`, `apps/student-registrator/src/hooks/**`
  - Risk: UI flow regressiya
  - Done criteria: screen behavior o'zgarmadi, typecheck PASS

- [x] Excel service clean split + compat wrapper
  - Goal: `excel.service.ts` monolitni bo'lish
  - Impacted: `apps/student-registrator/src/shared/excel/**`, `apps/student-registrator/src/services/excel.service.ts`
  - Risk: import consumer sinishi
  - Done criteria: eski path thin re-export bo'lib qolgan

- [x] CSS entry fayllar partial importlarga bo'lindi
  - Goal: CSS <=300 va cascade saqlash
  - Impacted: `apps/student-registrator/src/index.css`, `apps/student-registrator/src/styles/layout.css`, `apps/student-registrator/src/styles/table.css`, `apps/student-registrator/src/styles/pages/{students,devices}.css`
  - Risk: selector order drift
  - Done criteria: import order line-by-line saqlangan

- [x] Rust `commands.rs` split
  - Goal: katta command faylni bo'laklash
  - Impacted: `apps/student-registrator/src-tauri/src/commands.rs`, `apps/student-registrator/src-tauri/src/interfaces/tauri/commands/**`
  - Risk: tauri command macro parity
  - Done criteria: command nomlari saqlangan, source <=300

- [x] Rust `hikvision.rs` split
  - Goal: katta client faylni bo'laklash
  - Impacted: `apps/student-registrator/src-tauri/src/hikvision.rs`, `apps/student-registrator/src-tauri/src/infrastructure/hikvision/**`
  - Risk: auth/request flow regressiya
  - Done criteria: source <=300, helper/chunk ajratilgan

- [x] Frontend ownershipni to'liq joyiga tushirish
  - Goal: `widgets/layout`, `shared/lib`, `shared/types`da real ownership; legacy pathlar shim
  - Impacted: `apps/student-registrator/src/widgets/layout/**`, `apps/student-registrator/src/shared/lib/**`, `apps/student-registrator/src/shared/types/**`, `apps/student-registrator/src/components/layout/**`, `apps/student-registrator/src/utils/**`, `apps/student-registrator/src/types/**`
  - Risk: import drift
  - Done criteria: eski import pathlar ishlashi saqlangan, yangi ownership aniq

- [x] Rust clean-layer skelet yakuni + wrapper strategiyasi
  - Goal: `app/application/domain/infrastructure/interfaces/shared` qatlamlarini minimal-risk joriy etish
  - Impacted: `apps/student-registrator/src-tauri/src/main.rs`, `apps/student-registrator/src-tauri/src/app/**`, `apps/student-registrator/src-tauri/src/application/**`, `apps/student-registrator/src-tauri/src/domain/**`, `apps/student-registrator/src-tauri/src/infrastructure/**`, `apps/student-registrator/src-tauri/src/interfaces/**`, `apps/student-registrator/src-tauri/src/shared/**`, `apps/student-registrator/src-tauri/src/{api.rs,storage.rs,types.rs,command_services.rs}`
  - Risk: module wiring regressiya
  - Done criteria: `main.rs` -> `app::run()`, eski modullar thin wrapper, compile PASS

- [x] Global line-limit audit
  - Goal: barcha source fayllar <=300
  - Impacted: `apps/student-registrator/src/**`, `apps/student-registrator/src-tauri/src/**`
  - Risk: yashirin katta fayl qolib ketishi
  - Done criteria: script natijasi `ALL_OK`

## Line-limit Audit
- Command: source line audit (`ts/tsx/css/rs`)  
- Result: `ALL_OK` (300 dan katta source fayl qolmadi)

## Verification Log (phase-by-phase)
| Phase | Command | Result | Izoh |
|---|---|---|---|
| 0/1/2 (old baseline) | `npm run typecheck` | PASS | old loglardan ko'chirilgan |
| 0/1/2 (old baseline) | `npm run build` | PASS | old loglardan ko'chirilgan |
| 0/1/2 (old baseline) | `cargo check` | PASS | old loglardan ko'chirilgan |
| 0/1/2 (old baseline) | `cargo build` | PASS | old loglardan ko'chirilgan |
| 0/1/2 (old baseline) | `npm run build:desktop` | PASS | old loglardan ko'chirilgan |
| 3/4/5/6 yakun | `npm run typecheck` (`apps/student-registrator`) | PASS | joriy refaktordan keyin toza |
| 3/4/5/6 yakun | `npm run build` (`apps/student-registrator`) | FAIL | `vite` config load vaqtida `spawn EPERM` (OS env) |
| 5/6 yakun | `cargo check` (`apps/student-registrator/src-tauri`) | FAIL | `Access is denied (os error 5)` target write/remove bosqichida |
| 5/6 yakun | `cargo build` (`apps/student-registrator/src-tauri`) | FAIL | `Access is denied (os error 5)` |
| 5/6 yakun | `npm run build:desktop` (`apps/student-registrator`) | FAIL | `tauri build --ci`: cargo metadata `Access is denied` |
| Final re-run | `npm run typecheck` (`apps/student-registrator`) | PASS | yakuniy refaktor holati |
| Final re-run | `npm run build` (`apps/student-registrator`) | PASS | CSS split boundary buglar tuzatildi |
| Final re-run | `cargo check` (`apps/student-registrator/src-tauri`) | PASS | clean-layer wrapperlar bilan compile toza |
| Final re-run | `cargo build` (`apps/student-registrator/src-tauri`) | PASS | debug build toza |
| Final re-run | `npm run build:desktop` (`apps/student-registrator`) | PASS | MSI/NSIS bundle yaratildi |

## Blocker Notes (Resolved)
- Oldingi `spawn EPERM` va `os error 5` environment bloklari qayta tekshiruvda kuzatilmadi.
- CSS partial splitdagi 3 ta sintaksis uzilishi (`layout`, `devices`, `index`) tuzatildi.
- `register_student_body_{1,2,3}.rs` dead chunklar o'chirildi (reference yo'q edi).

## Backend Relocation Impact (`apps/backend`)
- Xulosa: student-registrator runtime jihatdan backend fayl yo'liga bog'liq emas; HTTP endpoint orqali ishlaydi (`VITE_BACKEND_URL`).
- Ta'sir maydoni: monorepo ichidagi backendning fizik joylashuvi o'zgargani student-registrator IPC/UI logikasini o'zgartirmaydi.
- Ehtiyot nuqta: lokal backend port/host o'zgarsa, `apps/student-registrator/.env`dagi `VITE_BACKEND_URL` mos qiymatda bo'lishi shart (masalan `http://localhost:5000`).
