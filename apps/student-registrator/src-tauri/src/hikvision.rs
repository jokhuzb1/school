// Hikvision ISAPI client - simplified with basic auth fallback
// Note: Hikvision devices may require Digest auth; this client tries Basic first,
// then falls back to Digest when it receives a 401 challenge.

use crate::types::{DeviceActionResult, DeviceConfig, DeviceConnectionResult, UserInfoEntry, UserInfoSearchResponse};
use base64::{Engine as _, engine::general_purpose::STANDARD};
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

impl HikvisionClient {
    pub fn new(device: DeviceConfig) -> Self {
        let client = match Client::builder()
            .timeout(Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .build()
        {
            Ok(client) => client,
            Err(_) => Client::new(),
        };
        Self {
            device,
            client,
        }
    }

    fn base_url(&self) -> String {
        format!("http://{}:{}", self.device.host, self.device.port)
    }

    fn parse_digest_challenge(header_value: &str) -> Option<DigestChallenge> {
        let trimmed = header_value.trim();
        let rest = trimmed.strip_prefix("Digest")?.trim();

        // Split by comma, but keep quoted values intact.
        let mut parts: Vec<String> = Vec::new();
        let mut current = String::new();
        let mut in_quotes = false;
        for ch in rest.chars() {
            match ch {
                '"' => {
                    in_quotes = !in_quotes;
                    current.push(ch);
                }
                ',' if !in_quotes => {
                    parts.push(current.trim().to_string());
                    current.clear();
                }
                _ => current.push(ch),
            }
        }
        if !current.trim().is_empty() {
            parts.push(current.trim().to_string());
        }

        let mut realm: Option<String> = None;
        let mut nonce: Option<String> = None;
        let mut qop: Option<String> = None;
        let mut opaque: Option<String> = None;
        let mut algorithm: Option<String> = None;

        for item in parts {
            let (k, v) = item.split_once('=')?;
            let key = k.trim();
            let mut value = v.trim().to_string();
            if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
                value = value[1..value.len() - 1].to_string();
            }
            match key {
                "realm" => realm = Some(value),
                "nonce" => nonce = Some(value),
                "qop" => qop = Some(value),
                "opaque" => opaque = Some(value),
                "algorithm" => algorithm = Some(value),
                _ => {}
            }
        }

        Some(DigestChallenge {
            realm: realm?,
            nonce: nonce?,
            qop,
            opaque,
            algorithm,
        })
    }

    fn md5_hex(input: &str) -> String {
        format!("{:x}", md5::compute(input))
    }

    fn build_digest_authorization(
        &self,
        method: &str,
        url: &str,
        challenge: &DigestChallenge,
    ) -> Result<String, String> {
        let parsed = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
        let uri = match parsed.query() {
            Some(q) => format!("{}?{}", parsed.path(), q),
            None => parsed.path().to_string(),
        };

        let username = &self.device.username;
        let password = &self.device.password;
        let realm = &challenge.realm;
        let nonce = &challenge.nonce;

        let algorithm = challenge
            .algorithm
            .as_deref()
            .unwrap_or("MD5")
            .to_string();
        if algorithm.to_uppercase() != "MD5" {
            return Err(format!("Unsupported digest algorithm: {}", algorithm));
        }

        let ha1 = Self::md5_hex(&format!("{}:{}:{}", username, realm, password));
        let ha2 = Self::md5_hex(&format!("{}:{}", method, uri));

        // Prefer qop=auth when available.
        let qop_value = challenge
            .qop
            .as_deref()
            .and_then(|q| {
                q.split(',')
                    .map(|s| s.trim())
                    .find(|s| *s == "auth")
                    .map(|s| s.to_string())
            });

        let (response, nc, cnonce, qop) = if let Some(qop) = qop_value {
            let nc = "00000001".to_string();
            let cnonce = format!("{:x}", rand::random::<u64>());
            let resp = Self::md5_hex(&format!("{}:{}:{}:{}:{}:{}", ha1, nonce, nc, cnonce, qop, ha2));
            (resp, Some(nc), Some(cnonce), Some(qop))
        } else {
            let resp = Self::md5_hex(&format!("{}:{}:{}", ha1, nonce, ha2));
            (resp, None, None, None)
        };

        let mut header = format!(
            "Digest username=\"{}\", realm=\"{}\", nonce=\"{}\", uri=\"{}\", response=\"{}\"",
            username, realm, nonce, uri, response
        );
        if let Some(opaque) = &challenge.opaque {
            header.push_str(&format!(", opaque=\"{}\"", opaque));
        }
        header.push_str(", algorithm=MD5");
        if let (Some(qop), Some(nc), Some(cnonce)) = (qop, nc, cnonce) {
            header.push_str(&format!(", qop={}, nc={}, cnonce=\"{}\"", qop, nc, cnonce));
        }
        Ok(header)
    }

    async fn response_error(res: Response) -> String {
        let status = res.status();
        let reason = status.canonical_reason().unwrap_or("");
        let text = res.text().await.unwrap_or_default();
        if text.trim().is_empty() {
            format!("HTTP {}: {}", status, reason)
        } else {
            format!("HTTP {}: {}: {}", status, reason, text)
        }
    }

    async fn send_with_auth(
        &self,
        method: reqwest::Method,
        url: &str,
        body: Option<Vec<u8>>,
        content_type: Option<&str>,
        multipart: Option<reqwest::multipart::Form>,
    ) -> Result<Response, String> {
        if DEBUG_HIKVISION {
            println!(
                "[HIKVISION][send_with_auth] method={} url={} multipart={}",
                method.as_str(),
                url,
                multipart.is_some()
            );
        }
        // For multipart requests, we need to get digest challenge first with a simple request
        // because Form cannot be cloned and will be consumed.
        if multipart.is_some() {
            // First, try to get digest challenge with a simple GET to the same endpoint (no auth)
            let probe = self
                .client
                .request(reqwest::Method::GET, url)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if DEBUG_HIKVISION {
                let www = probe
                    .headers()
                    .get(reqwest::header::WWW_AUTHENTICATE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                println!(
                    "[HIKVISION][send_with_auth] multipart probe status={} www_auth={}",
                    probe.status(),
                    redact(www)
                );
            }

            if probe.status() == reqwest::StatusCode::UNAUTHORIZED {
                let www = probe
                    .headers()
                    .get(reqwest::header::WWW_AUTHENTICATE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");

                if let Some(challenge) = Self::parse_digest_challenge(www) {
                    let digest_header =
                        self.build_digest_authorization(method.as_str(), url, &challenge)?;
                    let mut req = self.client.request(method.clone(), url);
                    req = req.header(reqwest::header::AUTHORIZATION, digest_header);
                    if let Some(form) = multipart {
                        req = req.multipart(form);
                    }
                    let res = req.send().await.map_err(|e| e.to_string())?;
                    if !res.status().is_success() {
                        let err = format!(
                            "HTTP {}: {}",
                            res.status(),
                            res.status().canonical_reason().unwrap_or("")
                        );
                        if DEBUG_HIKVISION {
                            println!("[HIKVISION][send_with_auth] multipart digest failed: {}", err);
                        }
                        return Err(err);
                    }
                    return Ok(res);
                }
            }

            // Fallback to basic auth for multipart
            let mut req = self.client.request(method, url);
            req = req.basic_auth(&self.device.username, Some(&self.device.password));
            if let Some(form) = multipart {
                req = req.multipart(form);
            }
            let res = req.send().await.map_err(|e| e.to_string())?;
            if res.status().is_success() {
                if DEBUG_HIKVISION {
                    println!("[HIKVISION][send_with_auth] multipart basic ok");
                }
                return Ok(res);
            }

            if res.status() == reqwest::StatusCode::UNAUTHORIZED {
                let www = res
                    .headers()
                    .get(reqwest::header::WWW_AUTHENTICATE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                let err = format!(
                    "Unauthorized (no digest challenge). WWW-Authenticate: {}",
                    www
                );
                if DEBUG_HIKVISION {
                    println!("[HIKVISION][send_with_auth] multipart basic 401: {}", redact(&err));
                }
                return Err(err);
            }

            let err = format!(
                "HTTP {}: {}",
                res.status(),
                res.status().canonical_reason().unwrap_or("")
            );
            if DEBUG_HIKVISION {
                println!("[HIKVISION][send_with_auth] multipart basic failed: {}", err);
            }
            return Err(err);
        }

        // Non-multipart requests - try unauthenticated first to get digest challenge
        let mut req = self.client.request(method.clone(), url);
        if let Some(ct) = content_type {
            req = req.header("Content-Type", ct);
        }
        if let Some(b) = body.as_ref() {
            req = req.body(b.clone());
        }

        let first = req.send().await.map_err(|e| e.to_string())?;
        if first.status().is_success() {
            if DEBUG_HIKVISION {
                println!("[HIKVISION][send_with_auth] unauth success status={}", first.status());
            }
            return Ok(first);
        }

        let status = first.status();
        let www = first
            .headers()
            .get(reqwest::header::WWW_AUTHENTICATE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        if DEBUG_HIKVISION {
            println!(
                "[HIKVISION][send_with_auth] unauth status={} www_auth={}",
                status,
                redact(www)
            );
        }

        // Some devices return 400/403 for unauthenticated POSTs; try auth in those cases too.
        if !matches!(
            status,
            reqwest::StatusCode::UNAUTHORIZED
                | reqwest::StatusCode::BAD_REQUEST
                | reqwest::StatusCode::FORBIDDEN
        ) {
            let err = Self::response_error(first).await;
            if DEBUG_HIKVISION {
                println!("[HIKVISION][send_with_auth] unauth error: {}", redact(&err));
            }
            return Err(err);
        }

        if let Some(challenge) = Self::parse_digest_challenge(www) {
            let digest_header = self.build_digest_authorization(method.as_str(), url, &challenge)?;
            let mut req2 = self.client.request(method.clone(), url);
            req2 = req2.header(reqwest::header::AUTHORIZATION, digest_header);
            if let Some(ct) = content_type {
                req2 = req2.header("Content-Type", ct);
            }
            if let Some(b) = body.as_ref() {
                req2 = req2.body(b.clone());
            }

            let second = req2.send().await.map_err(|e| e.to_string())?;
            if !second.status().is_success() {
                let err = Self::response_error(second).await;
                if DEBUG_HIKVISION {
                    println!("[HIKVISION][send_with_auth] digest error: {}", redact(&err));
                }
                return Err(err);
            }
            if DEBUG_HIKVISION {
                println!("[HIKVISION][send_with_auth] digest ok");
            }
            return Ok(second);
        }

        // If no digest challenge, try basic auth as fallback
        let mut req2 = self.client.request(method.clone(), url);
        req2 = req2.basic_auth(&self.device.username, Some(&self.device.password));
        if let Some(ct) = content_type {
            req2 = req2.header("Content-Type", ct);
        }
        if let Some(b) = body.as_ref() {
            req2 = req2.body(b.clone());
        }

        let second = req2.send().await.map_err(|e| e.to_string())?;
        if second.status().is_success() {
            if DEBUG_HIKVISION {
                println!("[HIKVISION][send_with_auth] basic ok");
            }
            return Ok(second);
        }

        let www2 = second
            .headers()
            .get(reqwest::header::WWW_AUTHENTICATE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        if DEBUG_HIKVISION {
            println!(
                "[HIKVISION][send_with_auth] basic status={} www_auth={}",
                second.status(),
                redact(www2)
            );
        }

        if let Some(challenge) = Self::parse_digest_challenge(www2) {
            let digest_header = self.build_digest_authorization(method.as_str(), url, &challenge)?;
            let mut req3 = self.client.request(method, url);
            req3 = req3.header(reqwest::header::AUTHORIZATION, digest_header);
            if let Some(ct) = content_type {
                req3 = req3.header("Content-Type", ct);
            }
            if let Some(b) = body.as_ref() {
                req3 = req3.body(b.clone());
            }
            let third = req3.send().await.map_err(|e| e.to_string())?;
            if !third.status().is_success() {
                let err = Self::response_error(third).await;
                if DEBUG_HIKVISION {
                    println!("[HIKVISION][send_with_auth] basic->digest error: {}", redact(&err));
                }
                return Err(err);
            }
            if DEBUG_HIKVISION {
                println!("[HIKVISION][send_with_auth] basic->digest ok");
            }
            return Ok(third);
        }

        if second.status() == reqwest::StatusCode::UNAUTHORIZED {
            let err = format!(
                "Unauthorized (no digest challenge). WWW-Authenticate: {}",
                www2
            );
            if DEBUG_HIKVISION {
                println!("[HIKVISION][send_with_auth] basic 401: {}", redact(&err));
            }
            return Err(err);
        }

        let err = Self::response_error(second).await;
        if DEBUG_HIKVISION {
            println!("[HIKVISION][send_with_auth] basic error: {}", redact(&err));
        }
        Err(err)
    }

    /// Make authenticated JSON request (Basic → Digest fallback).
    async fn auth_request_json(
        &self,
        method: reqwest::Method,
        url: &str,
        body: Option<Value>,
    ) -> Result<String, String> {
        let body_string = body.map(|b| b.to_string());
        let response = self
            .send_with_auth(
                method,
                url,
                body_string.clone().map(|b| b.into_bytes()),
                body_string.as_ref().map(|_| "application/json"),
                None,
            )
            .await?;
        response.text().await.map_err(|e| e.to_string())
    }

    pub async fn test_connection(&self) -> DeviceConnectionResult {
        let url = format!("{}/ISAPI/System/deviceInfo?format=json", self.base_url());
        
        match self
            .auth_request_json(reqwest::Method::GET, &url, None)
            .await
        {
            Ok(text) => {
                let device_id = extract_device_id(&text);
                if DEBUG_HIKVISION {
                    let preview: String = text.chars().take(400).collect();
                    println!(
                        "[HIKVISION][test_connection] url={} device_id={:?} response_preview={}",
                        url, device_id, preview
                    );
                }
                DeviceConnectionResult {
                    ok: true,
                    message: None,
                    device_id,
                }
            }
            Err(e) => {
                if DEBUG_HIKVISION {
                    println!(
                        "[HIKVISION][test_connection] url={} error={}",
                        url, e
                    );
                }
                DeviceConnectionResult {
                    ok: false,
                    message: Some(e),
                    device_id: None,
                }
            }
        }
    }

    pub async fn create_user(
        &self,
        employee_no: &str,
        name: &str,
        gender: &str,
        begin_time: &str,
        end_time: &str,
    ) -> DeviceActionResult {
        let url = format!("{}/ISAPI/AccessControl/UserInfo/Record?format=json", self.base_url());
        
        let payload = json!({
            "UserInfo": {
                "employeeNo": employee_no,
                "name": name,
                "userType": "normal",
                "doorRight": "1",
                "RightPlan": [{ "doorNo": 1, "planTemplateNo": "1" }],
                "Valid": {
                    "enable": true,
                    "beginTime": begin_time,
                    "endTime": end_time,
                    "timeType": "local"
                },
                "gender": gender,
                "localUIRight": false,
                "maxOpenDoorTime": 0,
                "userVerifyMode": ""
            }
        });

        match self
            .auth_request_json(reqwest::Method::POST, &url, Some(payload))
            .await
        {
            Ok(text) => parse_action_result(&text),
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("RequestFailed".to_string()),
                error_msg: Some(e),
            },
        }
    }

    pub async fn upload_face(
        &self,
        employee_no: &str,
        name: &str,
        gender: &str,
        image_base64: &str,
    ) -> DeviceActionResult {
        let url = format!("{}/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json", self.base_url());
        
        let face_record = json!({
            "faceLibType": "blackFD",
            "FDID": "1",
            "FPID": employee_no,
            "name": name,
            "gender": gender
        });

        // Decode base64 image
        let image_bytes = match STANDARD.decode(image_base64) {
            Ok(bytes) => bytes,
            Err(e) => {
                return DeviceActionResult {
                    ok: false,
                    status_code: None,
                    status_string: Some("InvalidImage".to_string()),
                    error_msg: Some(e.to_string()),
                };
            }
        };

        if image_bytes.len() > MAX_FACE_IMAGE_BYTES {
            return DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("ImageTooLarge".to_string()),
                error_msg: Some(format!(
                    "Face image too large: {} bytes (max {} bytes)",
                    image_bytes.len(),
                    MAX_FACE_IMAGE_BYTES
                )),
            };
        }

        // Build multipart form
        let face_image_part = match reqwest::multipart::Part::bytes(image_bytes)
            .file_name("face.jpg")
            .mime_str("image/jpeg")
        {
            Ok(part) => part,
            Err(e) => {
                return DeviceActionResult {
                    ok: false,
                    status_code: None,
                    status_string: Some("UploadFailed".to_string()),
                    error_msg: Some(e.to_string()),
                };
            }
        };
        let form = reqwest::multipart::Form::new()
            .text("FaceDataRecord", face_record.to_string())
            .part("FaceImage", face_image_part);

        match self
            .send_with_auth(
                reqwest::Method::POST,
                &url,
                None,
                None,
                Some(form),
            )
            .await
        {
            Ok(res) => parse_action_result(&res.text().await.unwrap_or_default()),
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("UploadFailed".to_string()),
                error_msg: Some(e),
            },
        }
    }

    pub async fn search_users(&self, offset: i32, limit: i32) -> UserInfoSearchResponse {
        let url = format!("{}/ISAPI/AccessControl/UserInfo/Search?format=json", self.base_url());
        
        let payload = json!({
            "UserInfoSearchCond": {
                "searchID": format!("search-{}", chrono::Utc::now().timestamp()),
                "maxResults": limit,
                "searchResultPosition": offset
            }
        });

        match self
            .auth_request_json(reqwest::Method::POST, &url, Some(payload))
            .await
        {
            Ok(text) => serde_json::from_str(&text).unwrap_or(UserInfoSearchResponse { user_info_search: None }),
            Err(_) => UserInfoSearchResponse { user_info_search: None },
        }
    }

    pub async fn get_user_by_employee_no(&self, employee_no: &str) -> Option<UserInfoEntry> {
        let url = format!("{}/ISAPI/AccessControl/UserInfo/Search?format=json", self.base_url());
        
        let payload = json!({
            "UserInfoSearchCond": {
                "searchID": format!("search-{}", chrono::Utc::now().timestamp()),
                "maxResults": 1,
                "searchResultPosition": 0,
                "EmployeeNoList": [{ "employeeNo": employee_no }]
            }
        });

        match self
            .auth_request_json(reqwest::Method::POST, &url, Some(payload))
            .await
        {
            Ok(text) => {
                let result: UserInfoSearchResponse = serde_json::from_str(&text).ok()?;
                result.user_info_search?.user_info?.into_iter().next()
            }
            Err(_) => None,
        }
    }

    pub async fn delete_user(&self, employee_no: &str) -> DeviceActionResult {
        let url = format!("{}/ISAPI/AccessControl/UserInfo/Delete?format=json", self.base_url());
        
        let payload = json!({
            "UserInfoDelCond": {
                "EmployeeNoList": [{ "employeeNo": employee_no }]
            }
        });

        match self
            .auth_request_json(reqwest::Method::PUT, &url, Some(payload))
            .await
        {
            Ok(text) => parse_action_result(&text),
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("DeleteFailed".to_string()),
                error_msg: Some(e),
            },
        }
    }

    pub async fn get_isapi_json(&self, path: &str) -> Result<Value, String> {
        let clean = path.trim().trim_start_matches('/');
        let url = format!("{}/{}{}", self.base_url(), clean, if clean.contains('?') { "" } else { "?format=json" });
        let text = self
            .auth_request_json(reqwest::Method::GET, &url, None)
            .await?;
        serde_json::from_str::<Value>(&text).map_err(|e| e.to_string())
    }

    pub async fn put_isapi_json(&self, path: &str, payload: Value) -> Result<Value, String> {
        let clean = path.trim().trim_start_matches('/');
        let url = format!("{}/{}{}", self.base_url(), clean, if clean.contains('?') { "" } else { "?format=json" });
        let text = self
            .auth_request_json(reqwest::Method::PUT, &url, Some(payload))
            .await?;
        serde_json::from_str::<Value>(&text).map_err(|e| e.to_string())
    }

    pub async fn get_isapi_raw(&self, path: &str) -> Result<String, String> {
        let clean = path.trim().trim_start_matches('/');
        let url = format!("{}/{}", self.base_url(), clean);
        let res = self
            .send_with_auth(reqwest::Method::GET, &url, None, None, None)
            .await?;
        res.text().await.map_err(|e| e.to_string())
    }

    pub async fn put_isapi_raw(
        &self,
        path: &str,
        payload: String,
        content_type: Option<&str>,
    ) -> Result<String, String> {
        let clean = path.trim().trim_start_matches('/');
        let url = format!("{}/{}", self.base_url(), clean);
        let res = self
            .send_with_auth(
                reqwest::Method::PUT,
                &url,
                Some(payload.into_bytes()),
                content_type,
                None,
            )
            .await?;
        res.text().await.map_err(|e| e.to_string())
    }

    pub async fn probe_capabilities(&self) -> Value {
        let probes = vec![
            ("deviceInfo", "ISAPI/System/deviceInfo?format=json"),
            ("status", "ISAPI/System/status?format=json"),
            ("time", "ISAPI/System/time?format=json"),
            ("ntpServers", "ISAPI/System/Network/ntpServers?format=json"),
            ("networkInterfaces", "ISAPI/System/Network/interfaces?format=json"),
            ("systemCapabilities", "ISAPI/System/capabilities?format=json"),
        ];

        let mut supported = serde_json::Map::new();
        let mut details = serde_json::Map::new();

        for (key, path) in probes {
            match self.get_isapi_json(path).await {
                Ok(value) => {
                    supported.insert(key.to_string(), Value::Bool(true));
                    details.insert(key.to_string(), value);
                }
                Err(err) => {
                    supported.insert(key.to_string(), Value::Bool(false));
                    details.insert(
                        format!("{}_error", key),
                        Value::String(err),
                    );
                }
            }
        }

        json!({
            "supported": supported,
            "details": details
        })
    }

    /// Fetch face image from device to reuse it
    pub async fn fetch_face_image(&self, face_url: &str) -> Result<Vec<u8>, String> {
        let full_url = if face_url.starts_with("http") {
            face_url.to_string()
        } else {
            format!("{}/{}", self.base_url(), face_url.trim_start_matches('/'))
        };

        let response = self
            .send_with_auth(reqwest::Method::GET, &full_url, None, None, None)
            .await?;

        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        Ok(bytes.to_vec())
    }
}

fn parse_action_result(text: &str) -> DeviceActionResult {
    match serde_json::from_str::<Value>(text) {
        Ok(data) => {
            let status_code = data.get("statusCode").and_then(|v| v.as_i64()).map(|v| v as i32);
            let status_string = data.get("statusString").and_then(|v| v.as_str()).map(|s| s.to_string());
            let error_msg = data.get("errorMsg").and_then(|v| v.as_str()).map(|s| s.to_string());
            let ok = status_code == Some(1) || status_string.as_deref() == Some("OK");
            
            DeviceActionResult { ok, status_code, status_string, error_msg }
        }
        Err(_) => DeviceActionResult {
            ok: false,
            status_code: None,
            status_string: Some("ParseError".to_string()),
            error_msg: Some(text.to_string()),
        },
    }
}

fn extract_device_id(text: &str) -> Option<String> {
    let data: Value = serde_json::from_str(text).ok()?;
    if let Some(info) = data.get("DeviceInfo") {
        if let Some(id) = info.get("deviceID").and_then(|v| v.as_str()) {
            return Some(id.to_string());
        }
        if let Some(id) = info.get("DeviceID").and_then(|v| v.as_str()) {
            return Some(id.to_string());
        }
        if let Some(id) = info.get("deviceId").and_then(|v| v.as_str()) {
            return Some(id.to_string());
        }
    }
    data.get("deviceID")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}
