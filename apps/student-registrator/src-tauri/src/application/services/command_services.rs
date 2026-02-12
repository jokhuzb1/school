use crate::domain::entities::DeviceConfig;
use chrono::{Datelike, Local, Timelike, Utc};

pub fn get_max_local_devices() -> usize {
    let raw = std::env::var("DEVICE_CREDENTIALS_LIMIT")
        .ok()
        .or_else(|| std::env::var("VITE_DEVICE_CREDENTIALS_LIMIT").ok());
    raw.and_then(|value| value.trim().parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(10)
}

pub fn generate_employee_no() -> String {
    let mut result = String::new();
    for _ in 0..10 {
        result.push_str(&(rand::random::<u8>() % 10).to_string());
    }
    result
}

pub fn to_device_time(dt: chrono::DateTime<Local>) -> String {
    format!(
        "{}-{:02}-{:02}T{:02}:{:02}:{:02}",
        dt.year(),
        dt.month(),
        dt.day(),
        dt.hour(),
        dt.minute(),
        dt.second()
    )
}

pub fn is_credentials_expired(device: &DeviceConfig) -> bool {
    if let Some(expires_at) = device.credentials_expires_at.as_ref() {
        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            return parsed.with_timezone(&Utc) < Utc::now();
        }
    }
    false
}

pub fn device_label(device: &DeviceConfig) -> String {
    if let Some(backend_id) = device.backend_id.as_ref() {
        if !backend_id.trim().is_empty() {
            return format!("Backend {}", backend_id);
        }
    }
    format!("{}:{}", device.host, device.port)
}

pub fn find_local_device_index(
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

pub fn device_match_label(device: &DeviceConfig) -> String {
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
