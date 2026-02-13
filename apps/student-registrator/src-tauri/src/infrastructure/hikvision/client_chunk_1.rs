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
}

