# SMOKE CHECKLIST - Student Registrator

Date: 2026-02-11  
Branch: `chore/student-registrator-full-audit-remediation`

## Critical Flows

- [ ] Login with valid credentials
- [ ] Login with invalid credentials (error shown)
- [ ] Devices page opens and backend devices load
- [ ] Device connection test action works
- [ ] Add Students page opens and classes/devices load
- [ ] Excel import (valid file) works
- [ ] Excel import (invalid extension) shows toast error
- [ ] Save single student works
- [ ] Save all pending works
- [ ] Students diagnostics page loads and live check works
- [ ] Device Detail page loads users/config/sync tabs
- [ ] Audit Logs page loads and payload modal opens/closes with ESC
- [ ] Retry from Audit log works for failed records

## Non-Functional Sanity

- [ ] Keyboard can close modals with ESC
- [ ] Modal focus stays inside dialog while tabbing
- [ ] Icon-only actions are screen-reader labeled
- [ ] Toast messages are announced (`aria-live`)
