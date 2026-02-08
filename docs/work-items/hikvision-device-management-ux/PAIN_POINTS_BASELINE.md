# PAIN POINTS AND BASELINE

## Pain Points
1. Manual `deviceId` talab qilinishi onboardingni sekinlashtiradi.
2. Add va credentials alohida bo'lgani uchun operator adashadi.
3. Qurilma ichki user management alohida oqimlarda tarqalgan.
4. Webhook management oldin read-only bo'lgan.

## Baseline (Before)
1. New device onboarding: 2 ta modal + manual id.
2. Device detail page: yo'q.
3. Webhook action (test/rotate): yo'q.

## Current (After this implementation)
1. Add/Connect unified.
2. Auto `deviceId` discovery mavjud.
3. Device detail page mavjud.
4. Webhook test/rotate + secret reveal/copy mavjud.
