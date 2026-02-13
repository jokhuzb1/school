#[tauri::command]
pub async fn probe_device_connection(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<DeviceConnectionResult, String> {
    let now = Utc::now();
    let expires = now + Duration::days(30);
    let device = DeviceConfig {
        id: Uuid::new_v4().to_string(),
        backend_id: None,
        host: host.trim().to_string(),
        port,
        username: username.trim().to_string(),
        password,
        credentials_updated_at: Some(now.to_rfc3339()),
        credentials_expires_at: Some(expires.to_rfc3339()),
        device_id: None,
    };

    let client = HikvisionClient::new(device);
    Ok(client.test_connection().await)
}

#[tauri::command]
pub async fn get_device_capabilities(device_id: String) -> Result<Value, String> {
    let device = get_device_by_id(&device_id).ok_or("Device not found")?;
    if is_credentials_expired(&device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }
    let client = HikvisionClient::new(device);
    Ok(client.probe_capabilities().await)
}

#[tauri::command]
pub async fn get_device_configuration(device_id: String) -> Result<Value, String> {
    let device = get_device_by_id(&device_id).ok_or("Device not found")?;
    if is_credentials_expired(&device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }
    let client = HikvisionClient::new(device);

    let time = client
        .get_isapi_json("ISAPI/System/time?format=json")
        .await
        .unwrap_or_else(|e| serde_json::json!({ "error": e }));
    let ntp = client
        .get_isapi_json("ISAPI/System/Network/ntpServers?format=json")
        .await
        .unwrap_or_else(|e| serde_json::json!({ "error": e }));
    let network = client
        .get_isapi_json("ISAPI/System/Network/interfaces?format=json")
        .await
        .unwrap_or_else(|e| serde_json::json!({ "error": e }));

    Ok(serde_json::json!({
        "time": time,
        "ntpServers": ntp,
        "networkInterfaces": network,
    }))
}

#[tauri::command]
pub async fn update_device_configuration(
    device_id: String,
    config_type: String,
    payload: Value,
) -> Result<Value, String> {
    let device = get_device_by_id(&device_id).ok_or("Device not found")?;
    if is_credentials_expired(&device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }
    let client = HikvisionClient::new(device);

    let path = match config_type.as_str() {
        "time" => "ISAPI/System/time?format=json",
        "ntpServers" => "ISAPI/System/Network/ntpServers?format=json",
        "networkInterfaces" => "ISAPI/System/Network/interfaces?format=json",
        _ => return Err("Unsupported configType".to_string()),
    };
    if !payload.is_object() {
        return Err("payload must be JSON object".to_string());
    }

    let caps = client.probe_capabilities().await;
    let supported = caps
        .get("supported")
        .and_then(|s| s.get(config_type.as_str()))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !supported {
        return Err(format!("{} not supported on this device", config_type));
    }

    // Snapshot before write for safer rollback workflows.
    let before = client
        .get_isapi_json(path)
        .await
        .unwrap_or_else(|e| serde_json::json!({ "error": e }));

    let after = client.put_isapi_json(path, payload).await?;
    Ok(serde_json::json!({
        "ok": true,
        "configType": config_type,
        "before": before,
        "after": after
    }))
}

