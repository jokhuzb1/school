// Tauri Commands - Bridge between React UI and Rust backend

use crate::hikvision::HikvisionClient;
use crate::storage::{get_device_by_id, load_devices, save_devices};
use crate::types::{DeviceConfig, DeviceConnectionResult, RegisterDeviceResult, RegisterResult, UserInfoSearchResponse};
use crate::api::ApiClient;
use chrono::{Datelike, Local, Timelike, Utc, Duration};
use uuid::Uuid;
use std::collections::{HashMap, HashSet};
use serde_json::Value;
use reqwest::Client;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde_json::Map;

const MAX_FACE_IMAGE_BYTES: usize = 200 * 1024;
const WEBHOOK_CANDIDATE_PATHS: [&str; 2] = [
    "ISAPI/Event/notification/httpHosts?format=json",
    "ISAPI/Event/notification/httpHosts/1?format=json",
];
const WEBHOOK_RAW_CANDIDATE_PATHS: [&str; 2] = [
    "ISAPI/Event/notification/httpHosts",
    "ISAPI/Event/notification/httpHosts/1",
];

fn generate_employee_no() -> String {
    let mut result = String::new();
    for _ in 0..10 {
        result.push_str(&(rand::random::<u8>() % 10).to_string());
    }
    result
}

fn to_device_time(dt: chrono::DateTime<Local>) -> String {
    format!(
        "{}-{:02}-{:02}T{:02}:{:02}:{:02}",
        dt.year(), dt.month(), dt.day(),
        dt.hour(), dt.minute(), dt.second()
    )
}

fn is_credentials_expired(device: &DeviceConfig) -> bool {
    if let Some(expires_at) = device.credentials_expires_at.as_ref() {
        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            return parsed.with_timezone(&Utc) < Utc::now();
        }
    }
    false
}

fn device_label(device: &DeviceConfig) -> String {
    if let Some(backend_id) = device.backend_id.as_ref() {
        if !backend_id.trim().is_empty() {
            return format!("Backend {}", backend_id);
        }
    }
    format!("{}:{}", device.host, device.port)
}

fn find_local_device_index(
    devices: &[DeviceConfig],
    backend_device_id: &str,
    external_device_id: Option<&str>,
) -> Option<usize> {
    devices
        .iter()
        .position(|d| d.backend_id.as_deref() == Some(backend_device_id))
        .or_else(|| {
            external_device_id.and_then(|external| {
                devices
                    .iter()
                    .position(|d| d.device_id.as_deref() == Some(external))
            })
        })
}

fn device_match_label(device: &DeviceConfig) -> String {
    if let Some(name) = device.backend_id.as_ref() {
        if !name.trim().is_empty() {
            return name.to_string();
        }
    }
    if let Some(device_id) = device.device_id.as_ref() {
        if !device_id.trim().is_empty() {
            return device_id.to_string();
        }
    }
    format!("{}:{}", device.host, device.port)
}

// ============ Device Management Commands ============

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

    if devices.len() >= 6 {
        return Err("Maximum 6 devices allowed".to_string());
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

async fn read_http_host_urls(client: &HikvisionClient, host_id: &str) -> Vec<String> {
    let single_path = format!("ISAPI/Event/notification/httpHosts/{}?format=json", host_id);
    if let Ok(single_raw) = client.get_isapi_json(single_path.as_str()).await {
        let scoped = serde_json::json!({ "HttpHostNotification": single_raw.get("HttpHostNotification").cloned().unwrap_or(single_raw.clone()) });
        let urls = extract_webhook_urls_from_json(&scoped);
        if !urls.is_empty() {
            return urls;
        }
    }
    if let Ok(list_raw) = client.get_isapi_json("ISAPI/Event/notification/httpHosts?format=json").await {
        let urls = extract_webhook_urls_from_json(&list_raw);
        if !urls.is_empty() {
            return urls;
        }
    }
    Vec::new()
}

fn extract_direct_url_candidates(text: &str, out: &mut Vec<String>) {
    let bytes = text.as_bytes();
    let mut i = 0usize;
    while i + 7 < bytes.len() {
        if text[i..].starts_with("http://")
            || text[i..].starts_with("https://")
            || text[i..].starts_with("/webhook/")
        {
            let start = i;
            let mut end = i;
            while end < bytes.len() {
                let c = bytes[end] as char;
                if c.is_whitespace() || c == '"' || c == '\'' || c == '<' || c == '>' {
                    break;
                }
                end += 1;
            }
            if end > start {
                out.push(text[start..end].trim().to_string());
            }
            i = end;
            continue;
        }
        i += 1;
    }
}

fn extract_xml_tag_values(text: &str) -> Vec<String> {
    let tag_names = ["url", "httpurl", "hosturl", "callbackurl"];
    let source = decode_markup_entities(text);
    let lower = source.to_lowercase();
    let bytes = source.as_bytes();
    let mut out = Vec::<String>::new();
    let mut i = 0usize;
    while i < bytes.len() {
        let Some(rel_open) = source[i..].find('<') else { break };
        let open = i + rel_open;
        let Some(rel_end) = source[open..].find('>') else { break };
        let end = open + rel_end;
        if end <= open + 1 {
            i = end + 1;
            continue;
        }
        let token = &source[open + 1..end];
        let trimmed = token.trim();
        if trimmed.starts_with('/') || trimmed.starts_with('?') || trimmed.starts_with('!') {
            i = end + 1;
            continue;
        }
        let raw_name = trimmed
            .split_whitespace()
            .next()
            .unwrap_or("");
        let base_name = raw_name
            .split(':')
            .last()
            .unwrap_or(raw_name)
            .to_lowercase();
        if !tag_names.iter().any(|name| *name == base_name) {
            i = end + 1;
            continue;
        }
        let mut search = end + 1;
        let mut close_start_opt: Option<usize> = None;
        let mut close_end_opt: Option<usize> = None;
        while search < bytes.len() {
            let Some(rel_close_open) = source[search..].find("</") else { break };
            let close_open = search + rel_close_open;
            let Some(rel_close_end) = source[close_open..].find('>') else { break };
            let close_end = close_open + rel_close_end;
            let close_token = source[close_open + 2..close_end].trim();
            let close_base = close_token
                .split_whitespace()
                .next()
                .unwrap_or("")
                .split(':')
                .last()
                .unwrap_or("")
                .to_lowercase();
            if close_base == base_name {
                close_start_opt = Some(close_open);
                close_end_opt = Some(close_end);
                break;
            }
            search = close_end + 1;
        }
        if let (Some(close_start), Some(close_end)) = (close_start_opt, close_end_opt) {
            if close_start > end + 1 {
                let value = lower[end + 1..close_start].trim();
                if !value.is_empty() {
                    out.push(source[end + 1..close_start].trim().to_string());
                }
            }
            i = close_end + 1;
            continue;
        }
        i = end + 1;
    }
    out
}

fn extract_urls_from_text(text: &str) -> Vec<String> {
    let decoded = decode_markup_entities(text);
    let mut urls: Vec<String> = Vec::new();
    extract_direct_url_candidates(&decoded, &mut urls);
    urls.extend(extract_xml_tag_values(&decoded));
    clean_webhook_candidates(urls)
}

fn is_valid_webhook_candidate(url: &str) -> bool {
    let lower = url.to_lowercase();
    if lower.contains("isapi.org/ver20/xmlschema") {
        return false;
    }
    if lower.contains("&gt;") || lower.contains("&lt;") || lower.contains('<') || lower.contains('>') {
        return false;
    }
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || (lower.starts_with('/') && !lower.starts_with("/isapi/"))
}

fn pick_primary_webhook_url(urls: &[String], direction: &str) -> Option<String> {
    let dir = direction.to_lowercase();
    urls.iter()
        .find(|u| {
            let lower = u.to_lowercase();
            let direction_match =
                lower.contains(&format!("/{dir}?"))
                    || lower.ends_with(&format!("/{dir}"))
                    || lower.contains(&format!("/{dir}&"));
            is_valid_webhook_candidate(u) && (direction_match || lower.contains("secret="))
        })
        .cloned()
        .or_else(|| urls.iter().find(|u| is_valid_webhook_candidate(u)).cloned())
        .or_else(|| None)
}

fn replace_xml_url_tags(xml: &str, target_url: &str) -> (String, usize) {
    let tags = ["url", "URL", "httpUrl", "HttpUrl", "HTTPUrl", "address", "Address"];
    let mut out = xml.to_string();
    let mut total = 0usize;
    for tag in tags {
        let open = format!("<{}>", tag);
        let close = format!("</{}>", tag);
        let mut start = 0usize;
        loop {
            let Some(open_pos_rel) = out[start..].find(&open) else { break };
            let open_pos = start + open_pos_rel;
            let value_start = open_pos + open.len();
            let Some(close_pos_rel) = out[value_start..].find(&close) else { break };
            let close_pos = value_start + close_pos_rel;
            out.replace_range(value_start..close_pos, target_url);
            total += 1;
            start = value_start + target_url.len() + close.len();
        }
    }
    (out, total)
}

fn normalize_http_hosts_put_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.contains("ISAPI/Event/notification/httpHosts/1") {
        return trimmed.replace(
            "ISAPI/Event/notification/httpHosts/1",
            "ISAPI/Event/notification/httpHosts",
        );
    }
    trimmed.to_string()
}

fn normalize_target_url_for_device(target_url: &str) -> String {
    let trimmed = target_url.trim();
    if let Ok(parsed) = reqwest::Url::parse(trimmed) {
        let mut value = parsed.path().to_string();
        if let Some(query) = parsed.query() {
            value.push('?');
            value.push_str(query);
        }
        if value.is_empty() {
            "/".to_string()
        } else {
            value
        }
    } else {
        trimmed.to_string()
    }
}

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

#[tauri::command]
pub async fn register_student(
    name: String,
    first_name: Option<String>,
    last_name: Option<String>,
    father_name: Option<String>,
    gender: String,
    face_image_base64: String,
    parent_phone: Option<String>,
    class_id: Option<String>,
    target_device_ids: Option<Vec<String>>,
    backend_url: Option<String>,
    backend_token: Option<String>,
    school_id: Option<String>,
) -> Result<RegisterResult, String> {
    // Quick size guard: base64 expands data by ~33%, so this is conservative.
    if face_image_base64.len() > (MAX_FACE_IMAGE_BYTES * 4 / 3) + 256 {
        return Err(format!(
            "Face image is too large. Max {} KB.",
            MAX_FACE_IMAGE_BYTES / 1024
        ));
    }

    let mut devices = load_devices();
    
    if devices.is_empty() {
        return Err("No devices configured".to_string());
    }

    let backend_url = backend_url.filter(|v| !v.trim().is_empty());
    let backend_token = backend_token.filter(|v| !v.trim().is_empty());
    let school_id = school_id.filter(|v| !v.trim().is_empty());

    let full_name = {
        let first = first_name.clone().unwrap_or_default().trim().to_string();
        let last = last_name.clone().unwrap_or_default().trim().to_string();
        let combined = format!("{} {}", last, first).trim().to_string();
        if combined.is_empty() { name.trim().to_string() } else { combined }
    };

    let mut employee_no = generate_employee_no();
    let mut provisioning_id: Option<String> = None;
    let mut api_client: Option<ApiClient> = None;
    let mut backend_device_map: HashMap<String, String> = HashMap::new();
    let requested_target_backend_ids: Option<HashSet<String>> = target_device_ids.as_ref().map(|ids| {
        ids.iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .collect::<HashSet<String>>()
    });
    let explicit_db_only = requested_target_backend_ids
        .as_ref()
        .map(|ids| ids.is_empty())
        .unwrap_or(false);
    let mut provisioned_target_backend_ids: HashSet<String> = HashSet::new();

    if backend_url.is_some() && school_id.is_none() {
        return Err("schoolId is required when backendUrl is set".to_string());
    }

    if let (Some(url), Some(school_id)) = (backend_url.clone(), school_id.clone()) {
        let client = ApiClient::new(url, backend_token.clone());
        let request_id = Uuid::new_v4().to_string();
        let provisioning = client
            .start_provisioning(
                &school_id,
                &full_name,
                &gender,
                Some(&employee_no), // keep numeric device_student_id for Hikvision
                class_id.as_deref(), // classId - to'g'ri o'rinda!
                first_name.as_deref(),
                last_name.as_deref(),
                father_name.as_deref(),
                parent_phone.as_deref(),
                Some(&face_image_base64),
                target_device_ids.as_deref(),
                &request_id,
            )
            .await
            .map_err(|e| format!("Backend provisioning failed: {}", e))?;

        if provisioning.device_student_id.chars().all(|c| c.is_ascii_digit()) {
            employee_no = provisioning.device_student_id;
        }
        provisioning_id = Some(provisioning.provisioning_id);
        if let Some(targets) = provisioning.target_devices.as_ref() {
            for device in targets {
                backend_device_map.insert(device.device_id.clone(), device.id.clone());
                provisioned_target_backend_ids.insert(device.id.clone());
            }
        }
        api_client = Some(client);
    }

    let now = Local::now();
    let begin_time = to_device_time(now);
    let end_time = to_device_time(
        now.with_year(now.year() + 10).unwrap_or(now)
    );

    let mut results = Vec::new();
    let mut successful_devices: Vec<DeviceConfig> = Vec::new();
    let mut abort_error: Option<String> = None;

    let mut devices_changed = false;

    for device in devices.iter_mut() {
        if abort_error.is_some() {
            break;
        }
        if explicit_db_only {
            continue;
        }

        let selected_set: Option<&HashSet<String>> = if let Some(requested) = requested_target_backend_ids.as_ref() {
            Some(requested)
        } else if !provisioned_target_backend_ids.is_empty() {
            Some(&provisioned_target_backend_ids)
        } else {
            None
        };

        let selected_by_backend_id = selected_set.map_or(true, |ids| {
            device
                .backend_id
                .as_ref()
                .map(|id| ids.contains(id))
                .unwrap_or(false)
        });

        if !selected_by_backend_id && selected_set.is_some() {
            let selected_by_legacy_device_id = selected_set
                .and_then(|ids| {
                    device
                        .device_id
                        .as_ref()
                        .and_then(|id| backend_device_map.get(id))
                        .map(|backend_id| ids.contains(backend_id))
                })
                .unwrap_or(false);
            if !selected_by_legacy_device_id {
                continue;
            }
        }

        if is_credentials_expired(device) {
            let external_device_id = device.device_id.as_deref();
            let backend_device_id = device
                .backend_id
                .as_deref()
                .or_else(|| external_device_id.and_then(|id| backend_device_map.get(id).map(|s| s.as_str())));
            let connection = DeviceConnectionResult {
                ok: false,
                message: Some("Ulanish sozlamalari muddati tugagan".to_string()),
                device_id: device.device_id.clone(),
            };
            if let (Some(api), Some(pid)) = (api_client.as_ref(), provisioning_id.as_ref()) {
                let device_display_name = device_label(device);
                let device_name = Some(device_display_name.as_str());
                let device_location = Some(device.host.as_str());
                if let Err(err) = api
                    .report_device_result(
                        pid,
                        backend_device_id,
                        external_device_id,
                        device_name,
                        None,
                        device_location,
                        "FAILED",
                        &employee_no,
                        connection.message.as_deref(),
                    )
                    .await
                {
                    abort_error = Some(format!("Backend report failed: {}", err));
                }
            }
            results.push(RegisterDeviceResult {
                device_id: device.id.clone(),
                device_name: device_label(device),
                connection,
                user_create: None,
                face_upload: None,
            });
            if abort_error.is_none() {
                abort_error = Some(format!(
                    "Qurilma {}: Ulanish sozlamalari muddati tugagan",
                    device_label(device)
                ));
            }
            continue;
        }

        let client = HikvisionClient::new(device.clone());
        
        // Test connection
        let connection = client.test_connection().await;
        if connection.ok {
            if let Some(device_id) = connection.device_id.clone() {
                if device.device_id.as_deref() != Some(device_id.as_str()) {
                    device.device_id = Some(device_id);
                    devices_changed = true;
                }
            }
        }
        let external_device_id = connection
            .device_id
            .as_deref()
            .or(device.device_id.as_deref());
        let backend_device_id = device
            .backend_id
            .as_deref()
            .or_else(|| external_device_id.and_then(|id| backend_device_map.get(id).map(|s| s.as_str())));
        let device_display_name = device_label(device);
        let device_name = Some(device_display_name.as_str());
        let device_location = Some(device.host.as_str());

        if !connection.ok {
            let connection_message = connection.message.clone();
            if let (Some(api), Some(pid)) = (api_client.as_ref(), provisioning_id.as_ref()) {
                if let Err(err) = api
                    .report_device_result(
                        pid,
                        backend_device_id,
                        external_device_id,
                        device_name,
                        None,
                        device_location,
                        "FAILED",
                        &employee_no,
                        connection.message.as_deref(),
                    )
                    .await
                {
                    abort_error = Some(format!("Backend report failed: {}", err));
                }
            }
            results.push(RegisterDeviceResult {
                device_id: device.id.clone(),
                device_name: device_label(device),
                connection,
                user_create: None,
                face_upload: None,
            });
            if abort_error.is_none() {
                let reason = connection_message.unwrap_or_else(|| "Ulanishda xato".to_string());
                abort_error = Some(format!("Qurilma {}: {}", device_label(device), reason));
            }
            continue;
        }

        // Create user
        let user_create = client.create_user(
            &employee_no,
            &full_name,
            &gender,
            &begin_time,
            &end_time,
        ).await;

        if !user_create.ok {
            if let (Some(api), Some(pid)) = (api_client.as_ref(), provisioning_id.as_ref()) {
                if let Err(err) = api
                    .report_device_result(
                        pid,
                        backend_device_id,
                        external_device_id,
                        device_name,
                        None,
                        device_location,
                        "FAILED",
                        &employee_no,
                        user_create.error_msg.as_deref(),
                    )
                    .await
                {
                    abort_error = Some(format!("Backend report failed: {}", err));
                }
            }
            results.push(RegisterDeviceResult {
                device_id: device.id.clone(),
                device_name: device_label(device),
                connection,
                user_create: Some(user_create),
                face_upload: None,
            });
            if abort_error.is_none() {
                abort_error = Some(format!(
                    "Qurilma {}: Qurilmada foydalanuvchi yaratishda xato",
                    device_label(device)
                ));
            }
            continue;
        }
        // Upload face
        let face_upload = client.upload_face(
            &employee_no,
            &full_name,
            &gender,
            &face_image_base64,
        ).await;

        if let (Some(api), Some(pid)) = (api_client.as_ref(), provisioning_id.as_ref()) {
            let status = if face_upload.ok { "SUCCESS" } else { "FAILED" };
            if let Err(err) = api
                .report_device_result(
                    pid,
                    backend_device_id,
                    external_device_id,
                    device_name,
                    None,
                    device_location,
                    status,
                    &employee_no,
                    face_upload.error_msg.as_deref(),
                )
                .await
            {
                abort_error = Some(format!("Backend report failed: {}", err));
            }
        }

        results.push(RegisterDeviceResult {
            device_id: device.id.clone(),
            device_name: device_label(device),
            connection,
            user_create: Some(user_create),
            face_upload: Some(face_upload.clone()),
        });

        if face_upload.ok {
            successful_devices.push(device.clone());
        } else {
            let _ = client.delete_user(&employee_no).await;
            if abort_error.is_none() {
                abort_error = Some(format!(
                    "Qurilma {}: Qurilmaga rasm yuklashda xato",
                    device_label(device)
                ));
            }
        }
    }

    if devices_changed {
        let _ = save_devices(&devices);
    }

    if let Some(message) = abort_error {
        let mut rollback_errors: Vec<String> = Vec::new();
        for dev in successful_devices.iter() {
            let client = HikvisionClient::new(dev.clone());
            let result = client.delete_user(&employee_no).await;
            if !result.ok {
                let label = device_label(dev);
                let err = result.error_msg.unwrap_or_else(|| "Delete failed".to_string());
                rollback_errors.push(format!("{}: {}", label, err));
            }
        }
        if rollback_errors.is_empty() {
            return Err(message);
        }
        return Err(format!(
            "{}. Rollback errors: {}",
            message,
            rollback_errors.join("; ")
        ));
    }

    // Backend provisioning already handles server sync; skip legacy /api/students/sync call.

    Ok(RegisterResult {
        employee_no,
        provisioning_id,
        results,
    })
}

// ============ User Management Commands ============

#[tauri::command]
pub async fn fetch_users(device_id: String, offset: Option<i32>, limit: Option<i32>) -> Result<UserInfoSearchResponse, String> {
    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    
    let client = HikvisionClient::new(device);
    let result = client.search_users(offset.unwrap_or(0), limit.unwrap_or(30)).await;
    
    Ok(result)
}

#[tauri::command]
pub async fn delete_user(device_id: String, employee_no: String) -> Result<bool, String> {
    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    
    let client = HikvisionClient::new(device);
    let result = client.delete_user(&employee_no).await;
    
    if result.ok {
        Ok(true)
    } else {
        Err(result.error_msg.unwrap_or("Delete failed".to_string()))
    }
}

#[tauri::command]
pub async fn get_user_face(device_id: String, employee_no: String) -> Result<serde_json::Value, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    if is_credentials_expired(&device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }

    let client = HikvisionClient::new(device);
    let user = client
        .get_user_by_employee_no(&employee_no)
        .await
        .ok_or("Foydalanuvchi topilmadi")?;

    let face_url = user.face_url.ok_or("Qurilmada rasm topilmadi")?;
    let face_bytes = client.fetch_face_image(&face_url).await?;
    let image_base64 = STANDARD.encode(face_bytes);

    Ok(serde_json::json!({
        "ok": true,
        "employeeNo": employee_no,
        "faceUrl": face_url,
        "imageBase64": image_base64
    }))
}

#[tauri::command]
pub async fn get_user_face_by_url(
    device_id: String,
    employee_no: String,
    face_url: String,
) -> Result<serde_json::Value, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    if is_credentials_expired(&device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }

    let client = HikvisionClient::new(device);
    let face_bytes = client.fetch_face_image(&face_url).await?;
    let image_base64 = STANDARD.encode(face_bytes);

    Ok(serde_json::json!({
        "ok": true,
        "employeeNo": employee_no,
        "faceUrl": face_url,
        "imageBase64": image_base64
    }))
}

/// Recreate user - delete and create again with updated info
#[tauri::command]
pub async fn recreate_user(
    device_id: String,
    employee_no: String,
    name: String,
    gender: String,
    new_employee_no: bool,
    reuse_existing_face: bool,
    face_image_base64: Option<String>,
) -> Result<serde_json::Value, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    
    let client = HikvisionClient::new(device);
    
    // Test connection
    let connection = client.test_connection().await;
    if !connection.ok {
        return Err(connection.message.unwrap_or("Device offline".to_string()));
    }

    // Get face image - either from existing user or from provided base64
    let face_data: String = if reuse_existing_face && face_image_base64.is_none() {
        // Fetch existing face from device
        let existing_user = client.get_user_by_employee_no(&employee_no).await
            .ok_or("User not found on device")?;
        
        let face_url = existing_user.face_url
            .ok_or("Existing user has no face to reuse")?;
        
        let face_bytes = client.fetch_face_image(&face_url).await?;
        STANDARD.encode(&face_bytes)
    } else if let Some(base64) = face_image_base64 {
        base64
    } else {
        return Err("Face image is required".to_string());
    };

    // Determine new employee number
    let next_employee_no = if new_employee_no {
        generate_employee_no()
    } else {
        employee_no.clone()
    };

    // Delete old user
    let delete_result = client.delete_user(&employee_no).await;
    if !delete_result.ok {
        return Err(format!("Delete failed: {}", delete_result.error_msg.unwrap_or_default()));
    }

    // Create new user
    let now = Local::now();
    let begin_time = to_device_time(now);
    let end_time = to_device_time(
        now.with_year(now.year() + 10).unwrap_or(now)
    );

    let create_result = client.create_user(
        &next_employee_no,
        &name,
        &gender,
        &begin_time,
        &end_time,
    ).await;

    if !create_result.ok {
        return Err(format!("Create failed: {}", create_result.error_msg.unwrap_or_default()));
    }

    // Upload face
    let face_upload = client.upload_face(
        &next_employee_no,
        &name,
        &gender,
        &face_data,
    ).await;

    Ok(serde_json::json!({
        "employeeNo": next_employee_no,
        "deleteResult": {
            "ok": delete_result.ok,
            "statusString": delete_result.status_string,
            "errorMsg": delete_result.error_msg
        },
        "createResult": {
            "ok": create_result.ok,
            "statusString": create_result.status_string,
            "errorMsg": create_result.error_msg
        },
        "faceUpload": {
            "ok": face_upload.ok,
            "statusString": face_upload.status_string,
            "errorMsg": face_upload.error_msg
        }
    }))
}

// ============ Provisioning Commands ============

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

#[tauri::command]
pub async fn clone_students_to_device(
    backend_device_id: String,
    backend_url: Option<String>,
    backend_token: Option<String>,
    school_id: Option<String>,
    page_size: Option<u32>,
    max_students: Option<u32>,
) -> Result<Value, String> {
    let backend_url = backend_url.filter(|v| !v.trim().is_empty())
        .ok_or("backendUrl is required")?;
    let school_id = school_id.filter(|v| !v.trim().is_empty())
        .ok_or("schoolId is required")?;
    let token = backend_token.filter(|v| !v.trim().is_empty());
    let _per_page = page_size.unwrap_or(50).max(10).min(200);
    let limit = max_students.unwrap_or(10000);

    let local_devices = load_devices();
    let local_index = find_local_device_index(&local_devices, &backend_device_id, None)
        .ok_or("Local ulanish sozlamasi topilmadi")?;
    let target_device = local_devices[local_index].clone();
    if is_credentials_expired(&target_device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }

    let client = Client::new();
    let mut page = 1u32;
    let mut total_processed = 0u32;
    let mut success = 0u32;
    let mut failed = 0u32;
    let mut skipped = 0u32;
    let mut errors: Vec<Value> = Vec::new();

    loop {
        if total_processed >= limit {
            break;
        }
        let url = format!(
            "{}/schools/{}/students?page={}",
            backend_url, school_id, page
        );
        let mut req = client.get(&url);
        if let Some(t) = token.as_ref() {
            req = req.header("Authorization", format!("Bearer {}", t));
        }
        let res = req.send().await.map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(text);
        }
        let payload: Value = res.json().await.map_err(|e| e.to_string())?;
        let data = payload.get("data").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        if data.is_empty() {
            break;
        }

        for item in data {
            if total_processed >= limit {
                break;
            }
            total_processed += 1;
            let student_id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let device_student_id = item.get("deviceStudentId").and_then(|v| v.as_str()).unwrap_or("");
            let full_name = item.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let gender = item.get("gender").and_then(|v| v.as_str()).unwrap_or("MALE");
            let photo_url = item.get("photoUrl").and_then(|v| v.as_str()).unwrap_or("");

            if device_student_id.is_empty() || full_name.is_empty() || photo_url.is_empty() {
                skipped += 1;
                errors.push(serde_json::json!({
                    "studentId": student_id,
                    "name": full_name,
                    "reason": "Ma'lumot yetarli emas (deviceStudentId/name/photoUrl)"
                }));
                continue;
            }

            let photo_full_url = if photo_url.starts_with("http://") || photo_url.starts_with("https://") {
                photo_url.to_string()
            } else {
                format!("{}{}", backend_url, photo_url)
            };

            let img_res = client.get(&photo_full_url).send().await;
            let bytes = match img_res {
                Ok(resp) if resp.status().is_success() => resp.bytes().await.map_err(|e| e.to_string())?.to_vec(),
                _ => {
                    failed += 1;
                    errors.push(serde_json::json!({
                        "studentId": student_id,
                        "name": full_name,
                        "reason": "Rasm yuklab bo'lmadi"
                    }));
                    continue;
                }
            };

            let face_base64 = STANDARD.encode(&bytes);
            let hik = HikvisionClient::new(target_device.clone());

            let now = Local::now();
            let begin_time = to_device_time(now);
            let end_time = to_device_time(now.with_year(now.year() + 10).unwrap_or(now));

            let create = hik.create_user(device_student_id, full_name, gender, &begin_time, &end_time).await;
            if !create.ok {
                failed += 1;
                errors.push(serde_json::json!({
                    "studentId": student_id,
                    "name": full_name,
                    "reason": create.error_msg.unwrap_or_else(|| "Create failed".to_string())
                }));
                continue;
            }

            let upload = hik.upload_face(device_student_id, full_name, gender, &face_base64).await;
            if !upload.ok {
                failed += 1;
                errors.push(serde_json::json!({
                    "studentId": student_id,
                    "name": full_name,
                    "reason": upload.error_msg.unwrap_or_else(|| "Upload failed".to_string())
                }));
                continue;
            }

            success += 1;
        }

        page += 1;
    }

    Ok(serde_json::json!({
        "ok": true,
        "device": device_match_label(&target_device),
        "processed": total_processed,
        "success": success,
        "failed": failed,
        "skipped": skipped,
        "errors": errors
    }))
}

#[tauri::command]
pub async fn clone_device_to_device(
    source_device_id: String,
    target_device_id: String,
    limit: Option<u32>,
) -> Result<Value, String> {
    let source = get_device_by_id(&source_device_id)
        .ok_or("Manba qurilma topilmadi")?;
    let target = get_device_by_id(&target_device_id)
        .ok_or("Maqsad qurilma topilmadi")?;

    if is_credentials_expired(&source) {
        return Err("Manba qurilmaning ulanish sozlamalari muddati tugagan".to_string());
    }
    if is_credentials_expired(&target) {
        return Err("Maqsad qurilmaning ulanish sozlamalari muddati tugagan".to_string());
    }

    let src_client = HikvisionClient::new(source.clone());
    let tgt_client = HikvisionClient::new(target.clone());

    let mut offset = 0i32;
    let page_size = 30i32;
    let max = limit.unwrap_or(10000) as i32;

    let mut processed = 0u32;
    let mut success = 0u32;
    let mut failed = 0u32;
    let mut skipped = 0u32;
    let mut errors: Vec<Value> = Vec::new();

    loop {
        if processed as i32 >= max {
            break;
        }
        let response = src_client.search_users(offset, page_size).await;
        let info = response.user_info_search;
        let users = info.and_then(|v| v.user_info).unwrap_or_default();
        if users.is_empty() {
            break;
        }

        for user in users {
            if processed as i32 >= max {
                break;
            }
            processed += 1;

            let employee_no = user.employee_no.clone();
            let name = user.name.clone();
            let gender_raw = user.gender.clone().unwrap_or_else(|| "male".to_string());
            let gender = match gender_raw.trim().to_lowercase().as_str() {
                "female" | "f" | "ayol" | "2" => "female",
                "male" | "m" | "erkak" | "1" => "male",
                "ma" | "male " => "male",
                "fa" | "female " => "female",
                other if other.contains("female") => "female",
                _ => "male",
            }.to_string();
            let face_url = user.face_url.clone().unwrap_or_default();

            if employee_no.trim().is_empty() || name.trim().is_empty() || face_url.trim().is_empty() {
                skipped += 1;
                errors.push(serde_json::json!({
                    "employeeNo": employee_no,
                    "name": name,
                    "reason": "Ma'lumot yetarli emas (employeeNo/name/faceURL)"
                }));
                continue;
            }

            let face_bytes = match src_client.fetch_face_image(&face_url).await {
                Ok(bytes) => bytes,
                Err(_) => {
                    failed += 1;
                    errors.push(serde_json::json!({
                        "employeeNo": employee_no,
                        "name": name,
                        "reason": "Rasmni manba qurilmadan olishda xato"
                    }));
                    continue;
                }
            };
            let face_base64 = STANDARD.encode(&face_bytes);

            let existing = tgt_client.get_user_by_employee_no(&employee_no).await;
            if existing.is_none() {
                let now = Local::now();
                let begin_time = to_device_time(now);
                let end_time = to_device_time(now.with_year(now.year() + 10).unwrap_or(now));
                let create = tgt_client
                    .create_user(&employee_no, &name, &gender, &begin_time, &end_time)
                    .await;
                if !create.ok {
                    let reason = create.error_msg.unwrap_or_else(|| "Create failed".to_string());
                    let lower = reason.to_lowercase();
                    if lower.contains("already exist")
                        || lower.contains("duplicate")
                        || lower.contains("exist")
                        || lower.contains("already")
                    {
                        skipped += 1;
                    } else {
                        failed += 1;
                        errors.push(serde_json::json!({
                            "employeeNo": employee_no,
                            "name": name,
                            "reason": reason
                        }));
                    }
                    continue;
                }
            }

            let upload = tgt_client
                .upload_face(&employee_no, &name, &gender, &face_base64)
                .await;
            if !upload.ok {
                failed += 1;
                errors.push(serde_json::json!({
                    "employeeNo": employee_no,
                    "name": name,
                    "reason": upload.error_msg.unwrap_or_else(|| "Upload failed".to_string())
                }));
                continue;
            }
            success += 1;
        }

        offset += page_size;
    }

    Ok(serde_json::json!({
        "ok": true,
        "source": device_match_label(&source),
        "target": device_match_label(&target),
        "processed": processed,
        "success": success,
        "failed": failed,
        "skipped": skipped,
        "errors": errors
    }))
}

