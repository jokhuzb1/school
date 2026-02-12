# RISK REGISTER - Student Registrator Full Audit Remediation

Date: 2026-02-11

## Active Risks

1. Large-scope refactor drift across frontend + tauri contracts.
- Impact: High
- Mitigation: Keep compatibility, run `typecheck/lint/build/cargo/clippy` on each batch.

2. Modal accessibility regressions in remaining legacy dialogs.
- Impact: Medium
- Mitigation: Standardize on `useModalA11y` and cover remaining dialogs incrementally.

3. Sensitive payload leakage through ad-hoc logs.
- Impact: High
- Mitigation: Use `redactSensitiveData` for payload rendering and debug report generation.

4. Runtime behavior drift from replacing `confirm/alert`.
- Impact: Medium
- Mitigation: Manual smoke around delete/import/error feedback flows.

5. Performance regressions from heavy Excel operations.
- Impact: Medium
- Mitigation: Keep `exceljs` lazy chunking and monitor build outputs.

## Ownership Model

1. Frontend: UX/a11y, TS contracts, performance.
2. Tauri/Rust: clippy-safe command layer and panic-safe paths.
3. QA: smoke checklist execution and regression sign-off.
4. Security reviewer: redaction and sensitive-data policy sign-off.
