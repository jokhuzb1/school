# RELEASE NOTES (Draft)

## Added
1. Unified Add/Connect flow with auto device discovery
2. Device Detail page with tabs (overview/config/users/webhook/sync)
3. Webhook rotate/test actions
4. Device webhook health endpoint integration
5. User management improvements (delete/recreate, load more)

## Backend
1. `deviceId` conflict returns explicit 409
2. Webhook management endpoints for schools
3. Provisioning auth token fallback support

## Security
1. Hikvision debug logs disabled in production builds
