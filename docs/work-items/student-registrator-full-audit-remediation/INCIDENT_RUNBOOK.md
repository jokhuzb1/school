# Incident Runbook - Student Registrator Hardening

## Scope
- Desktop app failures around:
  - device sync/register/import
  - provisioning rollback/retry
  - auth/session failures
  - audit log visibility

## Severity
- `SEV1`: register/import fully blocked across schools.
- `SEV2`: partial degradation (specific devices or flows).
- `SEV3`: non-blocking UI/a11y/performance degradation.

## First 15 Minutes
1. Confirm impacted flow and school ID.
2. Collect desktop diagnostics:
   - in-app debug report copy
   - latest app logs (redacted)
   - screenshot/video for UI failure.
3. Verify backend reachability and auth validity.
4. Check device credentials state:
   - missing/expired credentials
   - network path to Hikvision hosts.

## Triage Matrix
- Auth errors (`401/403`, login loops):
  - force logout/login, confirm role (`SCHOOL_ADMIN`/`TEACHER`).
- Device errors (`RequestFailed`, face upload failures):
  - run connection test, verify host/port/user/password.
- Import failures:
  - verify class mapping and duplicate employee numbers.
- Provisioning stuck:
  - run retry flow and inspect per-device result errors.

## Immediate Mitigation
1. Disable risky operation path (clone/import batch) for affected school.
2. Switch to manual/student-by-student register flow.
3. Re-enter credentials for expired local devices.
4. If release regression suspected, execute rollback playbook.

## Evidence Checklist
- Timestamp (UTC), school ID, user role, app version.
- Error message + debug ID (if available).
- Affected device IDs/backend IDs.
- Repro steps and last known good behavior.

## Closure Criteria
- Critical flow restored in smoke checklist.
- Root cause documented with corrective action owner/date.
- Post-incident risk entry updated in `RISK_REGISTER.md`.
