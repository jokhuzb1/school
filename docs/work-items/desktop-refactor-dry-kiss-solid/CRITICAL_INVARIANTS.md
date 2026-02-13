# CRITICAL INVARIANTS

## Save Policy Contract
1. `targetDeviceIds === undefined` -> legacy/default behavior.
2. `targetDeviceIds === []` -> explicit DB-only, no local device push.
3. `targetDeviceIds.length > 0` -> only selected devices are targeted.

## Device Resolution Contract
1. Resolver match order:
   - `backendId` exact match
   - fallback `deviceId` normalized match
2. If resolver fails, operation returns standard device error code:
   - `DEVICE_NOT_FOUND`
   - `LOCAL_CREDENTIALS_NOT_FOUND`
   - `CREDENTIALS_EXPIRED`

## Import Contract
1. Device-user import must normalize names with shared function.
2. Dedupe key priority:
   - normalized `employeeNo`
   - fallback normalized `name`
3. If duplicate conflict occurs, keep the preferred row:
   - row with face first
   - then row with richer name text

## Metrics Contract
Every import summary must use a single format:
- `total`
- `duplicates`
- `success`
- `failed`
- `sync`
- `face success/face candidates`

## Failure Handling Contract
1. Operation failures must surface actionable text.
2. Device-resolution related failures must include standard code prefix.
3. Import retries cannot run in parallel with active import job in same page state.
