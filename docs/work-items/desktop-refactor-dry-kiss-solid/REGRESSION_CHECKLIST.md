# REGRESSION CHECKLIST

## Scope
- `Devices` page
- `Device Detail` page
- `Add Students` page
- `Students` page

## Devices
- [ ] Backend device list loads
- [ ] Local credentials bind to backend devices
- [ ] Test connection works
- [ ] Clone DB -> device works
- [ ] Clone device -> device works
- [ ] Credentials expiry state is visible/handled

## Device Detail
- [ ] Tabs switch without state corruption
- [ ] Users list pagination works
- [ ] User detail modal opens/closes reliably
- [ ] DB + device edit works
- [ ] Webhook test/rotate actions work
- [ ] Config save endpoints work (`time`, `ntpServers`, `networkInterfaces`)
- [ ] Device import modal opens and processes rows

## Add Students
- [ ] Excel import works
- [ ] Device mode import works with single source
- [ ] Device mode import works with multi-source
- [ ] Duplicate device users are deduped consistently
- [ ] Save-all with selected devices works
- [ ] Save-all with no selected devices remains DB-only

## Students
- [ ] Diagnostics table sort/selection works
- [ ] Live check per student works
- [ ] Edit modal save works
- [ ] Edit sync-to-devices feedback is shown

## Pass Rule
- No runtime exception in desktop UI
- No blocking data-loss bug
- No regression in DB-only provisioning policy
