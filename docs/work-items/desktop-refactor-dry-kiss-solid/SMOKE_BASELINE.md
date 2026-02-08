# SMOKE BASELINE

## Date
- 2026-02-07

## Automated Baseline
- `npm run typecheck` -> PASS
- `npm run lint` -> PASS
- `cargo check` (`apps/student-registrator/src-tauri`) -> PASS

## Structural Baseline
- `DeviceDetailPage.tsx` reduced below target:
  - current: `630` lines
  - target: `< 700`
- `AddStudentsPage.tsx` below target:
  - current: `664` lines
  - target: `< 700`

## Refactor Baseline Notes
- Shared resolver and import normalization modules are in use.
- Standard device error code messages are used in import-facing flows.
- Legacy dead components removed from students feature set.
