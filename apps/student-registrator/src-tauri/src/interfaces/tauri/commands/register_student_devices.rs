struct RegisterDeviceProcessOutcome {
    results: Vec<RegisterDeviceResult>,
    successful_devices: Vec<SuccessfulDeviceEntry>,
    abort_error: Option<String>,
    devices_changed: bool,
}

async fn process_register_student_devices(
    devices: &mut [DeviceConfig],
    prepared: &RegisterStudentPreparation,
    gender: &str,
    face_image_base64: &str,
) -> RegisterDeviceProcessOutcome {
    let mut results = Vec::new();
    let mut successful_devices: Vec<SuccessfulDeviceEntry> = Vec::new();
    let mut abort_error: Option<String> = None;
    let mut devices_changed = false;

    for device in devices.iter_mut() {
        if abort_error.is_some() {
            break;
        }
        if prepared.explicit_db_only {
            continue;
        }

        let selected_set: Option<&HashSet<String>> = if let Some(requested) = prepared.requested_target_backend_ids.as_ref() {
            Some(requested)
        } else if !prepared.provisioned_target_backend_ids.is_empty() {
            Some(&prepared.provisioned_target_backend_ids)
        } else {
            None
        };

        let selected_by_backend_id = selected_set.is_none_or(|ids| {
            device
                .backend_id
                .as_ref()
                .map(|id| ids.contains(id))
                .unwrap_or(false)
        });

        if !selected_by_backend_id && selected_set.is_some() {
            let selected_by_legacy_device_id = selected_set
                .and_then(|ids| {
                    device
                        .device_id
                        .as_ref()
                        .and_then(|id| prepared.backend_device_map.get(id))
                        .map(|backend_id| ids.contains(backend_id))
                })
                .unwrap_or(false);
            if !selected_by_legacy_device_id {
                continue;
            }
        }

        if is_credentials_expired(device) {
            let external_device_id = device.device_id.as_deref();
            let backend_device_id = device
                .backend_id
                .as_deref()
                .or_else(|| external_device_id.and_then(|id| prepared.backend_device_map.get(id).map(|s| s.as_str())));
            let connection = DeviceConnectionResult {
                ok: false,
                message: Some("Ulanish sozlamalari muddati tugagan".to_string()),
                device_id: device.device_id.clone(),
            };
            if let (Some(api), Some(pid)) = (prepared.api_client.as_ref(), prepared.provisioning_id.as_ref()) {
                let device_display_name = device_label(device);
                let device_name = Some(device_display_name.as_str());
                let device_location = Some(device.host.as_str());
                if let Err(err) = api
                    .report_device_result(
                        pid,
                        backend_device_id,
                        external_device_id,
                        device_name,
                        None,
                        device_location,
                        "FAILED",
                        &prepared.employee_no,
                        connection.message.as_deref(),
                    )
                    .await
                {
                    abort_error = Some(format!("Backend report failed: {}", err));
                }
            }
            results.push(RegisterDeviceResult {
                device_id: device.id.clone(),
                device_name: device_label(device),
                connection,
                user_create: None,
                face_upload: None,
            });
            if abort_error.is_none() {
                abort_error = Some(format!(
                    "Qurilma {}: Ulanish sozlamalari muddati tugagan",
                    device_label(device)
                ));
            }
            continue;
        }

        let client = HikvisionClient::new(device.clone());
        let connection = client.test_connection().await;
        if connection.ok {
            if let Some(device_id) = connection.device_id.clone() {
                if device.device_id.as_deref() != Some(device_id.as_str()) {
                    device.device_id = Some(device_id);
                    devices_changed = true;
                }
            }
        }
        let external_device_id = connection.device_id.clone().or(device.device_id.clone());
        let backend_device_id = device
            .backend_id
            .clone()
            .or_else(|| external_device_id.as_ref().and_then(|id| prepared.backend_device_map.get(id).cloned()));
        let device_display_name = device_label(device);
        let device_name = Some(device_display_name.as_str());
        let device_location = Some(device.host.as_str());

        if !connection.ok {
            let connection_message = connection.message.clone();
            if let (Some(api), Some(pid)) = (prepared.api_client.as_ref(), prepared.provisioning_id.as_ref()) {
                if let Err(err) = api
                    .report_device_result(
                        pid,
                        backend_device_id.as_deref(),
                        external_device_id.as_deref(),
                        device_name,
                        None,
                        device_location,
                        "FAILED",
                        &prepared.employee_no,
                        connection.message.as_deref(),
                    )
                    .await
                {
                    abort_error = Some(format!("Backend report failed: {}", err));
                }
            }
            results.push(RegisterDeviceResult {
                device_id: device.id.clone(),
                device_name: device_label(device),
                connection,
                user_create: None,
                face_upload: None,
            });
            if abort_error.is_none() {
                let reason = connection_message.unwrap_or_else(|| "Ulanishda xato".to_string());
                abort_error = Some(format!("Qurilma {}: {}", device_label(device), reason));
            }
            continue;
        }

        let user_create = client
            .create_user(
                &prepared.employee_no,
                &prepared.full_name,
                gender,
                &prepared.begin_time,
                &prepared.end_time,
            )
            .await;

        if !user_create.ok {
            if let (Some(api), Some(pid)) = (prepared.api_client.as_ref(), prepared.provisioning_id.as_ref()) {
                if let Err(err) = api
                    .report_device_result(
                        pid,
                        backend_device_id.as_deref(),
                        external_device_id.as_deref(),
                        device_name,
                        None,
                        device_location,
                        "FAILED",
                        &prepared.employee_no,
                        user_create.error_msg.as_deref(),
                    )
                    .await
                {
                    abort_error = Some(format!("Backend report failed: {}", err));
                }
            }
            results.push(RegisterDeviceResult {
                device_id: device.id.clone(),
                device_name: device_label(device),
                connection,
                user_create: Some(user_create),
                face_upload: None,
            });
            if abort_error.is_none() {
                abort_error = Some(format!(
                    "Qurilma {}: Qurilmada foydalanuvchi yaratishda xato",
                    device_label(device)
                ));
            }
            continue;
        }

        let face_upload = client
            .upload_face(&prepared.employee_no, &prepared.full_name, gender, face_image_base64)
            .await;

        if let (Some(api), Some(pid)) = (prepared.api_client.as_ref(), prepared.provisioning_id.as_ref()) {
            let status = if face_upload.ok { "SUCCESS" } else { "FAILED" };
            if let Err(err) = api
                .report_device_result(
                    pid,
                    backend_device_id.as_deref(),
                    external_device_id.as_deref(),
                    device_name,
                    None,
                    device_location,
                    status,
                    &prepared.employee_no,
                    face_upload.error_msg.as_deref(),
                )
                .await
            {
                abort_error = Some(format!("Backend report failed: {}", err));
            }
        }

        results.push(RegisterDeviceResult {
            device_id: device.id.clone(),
            device_name: device_label(device),
            connection,
            user_create: Some(user_create),
            face_upload: Some(face_upload.clone()),
        });

        if face_upload.ok {
            successful_devices.push((
                device.clone(),
                backend_device_id,
                external_device_id,
                device_display_name.clone(),
                device.host.clone(),
            ));
        } else {
            let _ = client.delete_user(&prepared.employee_no).await;
            if abort_error.is_none() {
                abort_error = Some(format!(
                    "Qurilma {}: Qurilmaga rasm yuklashda xato",
                    device_label(device)
                ));
            }
        }
    }

    RegisterDeviceProcessOutcome {
        results,
        successful_devices,
        abort_error,
        devices_changed,
    }
}
