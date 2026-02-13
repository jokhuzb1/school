use crate::commands::*;

pub fn run() {
    if let Err(err) = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_contract_version,
            get_devices,
            create_device,
            update_device,
            delete_device,
            test_device_connection,
            probe_device_connection,
            get_device_capabilities,
            get_device_configuration,
            update_device_configuration,
            get_device_webhook_config,
            sync_device_webhook_config,
            check_student_on_device,
            register_student,
            fetch_users,
            delete_user,
            get_user_face,
            get_user_face_by_url,
            recreate_user,
            get_provisioning,
            retry_provisioning,
            clone_students_to_device,
            clone_device_to_device,
        ])
        .run(tauri::generate_context!())
    {
        eprintln!("error while running tauri application: {}", err);
    }
}
