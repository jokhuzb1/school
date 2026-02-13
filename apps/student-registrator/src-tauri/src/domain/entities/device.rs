use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfig {
    pub id: String,
    #[serde(default)]
    #[serde(rename = "backendId")]
    pub backend_id: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    #[serde(default)]
    #[serde(rename = "credentialsUpdatedAt")]
    pub credentials_updated_at: Option<String>,
    #[serde(default)]
    #[serde(rename = "credentialsExpiresAt")]
    pub credentials_expires_at: Option<String>,
    #[serde(default)]
    #[serde(rename = "deviceId")]
    pub device_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConnectionResult {
    pub ok: bool,
    pub message: Option<String>,
    #[serde(rename = "deviceId")]
    pub device_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceActionResult {
    pub ok: bool,
    #[serde(rename = "statusCode")]
    pub status_code: Option<i32>,
    #[serde(rename = "statusString")]
    pub status_string: Option<String>,
    #[serde(rename = "errorMsg")]
    pub error_msg: Option<String>,
}
