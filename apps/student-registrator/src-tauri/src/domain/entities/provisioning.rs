use serde::{Deserialize, Serialize};

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
