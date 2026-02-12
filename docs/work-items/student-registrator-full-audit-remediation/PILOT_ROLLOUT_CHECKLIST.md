# Pilot Rollout Checklist - Student Registrator

## Pre-Rollout
- [ ] Build artifacts generated from `chore/student-registrator-full-audit-remediation`.
- [ ] Static gates green (`lint`, `typecheck`, `build`, `cargo check`, `cargo clippy`).
- [ ] Smoke checklist executed once on staging-like environment.
- [ ] Incident and rollback owners assigned.

## Pilot Scope
- [ ] 1-2 schools with limited admins/teachers.
- [ ] At least 2 devices per pilot school (one online, one fallback scenario).

## Runtime Monitoring (First 48h)
- [ ] Login failure rate.
- [ ] Register/import success rate.
- [ ] Provisioning retry count.
- [ ] Device connectivity error volume.
- [ ] UI regression reports (a11y/keyboard).

## Exit Criteria
- [ ] No SEV1 incident.
- [ ] Import success stable against baseline.
- [ ] No unmasked secret/token leakage reports.
- [ ] Pilot sign-off from QA + security + product owner.
