# Student-Registrator Architecture Map

## Scope
- Module: `apps/student-registrator`
- Stack: React (Vite) + Tauri (Rust)
- Goal: clean architecture boundaries with zero behavior change.

## Frontend Ownership
- `src/app`: bootstrap, providers, router, global style entry
- `src/pages`: route-level composition
- `src/widgets`: large reusable UI blocks
- `src/features`: user workflow/action logic
- `src/entities`: domain UI/model mapping
- `src/shared`: HTTP/IPC clients, hooks, utils, types, constants, media helpers

## Rust Ownership
- `src-tauri/src/app`: tauri builder setup + run lifecycle
- `src-tauri/src/interfaces/tauri`: command handlers + IPC DTO mapping
- `src-tauri/src/application`: use-cases (orchestration)
- `src-tauri/src/domain`: entities/value objects/ports
- `src-tauri/src/infrastructure`: hikvision/client/storage/backend adapters
- `src-tauri/src/shared`: common helpers/result/config

## IPC Boundary
- React side: single wrapper layer via `src/shared/ipc/*`.
- Rust side: `interfaces/tauri/commands/*` only maps request -> application -> response.
- Contract invariants:
  - command names unchanged
  - payload field names unchanged
  - error/fallback semantics unchanged

## Old -> New Mapping

| Old Path | New Path | Strategy |
|---|---|---|
| `apps/student-registrator/src/App.tsx` | `apps/student-registrator/src/app/App.tsx` | old file thin re-export |
| `apps/student-registrator/src/main.tsx` | `apps/student-registrator/src/app/main.tsx` | old file thin proxy |
| `apps/student-registrator/src/api.ts` | `apps/student-registrator/src/shared/http/{constants,debug,session,client,school-types,schools,school-devices,provisioning}.ts`, `apps/student-registrator/src/shared/ipc/{client,types,devices,students,users,provisioning,clone}.ts`, `apps/student-registrator/src/shared/media/{base64,face-encode}.ts` | old `api.ts` thin facade |
| `apps/student-registrator/src/components/layout/*` | `apps/student-registrator/src/widgets/layout/*` | move + barrel API |
| `apps/student-registrator/src/services/excel.service.ts` | `apps/student-registrator/src/shared/excel/{parse.ts,template.ts,index.ts}` | compat re-export |
| `apps/student-registrator/src/utils/*` | `apps/student-registrator/src/shared/lib/*` | thin wrappers kept |
| `apps/student-registrator/src-tauri/src/main.rs` | `apps/student-registrator/src-tauri/src/app/run.rs` + minimal `main.rs` | runtime parity |
| `apps/student-registrator/src-tauri/src/commands.rs` | `apps/student-registrator/src-tauri/src/interfaces/tauri/commands/*` + `apps/student-registrator/src-tauri/src/application/usecases/*` | split by domain |
| `apps/student-registrator/src-tauri/src/hikvision.rs` | `apps/student-registrator/src-tauri/src/infrastructure/hikvision/*` | split adapters |
| `apps/student-registrator/src-tauri/src/storage.rs` | `apps/student-registrator/src-tauri/src/infrastructure/storage/*` | split adapters |
| `apps/student-registrator/src-tauri/src/api.rs` | `apps/student-registrator/src-tauri/src/infrastructure/backend/*` | split adapters |
| `apps/student-registrator/src-tauri/src/types.rs` | `apps/student-registrator/src-tauri/src/domain/entities/*` + `apps/student-registrator/src-tauri/src/interfaces/tauri/dto/*` | type ownership split |

## Current >300 Source Files (tracking)
- `apps/student-registrator/src/pages/DevicesPage.tsx`
- `apps/student-registrator/src/pages/StudentsPage.tsx`
- `apps/student-registrator/src/pages/AddStudentsPage.tsx`
- `apps/student-registrator/src/pages/DeviceDetailPage.tsx`
- `apps/student-registrator/src/hooks/useStudentTable.ts`
- `apps/student-registrator/src/features/add-students/useDeviceModeImport.ts`
- `apps/student-registrator/src/features/device-detail/useDeviceImportWorkflow.ts`
- `apps/student-registrator/src/features/device-detail/DeviceImportModal.tsx`
- `apps/student-registrator/src/index.css`
- `apps/student-registrator/src/styles/table.css`
- `apps/student-registrator/src/styles/pages/students.css`
- `apps/student-registrator/src-tauri/src/commands.rs`
- `apps/student-registrator/src-tauri/src/hikvision.rs`
