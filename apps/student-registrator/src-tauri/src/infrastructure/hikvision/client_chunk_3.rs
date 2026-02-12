impl HikvisionClient {
    pub async fn test_connection(&self) -> DeviceConnectionResult {
        let url = format!("{}/ISAPI/System/deviceInfo?format=json", self.base_url());
        
        match self
            .auth_request_json(reqwest::Method::GET, &url, None)
            .await
        {
            Ok(text) => {
                let device_id = extract_device_id(&text);
                if DEBUG_HIKVISION {
                    let preview: String = text.chars().take(400).collect();
                    println!(
                        "[HIKVISION][test_connection] url={} device_id={:?} response_preview={}",
                        url, device_id, preview
                    );
                }
                DeviceConnectionResult {
                    ok: true,
                    message: None,
                    device_id,
                }
            }
            Err(e) => {
                if DEBUG_HIKVISION {
                    println!(
                        "[HIKVISION][test_connection] url={} error={}",
                        url, e
                    );
                }
                DeviceConnectionResult {
                    ok: false,
                    message: Some(e),
                    device_id: None,
                }
            }
        }
    }

    pub async fn create_user(
        &self,
        employee_no: &str,
        name: &str,
        gender: &str,
        begin_time: &str,
        end_time: &str,
    ) -> DeviceActionResult {
        let url = format!("{}/ISAPI/AccessControl/UserInfo/Record?format=json", self.base_url());
        
        let payload = json!({
            "UserInfo": {
                "employeeNo": employee_no,
                "name": name,
                "userType": "normal",
                "doorRight": "1",
                "RightPlan": [{ "doorNo": 1, "planTemplateNo": "1" }],
                "Valid": {
                    "enable": true,
                    "beginTime": begin_time,
                    "endTime": end_time,
                    "timeType": "local"
                },
                "gender": gender,
                "localUIRight": false,
                "maxOpenDoorTime": 0,
                "userVerifyMode": ""
            }
        });

        match self
            .auth_request_json(reqwest::Method::POST, &url, Some(payload))
            .await
        {
            Ok(text) => parse_action_result(&text),
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("RequestFailed".to_string()),
                error_msg: Some(e),
            },
        }
    }

    pub async fn upload_face(
        &self,
        employee_no: &str,
        name: &str,
        gender: &str,
        image_base64: &str,
    ) -> DeviceActionResult {
        let url = format!("{}/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json", self.base_url());
        
        let face_record = json!({
            "faceLibType": "blackFD",
            "FDID": "1",
            "FPID": employee_no,
            "name": name,
            "gender": gender
        });

        // Decode base64 image
        let image_bytes = match STANDARD.decode(image_base64) {
            Ok(bytes) => bytes,
            Err(e) => {
                return DeviceActionResult {
                    ok: false,
                    status_code: None,
                    status_string: Some("InvalidImage".to_string()),
                    error_msg: Some(e.to_string()),
                };
            }
        };

        if image_bytes.len() > MAX_FACE_IMAGE_BYTES {
            return DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("ImageTooLarge".to_string()),
                error_msg: Some(format!(
                    "Face image too large: {} bytes (max {} bytes)",
                    image_bytes.len(),
                    MAX_FACE_IMAGE_BYTES
                )),
            };
        }

        // Build multipart form
        let face_image_part = match reqwest::multipart::Part::bytes(image_bytes)
            .file_name("face.jpg")
            .mime_str("image/jpeg")
        {
            Ok(part) => part,
            Err(e) => {
                return DeviceActionResult {
                    ok: false,
                    status_code: None,
                    status_string: Some("UploadFailed".to_string()),
                    error_msg: Some(e.to_string()),
                };
            }
        };
        let form = reqwest::multipart::Form::new()
            .text("FaceDataRecord", face_record.to_string())
            .part("FaceImage", face_image_part);

        match self
            .send_with_auth(
                reqwest::Method::POST,
                &url,
                None,
                None,
                Some(form),
            )
            .await
        {
            Ok(res) => parse_action_result(&res.text().await.unwrap_or_default()),
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("UploadFailed".to_string()),
                error_msg: Some(e),
            },
        }
    }
}

