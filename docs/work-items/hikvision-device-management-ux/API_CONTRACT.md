# API CONTRACT DRAFT

## Desktop <-> Tauri
1. `probe_device_connection(host, port, username, password)`
2. `test_device_connection(deviceId)`
3. `fetch_users(deviceId, offset, limit)`
4. `delete_user(deviceId, employeeNo)`
5. `recreate_user(...)`

## Desktop <-> Backend
1. `GET /schools/:schoolId/devices`
2. `POST /schools/:schoolId/devices`
3. `PUT /devices/:id`
4. `GET /devices/:id/webhook-health`
5. `POST /schools/:id/webhook/rotate`
6. `POST /schools/:id/webhook/test`

## Error Model (UI mapping)
1. `409 deviceId already exists`
2. `400 direction must be in|out`
3. User ops: `not found`, `duplicate`, `upload failed`
