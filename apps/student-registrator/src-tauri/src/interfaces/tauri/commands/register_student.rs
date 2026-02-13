#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn register_student(
    name: String,
    first_name: Option<String>,
    last_name: Option<String>,
    father_name: Option<String>,
    gender: String,
    face_image_base64: String,
    parent_phone: Option<String>,
    class_id: Option<String>,
    target_device_ids: Option<Vec<String>>,
    backend_url: Option<String>,
    backend_token: Option<String>,
    school_id: Option<String>,
) -> Result<RegisterResult, String> {
    if face_image_base64.len() > (MAX_FACE_IMAGE_BYTES * 4 / 3) + 256 {
        return Err(format!(
            "Face image is too large. Max {} KB.",
            MAX_FACE_IMAGE_BYTES / 1024
        ));
    }

    let mut devices = load_devices();
    if devices.is_empty() {
        return Err("No devices configured".to_string());
    }

    let prepared = prepare_register_student(
        &name,
        first_name,
        last_name,
        father_name,
        &gender,
        &face_image_base64,
        parent_phone,
        class_id,
        target_device_ids,
        backend_url,
        backend_token,
        school_id,
    )
    .await?;

    let outcome = process_register_student_devices(
        &mut devices,
        &prepared,
        &gender,
        &face_image_base64,
    )
    .await;

    if outcome.devices_changed {
        let _ = save_devices(&devices);
    }

    if let Some(message) = outcome.abort_error {
        let rollback_reason = format!("Rolled back due to failure: {}", message);
        let mut rollback_errors: Vec<String> = Vec::new();
        let mut finalize_error: Option<String> = None;

        for (dev, backend_device_id, external_device_id, device_name, device_location) in outcome.successful_devices.iter() {
            let client = HikvisionClient::new(dev.clone());
            let result = client.delete_user(&prepared.employee_no).await;
            if !result.ok {
                let label = device_label(dev);
                let err = result.error_msg.clone().unwrap_or_else(|| "Delete failed".to_string());
                rollback_errors.push(format!("{}: {}", label, err));
            }
            if let (Some(api), Some(pid)) = (prepared.api_client.as_ref(), prepared.provisioning_id.as_ref()) {
                let status_error = if result.ok {
                    rollback_reason.clone()
                } else {
                    let err = result.error_msg.clone().unwrap_or_else(|| "Rollback delete failed".to_string());
                    format!("{}. Rollback delete failed: {}", rollback_reason, err)
                };
                let _ = api
                    .report_device_result(
                        pid,
                        backend_device_id.as_deref(),
                        external_device_id.as_deref(),
                        Some(device_name.as_str()),
                        None,
                        Some(device_location.as_str()),
                        "FAILED",
                        &prepared.employee_no,
                        Some(status_error.as_str()),
                    )
                    .await;
            }
        }

        if let (Some(api), Some(pid)) = (prepared.api_client.as_ref(), prepared.provisioning_id.as_ref()) {
            let finalize_reason = if rollback_errors.is_empty() {
                rollback_reason.clone()
            } else {
                format!("{}. Rollback errors: {}", rollback_reason, rollback_errors.join("; "))
            };
            if let Err(err) = api.finalize_provisioning_failure(pid, finalize_reason.as_str()).await {
                finalize_error = Some(err);
            }
        }

        if let Some(err) = finalize_error {
            if rollback_errors.is_empty() {
                return Err(format!("{}. Finalize failure xatosi: {}", message, err));
            }
            return Err(format!(
                "{}. Rollback errors: {}. Finalize failure xatosi: {}",
                message,
                rollback_errors.join("; "),
                err
            ));
        }
        if rollback_errors.is_empty() {
            return Err(message);
        }
        return Err(format!("{}. Rollback errors: {}", message, rollback_errors.join("; ")));
    }

    Ok(RegisterResult {
        employee_no: prepared.employee_no,
        provisioning_id: prepared.provisioning_id,
        results: outcome.results,
    })
}
