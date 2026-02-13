#[tauri::command]
pub async fn get_provisioning(
    provisioning_id: String,
    backend_url: Option<String>,
    backend_token: Option<String>,
) -> Result<Value, String> {
    let backend_url = backend_url.filter(|v| !v.trim().is_empty())
        .ok_or("backendUrl is required")?;
    let backend_token = backend_token.filter(|v| !v.trim().is_empty());
    let client = ApiClient::new(backend_url, backend_token);
    client.get_provisioning(&provisioning_id).await
}

#[tauri::command]
pub async fn retry_provisioning(
    provisioning_id: String,
    backend_url: Option<String>,
    backend_token: Option<String>,
    device_ids: Option<Vec<String>>,
) -> Result<Value, String> {
    let backend_url = backend_url.filter(|v| !v.trim().is_empty())
        .ok_or("backendUrl is required")?;
    let backend_token = backend_token.filter(|v| !v.trim().is_empty());
    let client = ApiClient::new(backend_url, backend_token);
    let requested_device_ids = device_ids.unwrap_or_default();

    // 1) Reset failed links to PENDING/PROCESSING on backend.
    let retry_result = client
        .retry_provisioning(&provisioning_id, requested_device_ids.clone())
        .await?;

    // 2) Re-check connectivity for target devices right away.
    let provisioning = client.get_provisioning(&provisioning_id).await?;
    let employee_no = provisioning
        .get("student")
        .and_then(|s| s.get("deviceStudentId"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let mut target_backend_ids: Vec<String> = if !requested_device_ids.is_empty() {
        requested_device_ids
    } else {
        retry_result
            .get("targetDeviceIds")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default()
    };

    if target_backend_ids.is_empty() {
        target_backend_ids = provisioning
            .get("devices")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| item.get("deviceId").and_then(|v| v.as_str()))
                    .map(|s| s.to_string())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();
    }

    let mut local_devices = load_devices();
    let mut local_changed = false;
    let mut checked = 0usize;
    let mut failed = 0usize;
    let mut missing_credentials = 0usize;

    let target_backend_ids_for_summary = target_backend_ids.clone();

    for backend_device_id in target_backend_ids {
        let link = provisioning
            .get("devices")
            .and_then(|v| v.as_array())
            .and_then(|arr| {
                arr.iter().find(|item| {
                    item.get("deviceId")
                        .and_then(|v| v.as_str())
                        == Some(backend_device_id.as_str())
                })
            });

        let external_device_id = link
            .and_then(|item| item.get("device"))
            .and_then(|device| device.get("deviceId"))
            .and_then(|v| v.as_str());
        let device_name = link
            .and_then(|item| item.get("device"))
            .and_then(|device| device.get("name"))
            .and_then(|v| v.as_str());
        let device_location = link
            .and_then(|item| item.get("device"))
            .and_then(|device| device.get("location"))
            .and_then(|v| v.as_str());

        let Some(index) = find_local_device_index(
            &local_devices,
            backend_device_id.as_str(),
            external_device_id,
        ) else {
            missing_credentials += 1;
            failed += 1;
            let _ = client
                .report_device_result(
                    &provisioning_id,
                    Some(backend_device_id.as_str()),
                    external_device_id,
                    device_name,
                    None,
                    device_location,
                    "FAILED",
                    employee_no,
                    Some("Local ulanish sozlamasi topilmadi"),
                )
                .await;
            continue;
        };

        if is_credentials_expired(&local_devices[index]) {
            failed += 1;
            let _ = client
                .report_device_result(
                    &provisioning_id,
                    Some(backend_device_id.as_str()),
                    external_device_id,
                    device_name,
                    None,
                    device_location,
                    "FAILED",
                    employee_no,
                    Some("Ulanish sozlamalari muddati tugagan"),
                )
                .await;
            continue;
        }

        checked += 1;
        let local_clone = local_devices[index].clone();
        let test = HikvisionClient::new(local_clone).test_connection().await;
        if test.ok {
            if let Some(found_id) = test.device_id {
                if local_devices[index].device_id.as_deref() != Some(found_id.as_str()) {
                    local_devices[index].device_id = Some(found_id);
                    local_changed = true;
                }
            }
            continue;
        }

        failed += 1;
        let error_message = test
            .message
            .unwrap_or_else(|| "Ulanishda xato".to_string());
        let _ = client
            .report_device_result(
                &provisioning_id,
                Some(backend_device_id.as_str()),
                external_device_id,
                device_name,
                None,
                device_location,
                "FAILED",
                employee_no,
                Some(error_message.as_str()),
            )
            .await;
    }

    if local_changed {
        let _ = save_devices(&local_devices);
    }

    let final_provisioning = client
        .get_provisioning(&provisioning_id)
        .await
        .unwrap_or_else(|_| provisioning.clone());

    let per_device_results: Vec<Value> = final_provisioning
        .get("devices")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let backend_device_id = item.get("deviceId").and_then(|v| v.as_str())?;
                    if !target_backend_ids_for_summary.is_empty()
                        && !target_backend_ids_for_summary
                            .iter()
                            .any(|id| id == backend_device_id)
                    {
                        return None;
                    }
                    let status = item
                        .get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("UNKNOWN");
                    let last_error = item
                        .get("lastError")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let updated_at = item
                        .get("updatedAt")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let device_obj = item.get("device");
                    let device_name = device_obj
                        .and_then(|d| d.get("name"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let device_external_id = device_obj
                        .and_then(|d| d.get("deviceId"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    Some(serde_json::json!({
                        "backendDeviceId": backend_device_id,
                        "deviceExternalId": device_external_id,
                        "deviceName": device_name,
                        "status": status,
                        "lastError": last_error,
                        "updatedAt": updated_at
                    }))
                })
                .collect::<Vec<Value>>()
        })
        .unwrap_or_default();

    Ok(serde_json::json!({
        "ok": retry_result.get("ok").and_then(|v| v.as_bool()).unwrap_or(true),
        "updated": retry_result.get("updated").and_then(|v| v.as_i64()).unwrap_or(0),
        "targetDeviceIds": retry_result.get("targetDeviceIds").cloned().unwrap_or_else(|| serde_json::json!([])),
        "perDeviceResults": per_device_results,
        "connectionCheck": {
            "checked": checked,
            "failed": failed,
            "missingCredentials": missing_credentials
        }
    }))
}

// ============ Clone Commands ============

