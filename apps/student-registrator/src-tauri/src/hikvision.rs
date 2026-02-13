// Hikvision ISAPI client - simplified with basic auth fallback
// Note: Hikvision devices may require Digest auth; this client tries Basic first,
// then falls back to Digest when it receives a 401 challenge.

use crate::types::{
    DeviceActionResult, DeviceConfig, DeviceConnectionResult, UserInfoEntry, UserInfoSearchResponse,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::{Client, Response};
use serde_json::{json, Value};
use std::time::Duration;

const DEFAULT_TIMEOUT_SECS: u64 = 8;
const MAX_FACE_IMAGE_BYTES: usize = 200 * 1024;
const DEBUG_HIKVISION: bool = false;

fn redact(value: &str) -> String {
    let max = 300usize;
    if value.len() > max {
        format!("{}...(len={})", &value[..max], value.len())
    } else {
        value.to_string()
    }
}

#[derive(Debug, Clone)]
struct DigestChallenge {
    realm: String,
    nonce: String,
    qop: Option<String>,
    opaque: Option<String>,
    algorithm: Option<String>,
}

pub struct HikvisionClient {
    device: DeviceConfig,
    client: Client,
}

include!("infrastructure/hikvision/client_chunk_1.rs");
include!("infrastructure/hikvision/client_chunk_2.rs");
include!("infrastructure/hikvision/client_chunk_3.rs");
include!("infrastructure/hikvision/client_chunk_4.rs");
include!("infrastructure/hikvision/client_chunk_5.rs");

include!("infrastructure/hikvision/helpers.rs");
