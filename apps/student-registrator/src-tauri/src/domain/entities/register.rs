use serde::{Deserialize, Serialize};

use super::{DeviceActionResult, DeviceConnectionResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterDeviceResult {
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "deviceName")]
    pub device_name: String,
    pub connection: DeviceConnectionResult,
    #[serde(rename = "userCreate")]
    pub user_create: Option<DeviceActionResult>,
    #[serde(rename = "faceUpload")]
    pub face_upload: Option<DeviceActionResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterResult {
    #[serde(rename = "employeeNo")]
    pub employee_no: String,
    #[serde(rename = "provisioningId")]
    pub provisioning_id: Option<String>,
    pub results: Vec<RegisterDeviceResult>,
}
