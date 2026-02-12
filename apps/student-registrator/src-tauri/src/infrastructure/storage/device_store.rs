// Device storage (local JSON file)

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::domain::entities::DeviceConfig;

fn get_storage_path() -> PathBuf {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    let app_dir = data_dir.join("student-registrator");
    fs::create_dir_all(&app_dir).ok();
    app_dir.join("devices.json")
}

pub fn load_devices() -> Vec<DeviceConfig> {
    let path = get_storage_path();
    if !path.exists() {
        return Vec::new();
    }
    
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    
    let devices: Vec<DeviceConfig> = serde_json::from_str(&content).unwrap_or_default();
    let original_len = devices.len();
    let deduped = dedupe_devices(devices);
    let mut needs_canonical_save = deduped.len() != original_len;
    if !needs_canonical_save {
        if let Ok(canonical) = serde_json::to_string_pretty(&deduped) {
            needs_canonical_save = canonical.trim() != content.trim();
        }
    }
    if needs_canonical_save {
        let _ = save_devices(&deduped);
    }
    deduped
}

pub fn save_devices(devices: &[DeviceConfig]) -> Result<(), String> {
    let path = get_storage_path();
    let content = serde_json::to_string_pretty(devices)
        .map_err(|e| e.to_string())?;
    fs::write(&path, content)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_device_by_id(device_id: &str) -> Option<DeviceConfig> {
    let devices = load_devices();
    devices.into_iter().find(|d| d.id == device_id)
}

fn normalize(value: &str) -> String {
    value.trim().to_lowercase()
}

fn dedupe_key(device: &DeviceConfig) -> String {
    if let Some(backend_id) = device.backend_id.as_ref() {
        if !backend_id.trim().is_empty() {
            return format!("backend:{}", normalize(backend_id));
        }
    }
    if let Some(device_id) = device.device_id.as_ref() {
        if !device_id.trim().is_empty() {
            return format!("device:{}", normalize(device_id));
        }
    }
    format!(
        "endpoint:{}:{}:{}",
        normalize(&device.host),
        device.port,
        normalize(&device.username),
    )
}

fn dedupe_devices(devices: Vec<DeviceConfig>) -> Vec<DeviceConfig> {
    let mut deduped: Vec<DeviceConfig> = Vec::new();
    let mut index_by_key: HashMap<String, usize> = HashMap::new();

    for device in devices {
        let key = dedupe_key(&device);
        if let Some(index) = index_by_key.get(&key).copied() {
            deduped[index] = device;
        } else {
            index_by_key.insert(key, deduped.len());
            deduped.push(device);
        }
    }

    deduped
}
