// Tauri Commands - Bridge between React UI and Rust backend

use crate::api::ApiClient;
use crate::command_services::{
    device_label, device_match_label, find_local_device_index, generate_employee_no,
    get_max_local_devices, is_credentials_expired, to_device_time,
};
use crate::hikvision::HikvisionClient;
use crate::storage::{get_device_by_id, load_devices, save_devices};
use crate::types::{
    DeviceConfig, DeviceConnectionResult, RegisterDeviceResult, RegisterResult,
    UserInfoSearchResponse,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{Datelike, Duration, Local, Utc};
use reqwest::Client;
use serde_json::Map;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

const MAX_FACE_IMAGE_BYTES: usize = 200 * 1024;
const WEBHOOK_CANDIDATE_PATHS: [&str; 2] = [
    "ISAPI/Event/notification/httpHosts?format=json",
    "ISAPI/Event/notification/httpHosts/1?format=json",
];
const WEBHOOK_RAW_CANDIDATE_PATHS: [&str; 2] = [
    "ISAPI/Event/notification/httpHosts",
    "ISAPI/Event/notification/httpHosts/1",
];

type SuccessfulDeviceEntry = (
    DeviceConfig,
    Option<String>,
    Option<String>,
    String,
    String,
);

include!("interfaces/tauri/commands/device_and_webhook_a.rs");
include!("interfaces/tauri/commands/webhook_helpers_b.rs");
include!("interfaces/tauri/commands/device_misc_b.rs");
include!("interfaces/tauri/commands/webhook_sync_and_check.rs");
include!("interfaces/tauri/commands/register_student_prepare.rs");
include!("interfaces/tauri/commands/register_student_devices.rs");
include!("interfaces/tauri/commands/register_student.rs");
include!("interfaces/tauri/commands/users.rs");
include!("interfaces/tauri/commands/provisioning.rs");
include!("interfaces/tauri/commands/clone_students.rs");
include!("interfaces/tauri/commands/clone_devices.rs");
