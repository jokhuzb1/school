# Student Registrator Architecture (Current-State)

## 1. Frontend Boundaries (`apps/student-registrator/src`)
- `pages/*`: orchestration layer (routing-level state, API composition, modal lifecycle).
- `features/*`: flow-specific use-cases:
  - `add-students/*`: device-mode import and selection.
  - `device-detail/*`: users/device import wizard and sync controls.
  - `students/*`: edit workflow.
- `components/*`: presentational/UI composition.
- `hooks/*`: reusable client behaviors (table state, a11y modal control, toasts).
- `services/*`: heavier non-UI operations (Excel parsing/template build).
- `utils/*`: shared pure helpers (`deviceResolver`, `deviceStatus`, `name`, `photo`, `redact`, `logger`).

## 2. Backend/Tauri Boundary (`apps/student-registrator/src-tauri/src`)
- `commands.rs`: Tauri command handlers and orchestration.
- `hikvision.rs`: Hikvision HTTP/client operations.
- `api.rs`: backend REST client.
- `storage.rs`: local device credential persistence (`devices.json`).
- `types.rs`: transport and domain structs.
- `main.rs`: command registration and app bootstrap.

## 3. Contract Model
- Frontend uses:
  - REST for school/domain data (`fetchWithAuth` paths via `BACKEND_URL`).
  - Tauri `invoke` for local-device operations (register/check/import/clone).
- Error model:
  - frontend `ApiRequestError` (`NETWORK_ERROR`, `REQUEST_TIMEOUT`, `HTTP_ERROR`, `INVALID_RESPONSE`).
  - domain-facing normalized error messages in flows (`useStudentTable`, device import hooks).
- Security model:
  - auth token/user stored in memory + `sessionStorage` (legacy localStorage auto-migrated then removed).
  - payload/log redaction via `utils/redact.ts`.

## 4. Design Decisions Applied in This Work Item
- Removed panic points in Rust (`unwrap/expect`) from runtime paths.
- Standardized modal keyboard/a11y behavior through `useModalA11y`.
- Replaced browser blocking dialogs (`alert/confirm`) with app modal/toast patterns.
- Introduced canonical device status helper (`utils/deviceStatus.ts`) for consistent UI behavior.
- Added focused unit coverage for redaction and device import/resolution helpers.

## 5. Remaining Refactor Direction
- `src/api.ts` and `src-tauri/src/commands.rs` remain large orchestration surfaces.
- Next extraction target:
  - `api.auth.ts`, `api.devices.ts`, `api.students.ts`, `api.provisioning.ts`.
  - `commands/*` split by domain (devices, students, sync, clone).
