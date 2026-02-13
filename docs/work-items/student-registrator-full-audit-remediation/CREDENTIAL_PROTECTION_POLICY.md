# Local Credential Protection Policy (At-Rest)

## Scope
- File: local `devices.json` (desktop-side device credentials).
- Data class: sensitive (`host`, `username`, `password`, `deviceId`, expiration metadata).

## Current Enforcement (This Release)
1. Credentials are kept local-only (not stored in backend device metadata paths).
2. Expiry policy is enforced in runtime checks (`credentialsExpiresAt`).
3. Operational controls:
   - desktop profile directory permissions are inherited from OS user profile.
   - incident/runbook process requires credential rotation on compromise suspicion.
4. Security sign-off requires redaction and no credential leakage in logs/debug payloads.

## Encryption Policy Decision
- Baseline decision: move to OS-backed encryption wrapper for `devices.json` in next hardening iteration.
- Accepted temporary risk for this release:
  - plaintext-at-rest risk remains if local user profile is compromised.
  - mitigated by short credential TTL and operational rotation.

## Required Next Step
1. Implement OS-backed encryption/decryption adapter in Tauri storage layer.
2. Add migration for existing plaintext file to encrypted format.
3. Add smoke test:
   - save credential
   - restart app
   - read credential successfully
   - verify file content is no longer plaintext.
