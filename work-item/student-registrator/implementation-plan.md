# Student-Registrator Implementation Plan (Final)

## Asosiy Invariantlar
- UI/route/flow/interaction o'zgarmaydi
- Tauri command nomi/payload/error semantikasi o'zgarmaydi
- Storage/local side-effect semantikasi o'zgarmaydi
- Faqat move/split/refactor

## Fazalar va Yakuniy Holat

### Phase 0 - Bootstrap + baseline
- Scope: arxiv + deliverable tayyorlash
- Status: DONE
- Rollback: docs commit revert
- Verification: historical 5/5 PASS

### Phase 1 - Frontend skeleton + boundary
- Scope: `app/pages/widgets/features/entities/shared` ownership
- Status: DONE
- Rollback: skeleton/config commit revert
- Verification: historical 5/5 PASS

### Phase 2 - API/IPC split + compat
- Scope: `src/api.ts` -> `shared/http|ipc|media`
- Status: DONE
- Rollback: domain-by-domain revert
- Verification: historical 5/5 PASS

### Phase 3 - TS/TSX split <=300
- Scope: page/hook/feature split
- Status: DONE
- O'zgarishlar:
  - `DevicesPage`, `StudentsPage`, `DeviceDetail` view/actions/effects split
  - `useDeviceModeImport`, `useDeviceImportWorkflow`, `useStudentTable` split
  - `excel.service.ts` -> `shared/excel/*` + thin wrapper
- Verification:
  - `npm run typecheck` PASS
  - `npm run build` PASS

### Phase 4 - CSS split <=300
- Scope: `index.css`, `layout.css`, `table.css`, `students.css`, `devices.css`
- Status: DONE
- O'zgarishlar: entry fayllar `@import` partiallarga bo'lindi
- Verification:
  - `npm run typecheck` PASS
  - `npm run build` PASS (boundary syntax fixlar bilan)

### Phase 5 - Rust infra split <=300
- Scope: `hikvision.rs` chunk split
- Status: DONE
- O'zgarishlar: `src-tauri/src/infrastructure/hikvision/*` include-chunklar
- Verification:
  - `cargo check` PASS
  - `cargo build` PASS

### Phase 6 - Rust commands split <=300
- Scope: `commands.rs` chunk split + register helper extraction
- Status: DONE
- O'zgarishlar:
  - `src-tauri/src/interfaces/tauri/commands/*`
  - `register_student` `prepare` + `device-process` helperlarga ajratildi
- Verification:
  - `cargo check` PASS
  - `cargo build` PASS

### Phase 7 - Cleanup + boundary audit
- Scope: dead/import cleanup + line-limit audit
- Status: DONE
- Verification:
  - line audit: `ALL_OK`
  - dead chunk cleanup: `register_student_body_{1,2,3}.rs` o'chirildi

### Phase 8 - Final docs + handoff
- Scope: root deliverablelarni finalga keltirish
- Status: DONE

## Rollback Strategy (umumiy)
- Har split kichik commitlarga bo'linadi
- Xatolikda oxirgi modul bo'yicha revert
- Thin wrappers saqlangani uchun import rollback xavfi past

## Yakuniy Verification Matrisa
| Command | Natija | Izoh |
|---|---|---|
| `npm run typecheck` | PASS | joriy holatda toza |
| `npm run build` | PASS | Vite production build muvaffaqiyatli |
| `cargo check` | PASS | Rust check muvaffaqiyatli |
| `cargo build` | PASS | Rust debug build muvaffaqiyatli |
| `npm run build:desktop` | PASS | MSI/NSIS bundle muvaffaqiyatli |

## Backend Relocation Impact
- `apps/backend`ga ko'chirish student-registrator kodining ichki boundary/refaktoriga to'g'ridan-to'g'ri ta'sir qilmadi.
- Integration kontrakti URL-based bo'lib qolgan (`VITE_BACKEND_URL`), shuning uchun fizik katalog ko'chishi behavior o'zgartirmaydi.
- Faqat deployment/dev muhitda backend host/port o'zgarsa `.env` qiymatini yangilash talab etiladi.
