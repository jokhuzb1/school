# Release Notes - Student Registrator Full Audit Remediation

## Date
2026-02-11

## Highlights
1. Security hardening:
- Redaction layer for sensitive fields in logs/debug payloads.
- Auth session moved to memory + `sessionStorage` with legacy localStorage migration cleanup.
2. Stability:
- Rust panic-risk points removed from runtime paths.
- Clippy and frontend quality gates stabilized.
3. UX/a11y:
- `alert/confirm` replaced by in-app modal/toast UX.
- Modal keyboard behavior standardized, toast semantics improved.
4. Data/import quality:
- Device import dedupe/shared metrics utilities consolidated.
- Device status derivation standardized via shared helper.
5. Testing:
- Added unit tests for redaction and device helper logic.

## Compatibility
- No backend schema migration required for this release.
- Existing local credentials remain readable.
- Existing auth sessions from localStorage are auto-migrated to session scope.

## Known Limitations
- `api.ts` and `commands.rs` are still large and scheduled for deeper modular split in next cycle.
