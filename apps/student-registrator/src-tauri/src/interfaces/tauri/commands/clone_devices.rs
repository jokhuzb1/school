#[tauri::command]
pub async fn clone_device_to_device(
    source_device_id: String,
    target_device_id: String,
    limit: Option<u32>,
) -> Result<Value, String> {
    let source = get_device_by_id(&source_device_id)
        .ok_or("Manba qurilma topilmadi")?;
    let target = get_device_by_id(&target_device_id)
        .ok_or("Maqsad qurilma topilmadi")?;

    if is_credentials_expired(&source) {
        return Err("Manba qurilmaning ulanish sozlamalari muddati tugagan".to_string());
    }
    if is_credentials_expired(&target) {
        return Err("Maqsad qurilmaning ulanish sozlamalari muddati tugagan".to_string());
    }

    let src_client = HikvisionClient::new(source.clone());
    let tgt_client = HikvisionClient::new(target.clone());

    let mut offset = 0i32;
    let page_size = 30i32;
    let max = limit.unwrap_or(10000) as i32;

    let mut processed = 0u32;
    let mut success = 0u32;
    let mut failed = 0u32;
    let mut skipped = 0u32;
    let mut errors: Vec<Value> = Vec::new();

    loop {
        if processed as i32 >= max {
            break;
        }
        let response = src_client.search_users(offset, page_size).await;
        let info = response.user_info_search;
        let users = info.and_then(|v| v.user_info).unwrap_or_default();
        if users.is_empty() {
            break;
        }

        for user in users {
            if processed as i32 >= max {
                break;
            }
            processed += 1;

            let employee_no = user.employee_no.clone();
            let name = user.name.clone();
            let gender_raw = user.gender.clone().unwrap_or_else(|| "male".to_string());
            let gender = match gender_raw.trim().to_lowercase().as_str() {
                "female" | "f" | "ayol" | "2" => "female",
                "male" | "m" | "erkak" | "1" => "male",
                "ma" | "male " => "male",
                "fa" | "female " => "female",
                other if other.contains("female") => "female",
                _ => "male",
            }.to_string();
            let face_url = user.face_url.clone().unwrap_or_default();

            if employee_no.trim().is_empty() || name.trim().is_empty() || face_url.trim().is_empty() {
                skipped += 1;
                errors.push(serde_json::json!({
                    "employeeNo": employee_no,
                    "name": name,
                    "reason": "Ma'lumot yetarli emas (employeeNo/name/faceURL)"
                }));
                continue;
            }

            let face_bytes = match src_client.fetch_face_image(&face_url).await {
                Ok(bytes) => bytes,
                Err(_) => {
                    failed += 1;
                    errors.push(serde_json::json!({
                        "employeeNo": employee_no,
                        "name": name,
                        "reason": "Rasmni manba qurilmadan olishda xato"
                    }));
                    continue;
                }
            };
            let face_base64 = STANDARD.encode(&face_bytes);

            let existing = tgt_client.get_user_by_employee_no(&employee_no).await;
            if existing.is_none() {
                let now = Local::now();
                let begin_time = to_device_time(now);
                let end_time = to_device_time(now.with_year(now.year() + 10).unwrap_or(now));
                let create = tgt_client
                    .create_user(&employee_no, &name, &gender, &begin_time, &end_time)
                    .await;
                if !create.ok {
                    let reason = create.error_msg.unwrap_or_else(|| "Create failed".to_string());
                    let lower = reason.to_lowercase();
                    if lower.contains("already exist")
                        || lower.contains("duplicate")
                        || lower.contains("exist")
                        || lower.contains("already")
                    {
                        skipped += 1;
                    } else {
                        failed += 1;
                        errors.push(serde_json::json!({
                            "employeeNo": employee_no,
                            "name": name,
                            "reason": reason
                        }));
                    }
                    continue;
                }
            }

            let upload = tgt_client
                .upload_face(&employee_no, &name, &gender, &face_base64)
                .await;
            if !upload.ok {
                failed += 1;
                errors.push(serde_json::json!({
                    "employeeNo": employee_no,
                    "name": name,
                    "reason": upload.error_msg.unwrap_or_else(|| "Upload failed".to_string())
                }));
                continue;
            }
            success += 1;
        }

        offset += page_size;
    }

    Ok(serde_json::json!({
        "ok": true,
        "source": device_match_label(&source),
        "target": device_match_label(&target),
        "processed": processed,
        "success": success,
        "failed": failed,
        "skipped": skipped,
        "errors": errors
    }))
}

#[cfg(test)]
mod tests {
    use super::{
        extract_urls_from_text, normalize_http_hosts_put_path, normalize_target_url_for_device,
        replace_xml_url_tags, sanitize_webhook_candidate,
    };

    #[test]
    fn sanitize_webhook_candidate_rejects_non_http() {
        assert!(sanitize_webhook_candidate("ftp://example.com").is_none());
        assert!(sanitize_webhook_candidate("").is_none());
    }

    #[test]
    fn sanitize_webhook_candidate_accepts_http_and_trims() {
        let value = sanitize_webhook_candidate("  https://example.com/hook  ");
        assert_eq!(value.as_deref(), Some("https://example.com/hook"));
    }

    #[test]
    fn replace_xml_url_tags_updates_all_matching_nodes() {
        let xml = "<root><url>a</url><Address>b</Address></root>";
        let (next, replaced) = replace_xml_url_tags(xml, "https://new.test/hook");
        assert_eq!(replaced, 2);
        assert!(next.contains("<url>https://new.test/hook</url>"));
        assert!(next.contains("<Address>https://new.test/hook</Address>"));
    }

    #[test]
    fn normalize_put_path_is_stable() {
        assert_eq!(
            normalize_http_hosts_put_path("/ISAPI/Event/notification/httpHosts/1"),
            "/ISAPI/Event/notification/httpHosts"
        );
        assert_eq!(
            normalize_http_hosts_put_path("/ISAPI/Event/notification/httpHosts"),
            "/ISAPI/Event/notification/httpHosts"
        );
    }

    #[test]
    fn normalize_target_url_removes_fragment_and_whitespace() {
        assert_eq!(
            normalize_target_url_for_device("  https://x.test/hook?x=1#fragment "),
            "/hook?x=1"
        );
    }

    #[test]
    fn extract_urls_from_text_finds_http_candidates() {
        let urls = extract_urls_from_text("prefix https://a.test/hook?x=1 and http://b.test/p");
        assert!(urls.iter().any(|value| value == "https://a.test/hook?x=1"));
        assert!(urls.iter().any(|value| value == "http://b.test/p"));
    }
}

