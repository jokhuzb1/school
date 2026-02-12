impl HikvisionClient {
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

