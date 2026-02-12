#[tauri::command]
pub async fn get_device_webhook_config(
    device_id: String,
    direction: String,
) -> Result<Value, String> {
    let normalized = normalize_direction(&direction)?;
    let device = get_device_by_id(&device_id).ok_or("Device not found")?;
    if is_credentials_expired(&device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }
    let client = HikvisionClient::new(device);
    if let Ok((path, raw)) = read_device_webhook_config(&client).await {
        let scoped = extract_primary_http_host_notification(&raw)
            .map(|(notification, _)| serde_json::json!({ "HttpHostNotification": notification }))
            .unwrap_or_else(|| raw.clone());
        let urls = extract_webhook_urls_from_json(&raw);
        let primary = pick_primary_webhook_url(&urls, normalized);
        if primary.is_some() {
            return Ok(serde_json::json!({
                "ok": true,
                "direction": normalized,
                "path": path,
                "format": "json",
                "primaryUrl": primary,
                "urls": urls,
                "raw": scoped
            }));
        }
    }

    let mut errors = Vec::<String>::new();
    for path in WEBHOOK_RAW_CANDIDATE_PATHS {
        match client.get_isapi_raw(path).await {
            Ok(text) => {
                let urls = extract_urls_from_text(&text);
                if urls.is_empty() {
                    continue;
                }
                let primary = pick_primary_webhook_url(&urls, normalized);
                return Ok(serde_json::json!({
                    "ok": true,
                    "direction": normalized,
                    "path": path,
                    "format": "raw",
                    "primaryUrl": primary,
                    "urls": urls,
                    "raw": {
                        "text": text
                    }
                }));
            }
            Err(err) => errors.push(format!("{} => {}", path, err)),
        }
    }
    Err(format!("Webhookni qurilmadan o'qib bo'lmadi: {}", errors.join(" | ")))
}

#[tauri::command]
pub async fn sync_device_webhook_config(
    device_id: String,
    direction: String,
    target_url: String,
) -> Result<Value, String> {
    let normalized = normalize_direction(&direction)?;
    let target_url = normalize_target_url_for_device(&target_url);
    if target_url.is_empty() {
        return Err("targetUrl bo'sh bo'lmasligi kerak".to_string());
    }

    let device = get_device_by_id(&device_id).ok_or("Device not found")?;
    if is_credentials_expired(&device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }

    let client = HikvisionClient::new(device);
    if let Ok((_path, mut before_raw)) = read_device_webhook_config(&client).await {
        let (notification, host_id) = extract_primary_http_host_notification(&before_raw)
            .unwrap_or_else(|| (before_raw.clone(), "1".to_string()));
        before_raw = serde_json::json!({ "HttpHostNotification": notification.clone() });
        let before_urls = extract_webhook_urls_from_json(&before_raw);

        let mut updated_notification = notification.clone();
        let replaced = replace_url_fields(&mut updated_notification, &target_url);
        if replaced > 0 {
            let target_cmp = normalize_target_url_for_device(&target_url);

            let mut write_attempt_errors: Vec<String> = Vec::new();
            let attempts: Vec<(String, Value, &'static str)> = vec![
                (
                    format!("ISAPI/Event/notification/httpHosts/{}?format=json", host_id),
                    serde_json::json!({ "HttpHostNotification": updated_notification.clone() }),
                    "single-path/single-payload",
                ),
                (
                    "ISAPI/Event/notification/httpHosts?format=json".to_string(),
                    serde_json::json!({
                        "HttpHostNotificationList": {
                            "HttpHostNotification": updated_notification.clone()
                        }
                    }),
                    "list-path/list-payload",
                ),
                (
                    "ISAPI/Event/notification/httpHosts?format=json".to_string(),
                    serde_json::json!({ "HttpHostNotification": updated_notification.clone() }),
                    "list-path/single-payload",
                ),
            ];

            for (put_path, put_payload, attempt_name) in attempts {
                match client.put_isapi_json(put_path.as_str(), put_payload).await {
                    Ok(put_result) => {
                        if !response_status_ok(&put_result) {
                            write_attempt_errors.push(format!(
                                "{} => status not OK: {}",
                                attempt_name, put_result
                            ));
                            continue;
                        }
                        let after_urls = read_http_host_urls(&client, &host_id).await;
                        let is_applied = after_urls
                            .iter()
                            .any(|item| normalize_target_url_for_device(item) == target_cmp);
                        if is_applied {
                            return Ok(serde_json::json!({
                                "ok": true,
                                "direction": normalized,
                                "path": put_path,
                                "format": "json",
                                "attempt": attempt_name,
                                "replacedFields": replaced,
                                "beforeUrls": before_urls,
                                "afterUrls": after_urls,
                                "raw": put_result
                            }));
                        }
                        write_attempt_errors.push(format!(
                            "{} => applied=false, after={}",
                            attempt_name,
                            if after_urls.is_empty() { "-".to_string() } else { after_urls.join(" | ") }
                        ));
                    }
                    Err(err) => {
                        write_attempt_errors.push(format!("{} => {}", attempt_name, err));
                    }
                }
            }

            return Err(format!(
                "Qurilma URLni saqlamadi. hostId={}, kutilgan={}, urinishlar={}",
                host_id,
                target_cmp,
                write_attempt_errors.join(" || ")
            ));
        }
    }

    let mut errors = Vec::<String>::new();
    for path in WEBHOOK_RAW_CANDIDATE_PATHS {
        match client.get_isapi_raw(path).await {
            Ok(text) => {
                let before_urls = extract_urls_from_text(&text);
                if before_urls.is_empty() {
                    continue;
                }
                let (updated, replaced) = replace_xml_url_tags(&text, &target_url);
                if replaced == 0 {
                    continue;
                }
                let put_path = normalize_http_hosts_put_path(path);
                let after_text = client
                    .put_isapi_raw(put_path.as_str(), updated, Some("application/xml"))
                    .await?;
                let after_urls = extract_urls_from_text(&after_text);
                return Ok(serde_json::json!({
                    "ok": true,
                    "direction": normalized,
                    "path": put_path,
                    "format": "raw",
                    "replacedFields": replaced,
                    "beforeUrls": before_urls,
                    "afterUrls": after_urls,
                    "raw": {
                        "text": after_text
                    }
                }));
            }
            Err(err) => errors.push(format!("{} => {}", path, err)),
        }
    }
    Err(format!("Webhook sync qilib bo'lmadi: {}", errors.join(" | ")))
}

#[tauri::command]
pub async fn check_student_on_device(device_id: String, employee_no: String) -> Result<Value, String> {
    let mut devices = load_devices();
    let index = devices
        .iter()
        .position(|d| d.id == device_id)
        .ok_or("Device not found")?;

    let device = devices[index].clone();
    if is_credentials_expired(&device) {
        return Ok(serde_json::json!({
            "deviceId": device_id,
            "deviceExternalId": device.device_id,
            "status": "EXPIRED",
            "present": false,
            "message": "Ulanish sozlamalari muddati tugagan",
            "checkedAt": Utc::now().to_rfc3339(),
        }));
    }

    let client = HikvisionClient::new(device.clone());
    let connection = client.test_connection().await;
    if !connection.ok {
        return Ok(serde_json::json!({
            "deviceId": device_id,
            "deviceExternalId": connection.device_id.or(device.device_id),
            "status": "OFFLINE",
            "present": false,
            "message": connection.message,
            "checkedAt": Utc::now().to_rfc3339(),
        }));
    }

    if let Some(found_id) = connection.device_id.clone() {
        if devices[index].device_id.as_deref() != Some(found_id.as_str()) {
            devices[index].device_id = Some(found_id);
            let _ = save_devices(&devices);
        }
    }

    let user = client.get_user_by_employee_no(employee_no.as_str()).await;
    let present = user.is_some();
    Ok(serde_json::json!({
        "deviceId": device_id,
        "deviceExternalId": connection.device_id.or(device.device_id),
        "status": if present { "PRESENT" } else { "ABSENT" },
        "present": present,
        "message": if present { Value::Null } else { Value::String("Student topilmadi".to_string()) },
        "checkedAt": Utc::now().to_rfc3339(),
    }))
}

// ============ Student Registration Commands ============

