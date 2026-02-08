# TEST MATRIX

## Happy Path
1. Add device with credentials, no deviceId -> auto discover
2. Open device detail page
3. Fetch users, recreate, delete
4. Webhook test + rotate
5. Clone DB->Device and Device->Device

## Negative Path
1. Wrong credentials
2. Offline device
3. Duplicate deviceId
4. Missing local credentials on detail actions

## Edge Cases
1. deviceId discovered but backend conflict
2. User without face
3. Webhook secret hidden/revealed state
