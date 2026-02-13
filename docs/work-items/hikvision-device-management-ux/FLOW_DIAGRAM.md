# FLOW DIAGRAM

## Current Flow (As-Is)
1. Device metadata qo'shish
2. Credentials alohida bog'lash
3. Qo'lda deviceId kirish ehtiyoji
4. Webhook read-only ko'rish

## Target Flow (To-Be)
1. Add/Connect bitta oqim
2. IP/port/login/parol -> auto probe
3. `deviceId` auto discovery va backend sync
4. Device Detail (overview/config/users/webhook/sync)
5. Webhook test/rotate shu joyda
