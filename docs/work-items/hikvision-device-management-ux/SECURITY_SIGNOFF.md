# SECURITY SIGN-OFF CHECKLIST

## Must-Have Controls
- [x] Secrets masked by default in UI
- [x] Webhook secret rotate supported
- [x] Webhook test endpoint gated by auth
- [x] Production-safe Hikvision debug logging
- [x] Provisioning token auth fallback implemented
- [x] deviceId conflict protection (409)
- [x] Capability check before config write
- [x] Snapshot before config write

## Residual Risk
- [ ] Local credential at-rest encryption (phase-2)
