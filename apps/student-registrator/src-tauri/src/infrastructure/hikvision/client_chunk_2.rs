impl HikvisionClient {
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
}

