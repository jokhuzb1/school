# Security Checklist - Student Registrator Hardening

## Auth and Session
- [x] Auth token no longer relies on persistent localStorage by default.
- [x] Legacy localStorage auth keys are migrated and cleared.
- [x] Logout clears memory/session and legacy storage remnants.

## Secrets and Logs
- [x] Redaction utility masks token/password/secret/biometric-like fields.
- [x] API debug reports use redacted values.
- [x] User-facing errors avoid raw sensitive payload dumps.

## Local Credentials
- [x] Device credentials remain local-only and are not sent to backend as plaintext profile metadata.
- [x] Expiry policy enforced for local credentials.
- [ ] At-rest encryption for `devices.json` (planned next phase).

## Transport and API
- [x] Request timeout handling and normalized API errors in place.
- [x] Audit/diagnostic flows prevent obvious secret leak paths.
- [x] Critical panic paths in Tauri runtime removed.

## Verification
- [x] Redaction unit tests added.
- [x] Security checklist reviewed with remediation notes.
