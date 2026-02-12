#[tauri::command]
pub async fn clone_students_to_device(
    backend_device_id: String,
    backend_url: Option<String>,
    backend_token: Option<String>,
    school_id: Option<String>,
    page_size: Option<u32>,
    max_students: Option<u32>,
) -> Result<Value, String> {
    let backend_url = backend_url.filter(|v| !v.trim().is_empty())
        .ok_or("backendUrl is required")?;
    let school_id = school_id.filter(|v| !v.trim().is_empty())
        .ok_or("schoolId is required")?;
    let token = backend_token.filter(|v| !v.trim().is_empty());
    let _per_page = page_size.unwrap_or(50).clamp(10, 200);
    let limit = max_students.unwrap_or(10000);

    let local_devices = load_devices();
    let local_index = find_local_device_index(&local_devices, &backend_device_id, None)
        .ok_or("Local ulanish sozlamasi topilmadi")?;
    let target_device = local_devices[local_index].clone();
    if is_credentials_expired(&target_device) {
        return Err("Ulanish sozlamalari muddati tugagan".to_string());
    }

    let client = Client::new();
    let mut page = 1u32;
    let mut total_processed = 0u32;
    let mut success = 0u32;
    let mut failed = 0u32;
    let mut skipped = 0u32;
    let mut errors: Vec<Value> = Vec::new();

    loop {
        if total_processed >= limit {
            break;
        }
        let url = format!(
            "{}/schools/{}/students?page={}",
            backend_url, school_id, page
        );
        let mut req = client.get(&url);
        if let Some(t) = token.as_ref() {
            req = req.header("Authorization", format!("Bearer {}", t));
        }
        let res = req.send().await.map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(text);
        }
        let payload: Value = res.json().await.map_err(|e| e.to_string())?;
        let data = payload.get("data").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        if data.is_empty() {
            break;
        }

        for item in data {
            if total_processed >= limit {
                break;
            }
            total_processed += 1;
            let student_id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let device_student_id = item.get("deviceStudentId").and_then(|v| v.as_str()).unwrap_or("");
            let full_name = item.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let gender = item.get("gender").and_then(|v| v.as_str()).unwrap_or("MALE");
            let photo_url = item.get("photoUrl").and_then(|v| v.as_str()).unwrap_or("");

            if device_student_id.is_empty() || full_name.is_empty() || photo_url.is_empty() {
                skipped += 1;
                errors.push(serde_json::json!({
                    "studentId": student_id,
                    "name": full_name,
                    "reason": "Ma'lumot yetarli emas (deviceStudentId/name/photoUrl)"
                }));
                continue;
            }

            let photo_full_url = if photo_url.starts_with("http://") || photo_url.starts_with("https://") {
                photo_url.to_string()
            } else {
                format!("{}{}", backend_url, photo_url)
            };

            let img_res = client.get(&photo_full_url).send().await;
            let bytes = match img_res {
                Ok(resp) if resp.status().is_success() => resp.bytes().await.map_err(|e| e.to_string())?.to_vec(),
                _ => {
                    failed += 1;
                    errors.push(serde_json::json!({
                        "studentId": student_id,
                        "name": full_name,
                        "reason": "Rasm yuklab bo'lmadi"
                    }));
                    continue;
                }
            };

            let face_base64 = STANDARD.encode(&bytes);
            let hik = HikvisionClient::new(target_device.clone());

            let now = Local::now();
            let begin_time = to_device_time(now);
            let end_time = to_device_time(now.with_year(now.year() + 10).unwrap_or(now));

            let create = hik.create_user(device_student_id, full_name, gender, &begin_time, &end_time).await;
            if !create.ok {
                failed += 1;
                errors.push(serde_json::json!({
                    "studentId": student_id,
                    "name": full_name,
                    "reason": create.error_msg.unwrap_or_else(|| "Create failed".to_string())
                }));
                continue;
            }

            let upload = hik.upload_face(device_student_id, full_name, gender, &face_base64).await;
            if !upload.ok {
                failed += 1;
                errors.push(serde_json::json!({
                    "studentId": student_id,
                    "name": full_name,
                    "reason": upload.error_msg.unwrap_or_else(|| "Upload failed".to_string())
                }));
                continue;
            }

            success += 1;
        }

        page += 1;
    }

    Ok(serde_json::json!({
        "ok": true,
        "device": device_match_label(&target_device),
        "processed": total_processed,
        "success": success,
        "failed": failed,
        "skipped": skipped,
        "errors": errors
    }))
}

