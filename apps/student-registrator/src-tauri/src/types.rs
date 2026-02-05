// Types for Student Registrator

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfoEntry {
    #[serde(rename = "employeeNo")]
    pub employee_no: String,
    pub name: String,
    pub gender: Option<String>,
    #[serde(rename = "numOfFace")]
    pub num_of_face: Option<i32>,
    #[serde(rename = "faceURL")]
    pub face_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfoSearch {
    #[serde(rename = "UserInfo")]
    pub user_info: Option<Vec<UserInfoEntry>>,
    #[serde(rename = "numOfMatches")]
    pub num_of_matches: Option<i32>,
    #[serde(rename = "totalMatches")]
    pub total_matches: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfoSearchResponse {
    #[serde(rename = "UserInfoSearch")]
    pub user_info_search: Option<UserInfoSearch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvisioningStartResponse {
    #[serde(rename = "provisioningId")]
    pub provisioning_id: String,
    #[serde(rename = "deviceStudentId")]
    pub device_student_id: String,
    #[serde(rename = "studentId")]
    pub student_id: String,
    #[serde(rename = "targetDevices")]
    pub target_devices: Option<Vec<ProvisioningTargetDevice>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvisioningTargetDevice {
    pub id: String,
    #[serde(rename = "deviceId")]
    pub device_id: String,
}
