# INCIDENT RESPONSE RUNBOOK

## Common Incidents
1. Device connect failures spike
2. Webhook rotate/test failures
3. User recreate failures
4. Config write failures

## Triage Steps
1. Check requestId from UI/API response header
2. Find related `request.completed` log entries
3. Check `/ops/device-metrics`
4. Verify device capability support
5. Retry with read-only probe first

## Recovery
1. Revert last config using `before` snapshot
2. Rotate secrets if leakage suspected
3. Disable config writes for affected model temporarily

## Escalation
1. L1 -> L2 after 15m unresolved
2. L2 -> Engineering owner after 30m unresolved
### Device Import / Sync Failure
1. Verify `syncMode` and selected target devices.
2. Check import job status in Device Detail import modal.
3. Retry failed rows only (`Failedlarni retry`).
4. Validate local credentials for target devices (`online/offline/no credentials`).
5. Review import audit trail entries (`DEVICE_IMPORT_START/FINISH`).
