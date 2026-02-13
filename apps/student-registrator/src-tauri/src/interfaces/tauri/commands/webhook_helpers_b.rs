async fn read_http_host_urls(client: &HikvisionClient, host_id: &str) -> Vec<String> {
    let single_path = format!("ISAPI/Event/notification/httpHosts/{}?format=json", host_id);
    if let Ok(single_raw) = client.get_isapi_json(single_path.as_str()).await {
        let scoped = serde_json::json!({ "HttpHostNotification": single_raw.get("HttpHostNotification").cloned().unwrap_or(single_raw.clone()) });
        let urls = extract_webhook_urls_from_json(&scoped);
        if !urls.is_empty() {
            return urls;
        }
    }
    if let Ok(list_raw) = client.get_isapi_json("ISAPI/Event/notification/httpHosts?format=json").await {
        let urls = extract_webhook_urls_from_json(&list_raw);
        if !urls.is_empty() {
            return urls;
        }
    }
    Vec::new()
}

fn extract_direct_url_candidates(text: &str, out: &mut Vec<String>) {
    let bytes = text.as_bytes();
    let mut i = 0usize;
    while i + 7 < bytes.len() {
        if text[i..].starts_with("http://")
            || text[i..].starts_with("https://")
            || text[i..].starts_with("/webhook/")
        {
            let start = i;
            let mut end = i;
            while end < bytes.len() {
                let c = bytes[end] as char;
                if c.is_whitespace() || c == '"' || c == '\'' || c == '<' || c == '>' {
                    break;
                }
                end += 1;
            }
            if end > start {
                out.push(text[start..end].trim().to_string());
            }
            i = end;
            continue;
        }
        i += 1;
    }
}

fn extract_xml_tag_values(text: &str) -> Vec<String> {
    let tag_names = ["url", "httpurl", "hosturl", "callbackurl"];
    let source = decode_markup_entities(text);
    let lower = source.to_lowercase();
    let bytes = source.as_bytes();
    let mut out = Vec::<String>::new();
    let mut i = 0usize;
    while i < bytes.len() {
        let Some(rel_open) = source[i..].find('<') else { break };
        let open = i + rel_open;
        let Some(rel_end) = source[open..].find('>') else { break };
        let end = open + rel_end;
        if end <= open + 1 {
            i = end + 1;
            continue;
        }
        let token = &source[open + 1..end];
        let trimmed = token.trim();
        if trimmed.starts_with('/') || trimmed.starts_with('?') || trimmed.starts_with('!') {
            i = end + 1;
            continue;
        }
        let raw_name = trimmed
            .split_whitespace()
            .next()
            .unwrap_or("");
        let base_name = raw_name
            .split(':')
            .next_back()
            .unwrap_or(raw_name)
            .to_lowercase();
        if !tag_names.iter().any(|name| *name == base_name) {
            i = end + 1;
            continue;
        }
        let mut search = end + 1;
        let mut close_start_opt: Option<usize> = None;
        let mut close_end_opt: Option<usize> = None;
        while search < bytes.len() {
            let Some(rel_close_open) = source[search..].find("</") else { break };
            let close_open = search + rel_close_open;
            let Some(rel_close_end) = source[close_open..].find('>') else { break };
            let close_end = close_open + rel_close_end;
            let close_token = source[close_open + 2..close_end].trim();
            let close_base = close_token
                .split_whitespace()
                .next()
                .unwrap_or("")
                .split(':')
                .next_back()
                .unwrap_or("")
                .to_lowercase();
            if close_base == base_name {
                close_start_opt = Some(close_open);
                close_end_opt = Some(close_end);
                break;
            }
            search = close_end + 1;
        }
        if let (Some(close_start), Some(close_end)) = (close_start_opt, close_end_opt) {
            if close_start > end + 1 {
                let value = lower[end + 1..close_start].trim();
                if !value.is_empty() {
                    out.push(source[end + 1..close_start].trim().to_string());
                }
            }
            i = close_end + 1;
            continue;
        }
        i = end + 1;
    }
    out
}

fn extract_urls_from_text(text: &str) -> Vec<String> {
    let decoded = decode_markup_entities(text);
    let mut urls: Vec<String> = Vec::new();
    extract_direct_url_candidates(&decoded, &mut urls);
    urls.extend(extract_xml_tag_values(&decoded));
    clean_webhook_candidates(urls)
}

fn is_valid_webhook_candidate(url: &str) -> bool {
    let lower = url.to_lowercase();
    if lower.contains("isapi.org/ver20/xmlschema") {
        return false;
    }
    if lower.contains("&gt;") || lower.contains("&lt;") || lower.contains('<') || lower.contains('>') {
        return false;
    }
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || (lower.starts_with('/') && !lower.starts_with("/isapi/"))
}

fn pick_primary_webhook_url(urls: &[String], direction: &str) -> Option<String> {
    let dir = direction.to_lowercase();
    urls.iter()
        .find(|u| {
            let lower = u.to_lowercase();
            let direction_match =
                lower.contains(&format!("/{dir}?"))
                    || lower.ends_with(&format!("/{dir}"))
                    || lower.contains(&format!("/{dir}&"));
            is_valid_webhook_candidate(u) && (direction_match || lower.contains("secret="))
        })
        .cloned()
        .or_else(|| urls.iter().find(|u| is_valid_webhook_candidate(u)).cloned())
}

fn replace_xml_url_tags(xml: &str, target_url: &str) -> (String, usize) {
    let tags = ["url", "URL", "httpUrl", "HttpUrl", "HTTPUrl", "address", "Address"];
    let mut out = xml.to_string();
    let mut total = 0usize;
    for tag in tags {
        let open = format!("<{}>", tag);
        let close = format!("</{}>", tag);
        let mut start = 0usize;
        while let Some(open_pos_rel) = out[start..].find(&open) {
            let open_pos = start + open_pos_rel;
            let value_start = open_pos + open.len();
            let Some(close_pos_rel) = out[value_start..].find(&close) else { break };
            let close_pos = value_start + close_pos_rel;
            out.replace_range(value_start..close_pos, target_url);
            total += 1;
            start = value_start + target_url.len() + close.len();
        }
    }
    (out, total)
}

fn normalize_http_hosts_put_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.contains("ISAPI/Event/notification/httpHosts/1") {
        return trimmed.replace(
            "ISAPI/Event/notification/httpHosts/1",
            "ISAPI/Event/notification/httpHosts",
        );
    }
    trimmed.to_string()
}

fn normalize_target_url_for_device(target_url: &str) -> String {
    let trimmed = target_url.trim();
    if let Ok(parsed) = reqwest::Url::parse(trimmed) {
        let mut value = parsed.path().to_string();
        if let Some(query) = parsed.query() {
            value.push('?');
            value.push_str(query);
        }
        if value.is_empty() {
            "/".to_string()
        } else {
            value
        }
    } else {
        trimmed.to_string()
    }
}

