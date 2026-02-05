// Main Backend API client

use crate::types::{DeviceActionResult, ProvisioningStartResponse};
use reqwest::Client;
use serde_json::json;

pub struct ApiClient {
    base_url: String,
    client: Client,
    token: Option<String>,
}

impl ApiClient {
    pub fn new(base_url: String, token: Option<String>) -> Self {
        Self {
            base_url,
            client: Client::new(),
            token,
        }
    }

    fn apply_auth(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(token) = &self.token {
            return builder.header("Authorization", format!("Bearer {}", token));
        }
        builder
    }

    /// Sync student registration to main backend
    pub async fn sync_student(
        &self,
        employee_no: &str,
        name: &str,
        gender: &str,
    ) -> DeviceActionResult {
        let url = format!("{}/api/students/sync", self.base_url);
        
        let payload = json!({
            "employeeNo": employee_no,
            "name": name,
            "gender": gender,
            "source": "desktop-registrator"
        });

        match self
            .apply_auth(
                self.client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .body(payload.to_string()),
            )
            .send()
            .await
        {
            Ok(res) => {
                if res.status().is_success() {
                    DeviceActionResult {
                        ok: true,
                        status_code: Some(res.status().as_u16() as i32),
                        status_string: Some("OK".to_string()),
                        error_msg: None,
                    }
                } else {
                    let status = res.status().as_u16() as i32;
                    let text = res.text().await.unwrap_or_default();
                    DeviceActionResult {
                        ok: false,
                        status_code: Some(status),
                        status_string: Some("RequestFailed".to_string()),
                        error_msg: Some(text),
                    }
                }
            }
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("NetworkError".to_string()),
                error_msg: Some(e.to_string()),
            },
        }
    }

    pub async fn start_provisioning(
        &self,
        school_id: &str,
        name: &str,
        device_student_id: Option<&str>,
        class_id: Option<&str>,
        parent_name: Option<&str>,
        parent_phone: Option<&str>,
        target_device_ids: Option<&[String]>,
        request_id: &str,
    ) -> Result<ProvisioningStartResponse, String> {
        let url = format!("{}/schools/{}/students/provision", self.base_url, school_id);
        let target_device_ids = target_device_ids.unwrap_or(&[]).to_vec();
        let payload = json!({
            "student": {
                "name": name,
                "deviceStudentId": device_student_id,
                "classId": class_id,
                "parentName": parent_name,
                "parentPhone": parent_phone
            },
            "requestId": request_id,
            "targetAllActive": target_device_ids.is_empty(),
            "targetDeviceIds": target_device_ids
        });

        let res = self
            .apply_auth(
                self.client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .body(payload.to_string()),
            )
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(text);
        }

        serde_json::from_str(&text).map_err(|e| e.to_string())
    }

    pub async fn report_device_result(
        &self,
        provisioning_id: &str,
        device_id: Option<&str>,
        device_external_id: Option<&str>,
        device_name: Option<&str>,
        device_type: Option<&str>,
        device_location: Option<&str>,
        status: &str,
        employee_no: &str,
        error: Option<&str>,
    ) -> Result<(), String> {
        let url = format!("{}/provisioning/{}/device-result", self.base_url, provisioning_id);
        let payload = json!({
            "deviceId": device_id,
            "deviceExternalId": device_external_id,
            "deviceName": device_name,
            "deviceType": device_type,
            "deviceLocation": device_location,
            "status": status,
            "employeeNoOnDevice": employee_no,
            "error": error
        });

        let res = self
            .apply_auth(
                self.client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .body(payload.to_string()),
            )
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = res.status();
        if !status.is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(text);
        }
        Ok(())
    }

    pub async fn get_provisioning(
        &self,
        provisioning_id: &str,
    ) -> Result<serde_json::Value, String> {
        let url = format!("{}/provisioning/{}", self.base_url, provisioning_id);
        let res = self
            .apply_auth(self.client.get(&url))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(text);
        }
        serde_json::from_str(&text).map_err(|e| e.to_string())
    }

    pub async fn retry_provisioning(
        &self,
        provisioning_id: &str,
        device_ids: Vec<String>,
    ) -> Result<serde_json::Value, String> {
        let url = format!("{}/provisioning/{}/retry", self.base_url, provisioning_id);
        let payload = json!({
            "deviceIds": device_ids
        });
        let res = self
            .apply_auth(
                self.client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .body(payload.to_string()),
            )
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(text);
        }
        serde_json::from_str(&text).map_err(|e| e.to_string())
    }

}
