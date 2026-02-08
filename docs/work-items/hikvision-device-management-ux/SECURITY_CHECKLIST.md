# SECURITY CHECKLIST

## Implemented
- [x] Hikvision debug log prod-safe (`cfg!(debug_assertions)`)
- [x] Webhook secret rotate action + audit
- [x] Secret reveal/hide default masking
- [x] Provisioning token auth fallback

## Planned Phase-2
- [ ] Local credentials encryption at rest
- [ ] OS keychain integration
