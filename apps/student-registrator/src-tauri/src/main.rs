#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod hikvision;
mod storage;
mod types;

use commands::*;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Device management
            get_devices,
            create_device,
            update_device,
            delete_device,
            test_device_connection,
            probe_device_connection,
            get_device_capabilities,
            get_device_configuration,
            update_device_configuration,
            check_student_on_device,
            // Student registration
            register_student,
            // User management
            fetch_users,
            delete_user,
            recreate_user,
            // Provisioning
            get_provisioning,
            retry_provisioning,
            // Clone
            clone_students_to_device,
            clone_device_to_device,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
