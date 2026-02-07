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

const MAX_FACE_IMAGE_BYTES: usize = 200 * 1024;

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
    let mut target_backend_ids: HashSet<String> = HashSet::new();

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
                target_backend_ids.insert(device.id.clone());
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
        let selected_by_backend_id = if target_backend_ids.is_empty() {
            true
        } else {
            device
                .backend_id
                .as_ref()
                .map(|id| target_backend_ids.contains(id))
                .unwrap_or(false)
        };
        if !selected_by_backend_id && !target_backend_ids.is_empty() {
            let selected_by_legacy_device_id = device
                .device_id
                .as_ref()
                .and_then(|id| backend_device_map.get(id))
                .is_some();
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
        let mut user_created = false;
        
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
        user_created = true;

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
            if user_created {
                let _ = client.delete_user(&employee_no).await;
            }
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

    Ok(serde_json::json!({
        "ok": retry_result.get("ok").and_then(|v| v.as_bool()).unwrap_or(true),
        "updated": retry_result.get("updated").and_then(|v| v.as_i64()).unwrap_or(0),
        "targetDeviceIds": retry_result.get("targetDeviceIds").cloned().unwrap_or_else(|| serde_json::json!([])),
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
    let per_page = page_size.unwrap_or(50).max(10).min(200);
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
                "male" | "female" => "male",
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

