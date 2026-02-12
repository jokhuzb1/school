fn parse_action_result(text: &str) -> DeviceActionResult {
    match serde_json::from_str::<Value>(text) {
        Ok(data) => {
            let status_code = data.get("statusCode").and_then(|v| v.as_i64()).map(|v| v as i32);
            let status_string = data.get("statusString").and_then(|v| v.as_str()).map(|s| s.to_string());
            let error_msg = data.get("errorMsg").and_then(|v| v.as_str()).map(|s| s.to_string());
            let ok = status_code == Some(1) || status_string.as_deref() == Some("OK");
            
            DeviceActionResult { ok, status_code, status_string, error_msg }
        }
        Err(_) => DeviceActionResult {
            ok: false,
            status_code: None,
            status_string: Some("ParseError".to_string()),
            error_msg: Some(text.to_string()),
        },
    }
}

fn extract_device_id(text: &str) -> Option<String> {
    let data: Value = serde_json::from_str(text).ok()?;
    if let Some(info) = data.get("DeviceInfo") {
        if let Some(id) = info.get("deviceID").and_then(|v| v.as_str()) {
            return Some(id.to_string());
        }
        if let Some(id) = info.get("DeviceID").and_then(|v| v.as_str()) {
            return Some(id.to_string());
        }
        if let Some(id) = info.get("deviceId").and_then(|v| v.as_str()) {
            return Some(id.to_string());
        }
    }
    data.get("deviceID")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}
