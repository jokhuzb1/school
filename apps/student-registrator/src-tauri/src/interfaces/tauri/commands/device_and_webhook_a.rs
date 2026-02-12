#[tauri::command]
pub fn get_contract_version() -> String {
    "sr-tauri-v1".to_string()
}

#[tauri::command]
pub async fn get_devices() -> Result<Vec<DeviceConfig>, String> {
    Ok(load_devices())
}

#[tauri::command]
pub async fn create_device(
    backend_id: Option<String>,
    host: String,
    port: u16,
    username: String,
    password: String,
    device_id: Option<String>,
) -> Result<DeviceConfig, String> {
    let mut devices = load_devices();
    
    let backend_id = backend_id
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    if let Some(existing) = devices.iter_mut().find(|d| d.backend_id == backend_id && backend_id.is_some()) {
        let now = Utc::now();
        let expires = now + Duration::days(30);
        existing.host = host.trim().to_string();
        existing.port = port;
        existing.username = username.trim().to_string();
        existing.password = password;
        existing.device_id = device_id;
        existing.credentials_updated_at = Some(now.to_rfc3339());
        existing.credentials_expires_at = Some(expires.to_rfc3339());
        let saved = existing.clone();
        save_devices(&devices)?;
        return Ok(saved);
    }

    let max_local_devices = get_max_local_devices();
    if devices.len() >= max_local_devices {
        return Err(format!("Maximum {} devices allowed", max_local_devices));
    }

    let now = Utc::now();
    let expires = now + Duration::days(30);
    let device = DeviceConfig {
        id: Uuid::new_v4().to_string(),
        backend_id,
        host: host.trim().to_string(),
        port,
        username: username.trim().to_string(),
        password,
        credentials_updated_at: Some(now.to_rfc3339()),
        credentials_expires_at: Some(expires.to_rfc3339()),
        device_id,
    };

    devices.push(device.clone());
    save_devices(&devices)?;
    
    Ok(device)
}

#[tauri::command]
pub async fn update_device(
    id: String,
    backend_id: Option<String>,
    host: String,
    port: u16,
    username: String,
    password: String,
    device_id: Option<String>,
) -> Result<DeviceConfig, String> {
    let mut devices = load_devices();
    
    let index = devices.iter().position(|d| d.id == id)
        .ok_or("Device not found")?;

    let now = Utc::now();
    let expires = now + Duration::days(30);
    let device = DeviceConfig {
        id,
        backend_id: backend_id.or_else(|| devices[index].backend_id.clone()),
        host: host.trim().to_string(),
        port,
        username: username.trim().to_string(),
        password,
        credentials_updated_at: Some(now.to_rfc3339()),
        credentials_expires_at: Some(expires.to_rfc3339()),
        device_id: device_id.or_else(|| devices[index].device_id.clone()),
    };
    devices[index] = device.clone();
    save_devices(&devices)?;
    
    Ok(device)
}

#[tauri::command]
pub async fn delete_device(id: String) -> Result<bool, String> {
    let mut devices = load_devices();
    let original_len = devices.len();
    devices.retain(|d| d.id != id);
    
    if devices.len() == original_len {
        return Err("Device not found".to_string());
    }
    
    save_devices(&devices)?;
    Ok(true)
}

#[tauri::command]
pub async fn test_device_connection(device_id: String) -> Result<DeviceConnectionResult, String> {
    let mut devices = load_devices();
    let index = devices
        .iter()
        .position(|d| d.id == device_id)
        .ok_or("Device not found")?;

    let device = devices[index].clone();
    if is_credentials_expired(&device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }
    let client = HikvisionClient::new(device);
    let result = client.test_connection().await;

    if result.ok {
        if let Some(found_id) = result.device_id.clone() {
            if devices[index].device_id.as_deref() != Some(found_id.as_str()) {
                devices[index].device_id = Some(found_id);
                let _ = save_devices(&devices);
            }
        }
    }

    Ok(result)
}

fn normalize_direction(direction: &str) -> Result<&'static str, String> {
    match direction.trim().to_lowercase().as_str() {
        "in" => Ok("in"),
        "out" => Ok("out"),
        _ => Err("direction must be in|out".to_string()),
    }
}

fn replace_url_fields(value: &mut Value, new_url: &str) -> usize {
    match value {
        Value::Object(map) => replace_url_fields_in_object(map, new_url),
        Value::Array(items) => items
            .iter_mut()
            .map(|item| replace_url_fields(item, new_url))
            .sum(),
        _ => 0,
    }
}

fn replace_url_fields_in_object(map: &mut Map<String, Value>, new_url: &str) -> usize {
    let mut changed = 0usize;
    for (k, v) in map {
        if v.is_string() && k.to_ascii_lowercase().contains("url") {
            *v = Value::String(new_url.to_string());
            changed += 1;
            continue;
        }
        changed += replace_url_fields(v, new_url);
    }
    changed
}

async fn read_device_webhook_config(client: &HikvisionClient) -> Result<(String, Value), String> {
    let mut errors = Vec::<String>::new();
    for path in WEBHOOK_CANDIDATE_PATHS {
        match client.get_isapi_json(path).await {
            Ok(raw) => return Ok((path.to_string(), raw)),
            Err(err) => errors.push(format!("{} => {}", path, err)),
        }
    }
    Err(format!(
        "Webhook config o'qib bo'lmadi. Sinovlar: {}",
        errors.join(" | ")
    ))
}

fn decode_markup_entities(input: &str) -> String {
    input
        .replace("\\/", "/")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

fn sanitize_webhook_candidate(input: &str) -> Option<String> {
    let decoded = decode_markup_entities(input);
    let trimmed = decoded
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim_end_matches('>')
        .trim()
        .to_string();
    if trimmed.is_empty() {
        return None;
    }
    let lower = trimmed.to_lowercase();
    if lower.contains("xmlschema") {
        return None;
    }
    if lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with('/') {
        return Some(trimmed);
    }
    None
}

fn clean_webhook_candidates(items: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = items
        .iter()
        .filter_map(|item| sanitize_webhook_candidate(item))
        .collect();
    out.sort();
    out.dedup();
    out
}

fn extract_webhook_urls_from_json(raw: &Value) -> Vec<String> {
    let mut urls = Vec::<String>::new();
    if let Some((notification, _)) = extract_primary_http_host_notification(raw) {
        for key in ["url", "URL", "httpURL", "httpUrl", "HttpURL", "HttpUrl"] {
            if let Some(v) = notification.get(key).and_then(|value| value.as_str()) {
                if let Some(clean) = sanitize_webhook_candidate(v) {
                    urls.push(clean);
                }
            }
        }
    }
    clean_webhook_candidates(urls)
}

fn extract_host_id(value: &Value) -> Option<String> {
    if let Some(id) = value.get("id").and_then(|v| v.as_str()) {
        let trimmed = id.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if let Some(id_num) = value.get("id").and_then(|v| v.as_i64()) {
        return Some(id_num.to_string());
    }
    None
}

fn extract_primary_http_host_notification(raw: &Value) -> Option<(Value, String)> {
    if let Some(item) = raw.get("HttpHostNotification") {
        let id = extract_host_id(item).unwrap_or_else(|| "1".to_string());
        return Some((item.clone(), id));
    }

    let list = raw.get("HttpHostNotificationList")?;
    let entries = list.get("HttpHostNotification")?;
    match entries {
        Value::Object(obj) => {
            let entry = Value::Object(obj.clone());
            let id = extract_host_id(&entry).unwrap_or_else(|| "1".to_string());
            Some((entry, id))
        }
        Value::Array(arr) => {
            if arr.is_empty() {
                return None;
            }
            if let Some(found) = arr.iter().find(|item| extract_host_id(item).as_deref() == Some("1")) {
                let id = extract_host_id(found).unwrap_or_else(|| "1".to_string());
                return Some((found.clone(), id));
            }
            let first = arr.first()?.clone();
            let id = extract_host_id(&first).unwrap_or_else(|| "1".to_string());
            Some((first, id))
        }
        _ => None,
    }
}

fn response_status_ok(value: &Value) -> bool {
    if let Some(code) = value.get("statusCode").and_then(|v| v.as_i64()) {
        return code == 1;
    }
    if let Some(status) = value.get("statusString").and_then(|v| v.as_str()) {
        return status.eq_ignore_ascii_case("OK");
    }
    true
}

