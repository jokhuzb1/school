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

#[tauri::command]
pub async fn get_user_face_by_url(
    device_id: String,
    employee_no: String,
    face_url: String,
) -> Result<serde_json::Value, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    if is_credentials_expired(&device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }

    let client = HikvisionClient::new(device);
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

