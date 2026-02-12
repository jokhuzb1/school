# Rollback Playbook - Student Registrator Hardening

## Trigger Conditions
- New release causes `SEV1` incident.
- Import/register success rate drops below pilot threshold.
- Device sync failures increase significantly after deploy.

## Rollback Steps
1. Freeze new deployments and notify stakeholders.
2. Revert desktop artifact to last known stable version.
3. Validate app launch and login on pilot environment.
4. Run smoke checks:
   - Login
   - Add Students (manual + Excel)
   - Device connection test
   - Register + provisioning retry
   - Audit logs page.
5. Keep rollback release pinned until corrective patch is verified.

## Data Safety Notes
- Desktop rollback does not mutate backend schema.
- No destructive migration is tied to this work item.
- Local credential file remains user-scoped and backward compatible.

## Verification Gate
- Lint/type/build/clippy green on rollback branch.
- Manual smoke pass from `SMOKE_CHECKLIST.md`.
- Incident commander sign-off.
