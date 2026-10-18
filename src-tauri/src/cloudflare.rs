use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudflareRecord {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub record_type: String,
    pub name: String,
    pub content: String,
    pub proxied: Option<bool>,
    pub ttl: Option<u32>,
    pub priority: Option<u16>,
}

#[derive(Debug, Deserialize)]
struct CfApiResponse<T> {
    success: bool,
    errors: Vec<CfApiError>,
    result: Option<T>,
}

#[derive(Debug, Deserialize)]
struct CfApiError {
    code: i64,
    message: String,
}

#[derive(Debug, Deserialize)]
struct ZoneResult {
    id: String,
    name: String,
}

pub struct CloudflareClient {
    client: reqwest::Client,
    #[allow(dead_code)]
    pub api_token: String,
}

impl CloudflareClient {
    pub fn new(api_token: String) -> Self {
        let mut headers = HeaderMap::new();
        let auth_val = format!("Bearer {}", api_token.trim());
        if let Ok(mut val) = HeaderValue::from_str(&auth_val) {
            val.set_sensitive(true);
            headers.insert(AUTHORIZATION, val);
        }
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .unwrap_or_default();

        Self { client, api_token }
    }

    /// Auto-fetch the Zone ID for a given domain name
    pub async fn fetch_zone_id(&self, domain: &str) -> Result<String, String> {
        let clean_domain = domain.trim().trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');
        let url = format!("https://api.cloudflare.com/client/v4/zones?name={}", clean_domain);

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to reach Cloudflare API: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Cloudflare API error ({}): {}", status, body));
        }

        let cf_res: CfApiResponse<Vec<ZoneResult>> = resp
            .json()
            .await
            .map_err(|e| format!("Invalid JSON from Cloudflare: {}", e))?;

        if !cf_res.success {
            let msg = cf_res
                .errors
                .into_iter()
                .map(|e| format!("{}: {}", e.code, e.message))
                .collect::<Vec<_>>()
                .join(", ");
            return Err(format!("Cloudflare error: {}", msg));
        }

        if let Some(zones) = cf_res.result {
            if let Some(zone) = zones.into_iter().find(|z| z.name.eq_ignore_ascii_case(clean_domain)) {
                return Ok(zone.id);
            }
        }

        Err(format!("Zone for domain '{}' not found in your Cloudflare account.", clean_domain))
    }

    /// Upsert a single DNS record (search by name + type, update if exists, insert if not)
    pub async fn upsert_dns_record(
        &self,
        zone_id: &str,
        record_type: &str,
        name: &str,
        content: &str,
        proxied: bool,
        priority: Option<u16>,
    ) -> Result<String, String> {
        let clean_zone = zone_id.trim();
        let clean_name = name.trim();
        let clean_content = content.trim();

        // 1. Search for existing record
        let search_url = format!(
            "https://api.cloudflare.com/client/v4/zones/{}/dns_records?type={}&name={}",
            clean_zone, record_type, clean_name
        );

        let list_resp = self
            .client
            .get(&search_url)
            .send()
            .await
            .map_err(|e| format!("Error querying DNS records: {}", e))?;

        let list_data: CfApiResponse<Vec<CloudflareRecord>> = list_resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse DNS list response: {}", e))?;

        let mut payload = serde_json::json!({
            "type": record_type,
            "name": clean_name,
            "content": clean_content,
            "ttl": 1, // Auto TTL
        });

        if record_type == "A" || record_type == "AAAA" || record_type == "CNAME" {
            payload["proxied"] = serde_json::Value::Bool(proxied);
        }

        if let Some(prio) = priority {
            payload["priority"] = serde_json::Value::Number(prio.into());
        }

        if let Some(existing_records) = list_data.result {
            if let Some(first_match) = existing_records.first() {
                if let Some(record_id) = &first_match.id {
                    // Update existing
                    let update_url = format!(
                        "https://api.cloudflare.com/client/v4/zones/{}/dns_records/{}",
                        clean_zone, record_id
                    );

                    let put_resp = self
                        .client
                        .put(&update_url)
                        .json(&payload)
                        .send()
                        .await
                        .map_err(|e| format!("Error updating DNS record: {}", e))?;

                    let put_data: CfApiResponse<CloudflareRecord> = put_resp
                        .json()
                        .await
                        .map_err(|e| format!("Failed to parse DNS update response: {}", e))?;

                    if put_data.success {
                        return Ok(format!("Updated {} record for {}", record_type, clean_name));
                    } else {
                        let err_msg = put_data
                            .errors
                            .into_iter()
                            .map(|e| e.message)
                            .collect::<Vec<_>>()
                            .join(", ");
                        return Err(format!("Failed to update {} record: {}", record_type, err_msg));
                    }
                }
            }
        }

        // Create new record
        let create_url = format!(
            "https://api.cloudflare.com/client/v4/zones/{}/dns_records",
            clean_zone
        );

        let post_resp = self
            .client
            .post(&create_url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Error creating DNS record: {}", e))?;

        let post_data: CfApiResponse<CloudflareRecord> = post_resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse DNS create response: {}", e))?;

        if post_data.success {
            Ok(format!("Created {} record for {}", record_type, clean_name))
        } else {
            let err_msg = post_data
                .errors
                .into_iter()
                .map(|e| e.message)
                .collect::<Vec<_>>()
                .join(", ");
            Err(format!("Failed to create {} record: {}", record_type, err_msg))
        }
    }

    /// Configure the initial DNS records (A for root/www/mail, MX, SPF, DMARC)
    pub async fn configure_initial_dns(
        &self,
        zone_id: &str,
        domain: &str,
        vm_ip: &str,
        smtp_relay_host: &str,
    ) -> Result<Vec<String>, String> {
        let mut results = Vec::new();
        let clean_domain = domain.trim();

        // 1. A record: @ -> VM_IP (proxied: false initially for Let's Encrypt TLS-ALPN-01 & HTTP-01 challenges)
        results.push(
            self.upsert_dns_record(zone_id, "A", clean_domain, vm_ip, false, None)
                .await?,
        );

        // 2. A record: www -> VM_IP (proxied: false)
        let www_name = format!("www.{}", clean_domain);
        results.push(
            self.upsert_dns_record(zone_id, "A", &www_name, vm_ip, false, None)
                .await?,
        );

        // 3. A record: mail -> VM_IP (proxied: false - mail server MUST not be proxied by Cloudflare HTTP proxy)
        let mail_name = format!("mail.{}", clean_domain);
        results.push(
            self.upsert_dns_record(zone_id, "A", &mail_name, vm_ip, false, None)
                .await?,
        );

        // 4. MX record: @ -> mail.{domain} with Priority 10
        results.push(
            self.upsert_dns_record(zone_id, "MX", clean_domain, &mail_name, false, Some(10))
                .await?,
        );

        // 5. TXT record: SPF
        let relay_domain = smtp_relay_host
            .trim()
            .trim_start_matches("smtp.")
            .trim_start_matches("smtp-relay.");
        let spf_content = if !relay_domain.is_empty() {
            format!("v=spf1 mx include:{} ~all", relay_domain)
        } else {
            "v=spf1 mx ~all".to_string()
        };
        results.push(
            self.upsert_dns_record(zone_id, "TXT", clean_domain, &spf_content, false, None)
                .await?,
        );

        // 6. TXT record: DMARC
        let dmarc_name = format!("_dmarc.{}", clean_domain);
        let dmarc_content = format!(
            "v=DMARC1; p=quarantine; rua=mailto:admin@{}",
            clean_domain
        );
        results.push(
            self.upsert_dns_record(zone_id, "TXT", &dmarc_name, &dmarc_content, false, None)
                .await?,
        );

        Ok(results)
    }

    /// Push DKIM record parsed from docker-mailserver OpenDKIM keys
    pub async fn push_dkim_record(
        &self,
        zone_id: &str,
        domain: &str,
        raw_dkim_text: &str,
    ) -> Result<String, String> {
        let clean_domain = domain.trim();
        let (record_name, dkim_content) = parse_opendkim_key(clean_domain, raw_dkim_text)?;

        self.upsert_dns_record(
            zone_id,
            "TXT",
            &record_name,
            &dkim_content,
            false,
            None,
        )
        .await
    }
}

/// Parses OpenDKIM output file (e.g. mail._domainkey.example.com. IN TXT ( "v=DKIM1; ... " ) )
pub fn parse_opendkim_key(domain: &str, raw: &str) -> Result<(String, String), String> {
    if raw.contains("NO_DKIM_FILE_FOUND") || raw.trim().is_empty() {
        return Err("No DKIM file output was captured from the mail server container.".into());
    }

    // Default target name
    let default_name = format!("mail._domainkey.{}", domain);

    // Look for parts inside quotes or parentheses
    let mut parts = Vec::new();
    let mut in_quote = false;
    let mut current_part = String::new();

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(';') {
            continue; // Skip comments
        }
        for ch in line.chars() {
            if ch == '"' {
                if in_quote {
                    parts.push(current_part.clone());
                    current_part.clear();
                    in_quote = false;
                } else {
                    in_quote = true;
                }
            } else if in_quote {
                current_part.push(ch);
            }
        }
    }

    if !parts.is_empty() {
        let combined = parts.join("");
        if combined.contains("v=DKIM1") || combined.contains("p=") {
            return Ok((default_name, combined));
        }
    }

    // Fallback: look for v=DKIM1 directly in text
    if let Some(idx) = raw.find("v=DKIM1") {
        let slice = &raw[idx..];
        let cleaned: String = slice
            .lines()
            .take_while(|l| !l.trim().starts_with(';'))
            .collect::<Vec<_>>()
            .join(" ")
            .replace('"', "")
            .replace('(', "")
            .replace(')', "");
        let trimmed_content = cleaned.trim().to_string();
        if !trimmed_content.is_empty() {
            return Ok((default_name, trimmed_content));
        }
    }

    Err(format!("Could not extract a valid DKIM TXT record from output: {}", raw))
}
