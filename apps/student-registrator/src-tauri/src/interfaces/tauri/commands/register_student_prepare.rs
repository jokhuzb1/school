struct RegisterStudentPreparation {
    full_name: String,
    employee_no: String,
    provisioning_id: Option<String>,
    api_client: Option<ApiClient>,
    backend_device_map: HashMap<String, String>,
    requested_target_backend_ids: Option<HashSet<String>>,
    explicit_db_only: bool,
    provisioned_target_backend_ids: HashSet<String>,
    begin_time: String,
    end_time: String,
}

#[allow(clippy::too_many_arguments)]
async fn prepare_register_student(
    name: &str,
    first_name: Option<String>,
    last_name: Option<String>,
    father_name: Option<String>,
    gender: &str,
    face_image_base64: &str,
    parent_phone: Option<String>,
    class_id: Option<String>,
    target_device_ids: Option<Vec<String>>,
    backend_url: Option<String>,
    backend_token: Option<String>,
    school_id: Option<String>,
) -> Result<RegisterStudentPreparation, String> {
    let backend_url = backend_url.filter(|v| !v.trim().is_empty());
    let backend_token = backend_token.filter(|v| !v.trim().is_empty());
    let school_id = school_id.filter(|v| !v.trim().is_empty());

    let full_name = {
        let first = first_name.clone().unwrap_or_default().trim().to_string();
        let last = last_name.clone().unwrap_or_default().trim().to_string();
        let combined = format!("{} {}", last, first).trim().to_string();
        if combined.is_empty() {
            name.trim().to_string()
        } else {
            combined
        }
    };

    if backend_url.is_some() && school_id.is_none() {
        return Err("schoolId is required when backendUrl is set".to_string());
    }

    let requested_target_backend_ids: Option<HashSet<String>> = target_device_ids.as_ref().map(|ids| {
        ids.iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .collect::<HashSet<String>>()
    });
    let explicit_db_only = requested_target_backend_ids
        .as_ref()
        .map(|ids| ids.is_empty())
        .unwrap_or(false);

    let mut employee_no = generate_employee_no();
    let mut provisioning_id: Option<String> = None;
    let mut api_client: Option<ApiClient> = None;
    let mut backend_device_map: HashMap<String, String> = HashMap::new();
    let mut provisioned_target_backend_ids: HashSet<String> = HashSet::new();

    if let (Some(url), Some(school_id)) = (backend_url.clone(), school_id.clone()) {
        let client = ApiClient::new(url, backend_token.clone());
        let request_id = Uuid::new_v4().to_string();
        let provisioning = client
            .start_provisioning(
                &school_id,
                &full_name,
                gender,
                Some(&employee_no),
                class_id.as_deref(),
                first_name.as_deref(),
                last_name.as_deref(),
                father_name.as_deref(),
                parent_phone.as_deref(),
                Some(face_image_base64),
                target_device_ids.as_deref(),
                &request_id,
            )
            .await
            .map_err(|e| format!("Backend provisioning failed: {}", e))?;

        if provisioning.device_student_id.chars().all(|c| c.is_ascii_digit()) {
            employee_no = provisioning.device_student_id;
        }
        provisioning_id = Some(provisioning.provisioning_id);
        if let Some(targets) = provisioning.target_devices.as_ref() {
            for device in targets {
                backend_device_map.insert(device.device_id.clone(), device.id.clone());
                provisioned_target_backend_ids.insert(device.id.clone());
            }
        }
        api_client = Some(client);
    }

    let now = Local::now();
    let begin_time = to_device_time(now);
    let end_time = to_device_time(now.with_year(now.year() + 10).unwrap_or(now));

    Ok(RegisterStudentPreparation {
        full_name,
        employee_no,
        provisioning_id,
        api_client,
        backend_device_map,
        requested_target_backend_ids,
        explicit_db_only,
        provisioned_target_backend_ids,
        begin_time,
        end_time,
    })
}
