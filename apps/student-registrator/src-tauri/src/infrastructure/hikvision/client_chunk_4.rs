impl HikvisionClient {
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
}

