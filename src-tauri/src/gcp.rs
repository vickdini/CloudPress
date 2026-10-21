use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tauri::Emitter;

pub const DEFAULT_GCP_CLIENT_ID: &str = "32555940559.apps.googleusercontent.com";
pub const DEFAULT_GCP_CLIENT_SECRET: &str = "ZmssLNjJy2998hD4CTg2ejr2";
// NOTE: Google OAuth requires client_secret during token exchange even when using PKCE.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcpConfig {
    pub project_id: String,
    pub region: String,       // "us-central1", "us-west1", "us-east1"
    pub zone: String,         // e.g. "us-central1-a", "us-west1-b", "us-east1-b"
    pub machine_type: String, // "e2-micro"
    pub disk_size_gb: u32,    // 30
    pub service_account_json_path: String,
    #[serde(default)]
    pub service_account_json_content: Option<String>,
    pub ssh_public_key: String,
    pub existing_vm_ip: Option<String>,

    #[serde(default)]
    pub auth_mode: Option<String>, // "oauth" | "service_account" | "existing"
    #[serde(default)]
    pub oauth_access_token: Option<String>,
    #[serde(default)]
    pub oauth_refresh_token: Option<String>,
    #[serde(default)]
    pub oauth_user_email: Option<String>,
    #[serde(default)]
    pub oauth_user_name: Option<String>,
    #[serde(default)]
    pub oauth_user_picture: Option<String>,
    #[serde(default)]
    pub custom_oauth_client_id: Option<String>,
    #[serde(default)]
    pub custom_oauth_client_secret: Option<String>,
}

impl Default for GcpConfig {
    fn default() -> Self {
        Self {
            project_id: "".into(),
            region: "us-central1".into(),
            zone: "us-central1-a".into(),
            machine_type: "e2-micro".into(),
            disk_size_gb: 30,
            service_account_json_path: "".into(),
            service_account_json_content: None,
            ssh_public_key: "".into(),
            existing_vm_ip: None,
            auth_mode: Some("oauth".into()),
            oauth_access_token: None,
            oauth_refresh_token: None,
            oauth_user_email: None,
            oauth_user_name: None,
            oauth_user_picture: None,
            custom_oauth_client_id: None,
            custom_oauth_client_secret: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAuthResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
    pub user_email: String,
    pub user_name: Option<String>,
    pub user_picture: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleProject {
    pub project_id: String,
    pub name: String,
    pub project_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcpProvisioningResult {
    pub instance_name: String,
    pub public_ip: String,
    pub zone: String,
}

#[derive(Clone)]
pub struct GcpProvisioner {
    config: GcpConfig,
}

impl GcpProvisioner {
    pub fn new(mut config: GcpConfig) -> Self {
        // Enforce Google Cloud Always Free characteristics
        config.machine_type = "e2-micro".into();
        config.disk_size_gb = 30;

        // Ensure region is one of the 3 Always Free US regions
        let reg = config.region.trim().to_lowercase();
        if reg != "us-west1" && reg != "us-central1" && reg != "us-east1" {
            config.region = "us-central1".into();
        }

        if config.zone.trim().is_empty() {
            config.zone = format!("{}-a", config.region);
        }

        Self { config }
    }

    pub async fn provision_vm<R: tauri::Runtime>(
        &self,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<GcpProvisioningResult, String> {
        // 1. If user supplied an existing VM External IP, use it directly
        if let Some(ref ip) = self.config.existing_vm_ip {
            let clean_ip = ip.trim();
            if !clean_ip.is_empty() {
                let _ = app_handle.emit(
                    "deploy-log",
                    format!(
                        "[GCP] Using existing Google Cloud e2-micro instance External IP: {}",
                        clean_ip
                    ),
                );
                return Ok(GcpProvisioningResult {
                    instance_name: "gcp-e2-micro".into(),
                    public_ip: clean_ip.to_string(),
                    zone: self.config.zone.clone(),
                });
            }
        }

        // Clean up any previously created CloudPress VM instances across all zones to protect the Always Free tier
        let _ = self.cleanup_existing_cloudpress_vms(app_handle).await;

        let _ = app_handle.emit(
            "deploy-log",
            format!(
                "[GCP] Initializing Google Cloud e2-micro VM in zone {} (Machine: {}, Disk: {}GB Standard)...",
                self.config.zone, self.config.machine_type, self.config.disk_size_gb
            ),
        );

        // 2. Try automated provisioning via OAuth 2.0 (Google Sign-In)
        if self.config.auth_mode.as_deref() == Some("oauth")
            || self.config.oauth_access_token.is_some()
        {
            let oauth_res = self.try_provision_via_oauth(app_handle).await;
            if let Ok(res) = oauth_res {
                let _ = app_handle.emit(
                    "deploy-log",
                    format!("[GCP] Instance successfully provisioned via Google Account OAuth! External IP: {}", res.public_ip),
                );
                return Ok(res);
            } else if let Err(e) = oauth_res {
                let _ = app_handle.emit(
                    "deploy-log",
                    format!("[GCP Error] Google OAuth provisioning failed: {}", e),
                );
                return Err(e);
            }
        }

        // 3. Try automated provisioning via Service Account JSON REST API
        if !self.config.service_account_json_path.trim().is_empty()
            || self
                .config
                .service_account_json_content
                .as_deref()
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false)
        {
            let rest_res = self.try_provision_via_service_account(app_handle).await;
            if let Ok(res) = rest_res {
                let _ = app_handle.emit(
                    "deploy-log",
                    format!("[GCP] Instance successfully launched via Google Cloud Compute API! External IP: {}", res.public_ip),
                );
                return Ok(res);
            } else if let Err(e) = rest_res {
                let _ = app_handle.emit(
                    "deploy-log",
                    format!(
                        "[GCP API Notice] Service Account provisioning attempt: {}",
                        e
                    ),
                );
                return Err(e);
            }
        }

        // 4. Try automated provisioning via gcloud CLI if available
        let gcloud_res = self.try_provision_via_gcloud(app_handle).await;
        if let Ok(res) = gcloud_res {
            let _ = app_handle.emit(
                "deploy-log",
                format!(
                    "[GCP] Instance successfully provisioned via gcloud! External IP: {}",
                    res.public_ip
                ),
            );
            return Ok(res);
        }

        // 5. If automated creation couldn't complete, guide user
        let err_msg = "Google Cloud automated launch requires signing in with Google (OAuth) or providing a Service Account JSON key. Please connect in Step 2.";
        let _ = app_handle.emit("deploy-log", format!("[GCP ERROR] {}", err_msg));
        Err(err_msg.into())
    }

    async fn try_provision_via_oauth<R: tauri::Runtime>(
        &self,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<GcpProvisioningResult, String> {
        let mut access_token = self
            .config
            .oauth_access_token
            .clone()
            .unwrap_or_default()
            .trim()
            .to_string();

        let is_default_client = self
            .config
            .custom_oauth_client_id
            .as_deref()
            .map(|s| s.trim().is_empty())
            .unwrap_or(true);
        let client_id = if is_default_client {
            DEFAULT_GCP_CLIENT_ID
        } else {
            self.config.custom_oauth_client_id.as_deref().unwrap().trim()
        };
        let client_secret = if is_default_client {
            self.config
                .custom_oauth_client_secret
                .as_deref()
                .filter(|s| !s.trim().is_empty())
                .or(Some(DEFAULT_GCP_CLIENT_SECRET))
        } else {
            self.config
                .custom_oauth_client_secret
                .as_deref()
                .filter(|s| !s.trim().is_empty())
        };

        // If we have a refresh token, verify/refresh access token
        if let Some(ref refresh_tok) = self.config.oauth_refresh_token {
            if !refresh_tok.trim().is_empty() {
                if let Ok(refreshed) =
                    refresh_oauth_token(refresh_tok, client_id, client_secret).await
                {
                    access_token = refreshed;
                }
            }
        }

        if access_token.is_empty() {
            return Err(
                "Google OAuth access token is missing. Please sign in with Google in Step 2."
                    .into(),
            );
        }

        let project_id = self.config.project_id.trim();
        if project_id.is_empty() {
            return Err(
                "Google Cloud Project ID is not specified. Please select or enter your Project ID."
                    .into(),
            );
        }

        let user_display = self
            .config
            .oauth_user_email
            .as_deref()
            .unwrap_or("authenticated Google user");

        let _ = app_handle.emit(
            "deploy-log",
            format!(
                "[GCP] Authenticated as {}. Verifying firewall security rules for project {}...",
                user_display, project_id
            ),
        );

        let client = reqwest::Client::new();

        // 1. Ensure firewall rules (ports 80, 443, 22, 25, 587, 993)
        ensure_firewall_rules(&client, &access_token, project_id, app_handle).await?;

        // 2. Create the e2-micro instance and wait for External IP
        create_instance_and_poll_ip(
            &client,
            &access_token,
            project_id,
            &self.config.zone,
            &self.config.ssh_public_key,
            app_handle,
        )
        .await
    }

    async fn try_provision_via_service_account<R: tauri::Runtime>(
        &self,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<GcpProvisioningResult, String> {
        let content = if let Some(ref raw_json) = self.config.service_account_json_content {
            if !raw_json.trim().is_empty() {
                raw_json.trim().to_string()
            } else {
                let key_path = self.config.service_account_json_path.trim();
                if key_path.is_empty() {
                    return Err("Service account key path or content is empty".into());
                }
                std::fs::read_to_string(key_path)
                    .map_err(|e| format!("Failed to read service account JSON: {}", e))?
            }
        } else {
            let key_path = self.config.service_account_json_path.trim();
            if key_path.is_empty() {
                return Err("Service account key path is empty".into());
            }
            std::fs::read_to_string(key_path)
                .map_err(|e| format!("Failed to read service account JSON: {}", e))?
        };

        let json_key: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Invalid service account JSON format: {}", e))?;

        let client_email = json_key["client_email"]
            .as_str()
            .ok_or("Missing client_email in JSON")?;
        let private_key_pem = json_key["private_key"]
            .as_str()
            .ok_or("Missing private_key in JSON")?;
        let project_id = json_key["project_id"]
            .as_str()
            .unwrap_or(&self.config.project_id);

        let _ = app_handle.emit(
            "deploy-log",
            format!(
                "[GCP] Authenticating with Service Account ({}) for project {}...",
                client_email, project_id
            ),
        );

        // Build JWT claim for Google OAuth2 token
        let now = chrono::Utc::now().timestamp();
        let exp = now + 3600;

        let claims = serde_json::json!({
            "iss": client_email,
            "scope": "https://www.googleapis.com/auth/compute https://www.googleapis.com/auth/cloud-platform",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": exp
        });

        // Sign JWT with RSA SHA256 using private_key_pem
        use rsa::pkcs1v15::SigningKey;
        use rsa::pkcs8::DecodePrivateKey;
        use rsa::signature::{RandomizedSigner, SignatureEncoding};

        let priv_key = rsa::RsaPrivateKey::from_pkcs8_pem(private_key_pem)
            .or_else(|_| {
                use rsa::pkcs1::DecodeRsaPrivateKey;
                rsa::RsaPrivateKey::from_pkcs1_pem(private_key_pem)
            })
            .map_err(|e| format!("Failed to parse Service Account RSA key: {}", e))?;

        let header = serde_json::json!({
            "alg": "RS256",
            "typ": "JWT"
        });

        let b64_url = &URL_SAFE_NO_PAD;
        let header_b64 = b64_url.encode(serde_json::to_vec(&header).unwrap());
        let claims_b64 = b64_url.encode(serde_json::to_vec(&claims).unwrap());
        let signing_input = format!("{}.{}", header_b64, claims_b64);

        let assertion = {
            let signer = SigningKey::<Sha256>::new(priv_key);
            let mut rng = rand::thread_rng();
            let sig = signer.sign_with_rng(&mut rng, signing_input.as_bytes());
            let sig_b64 = b64_url.encode(sig.to_vec());
            format!("{}.{}", signing_input, sig_b64)
        };

        // Exchange JWT for bearer token
        let client = reqwest::Client::new();
        let token_resp = client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
                ("assertion", &assertion),
            ])
            .send()
            .await
            .map_err(|e| format!("OAuth2 token request failed: {}", e))?;

        if !token_resp.status().is_success() {
            let err_body = token_resp.text().await.unwrap_or_default();
            return Err(format!("Google OAuth2 token error: {}", err_body));
        }

        let token_data: serde_json::Value = token_resp.json().await.map_err(|e| e.to_string())?;
        let access_token = token_data["access_token"]
            .as_str()
            .ok_or("No access_token returned")?;

        let _ = app_handle.emit(
            "deploy-log",
            "[GCP] Successfully obtained Google Cloud Compute API bearer token.",
        );

        // Ensure firewall rules
        ensure_firewall_rules(&client, access_token, project_id, app_handle).await?;

        // Create instance and poll
        create_instance_and_poll_ip(
            &client,
            access_token,
            project_id,
            &self.config.zone,
            &self.config.ssh_public_key,
            app_handle,
        )
        .await
    }

    async fn try_provision_via_gcloud<R: tauri::Runtime>(
        &self,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<GcpProvisioningResult, String> {
        let check = crate::process_utils::tokio_command("gcloud")
            .arg("--version")
            .output()
            .await;

        if check.is_err() {
            return Err("gcloud CLI not installed or not in PATH".into());
        }

        let _ = app_handle.emit(
            "deploy-log",
            "[GCP] Detected local gcloud CLI. Checking project and zone...",
        );

        let instance_name = format!("cloudpress-vm-{}", chrono::Utc::now().timestamp());
        let mut cmd = crate::process_utils::tokio_command("gcloud");
        cmd.args([
            "compute",
            "instances",
            "create",
            &instance_name,
            &format!("--zone={}", self.config.zone),
            "--machine-type=e2-micro",
            "--boot-disk-size=30GB",
            "--boot-disk-type=pd-standard",
            "--image-family=ubuntu-2404-lts-amd64",
            "--image-project=ubuntu-os-cloud",
            "--tags=http-server,https-server,cloudpress-server",
            "--format=json",
        ]);

        if !self.config.project_id.trim().is_empty() {
            cmd.arg(format!("--project={}", self.config.project_id.trim()));
        }

        if !self.config.ssh_public_key.trim().is_empty() {
            cmd.arg(format!(
                "--metadata=ssh-keys=ubuntu:{}",
                self.config.ssh_public_key.trim()
            ));
        }

        let _ = app_handle.emit(
            "deploy-log",
            format!(
                "[GCP] Executing gcloud compute instances create {} in {}...",
                instance_name, self.config.zone
            ),
        );

        let output = cmd
            .output()
            .await
            .map_err(|e| format!("gcloud execution failed: {}", e))?;

        if !output.status.success() {
            let err_str = String::from_utf8_lossy(&output.stderr);
            return Err(format!("gcloud error: {}", err_str));
        }

        let out_str = String::from_utf8_lossy(&output.stdout);
        let parsed: serde_json::Value = serde_json::from_str(&out_str)
            .map_err(|e| format!("Failed to parse gcloud output JSON: {}", e))?;

        let nat_ip = parsed
            .get(0)
            .and_then(|item| item.get("networkInterfaces"))
            .and_then(|ifaces| ifaces.get(0))
            .and_then(|iface| iface.get("accessConfigs"))
            .and_then(|configs| configs.get(0))
            .and_then(|cfg| cfg.get("natIP"))
            .and_then(|ip| ip.as_str())
            .unwrap_or("");

        if nat_ip.is_empty() {
            return Err("Instance created via gcloud but could not resolve external natIP".into());
        }

        Ok(GcpProvisioningResult {
            instance_name,
            public_ip: nat_ip.to_string(),
            zone: self.config.zone.clone(),
        })
    }

    pub async fn get_active_bearer_token(&self) -> Result<String, String> {
        if self.config.auth_mode.as_deref() == Some("oauth")
            || self.config.oauth_access_token.is_some()
        {
            let mut access_token = self
                .config
                .oauth_access_token
                .clone()
                .unwrap_or_default()
                .trim()
                .to_string();
            let is_default_client = self
                .config
                .custom_oauth_client_id
                .as_deref()
                .map(|s| s.trim().is_empty())
                .unwrap_or(true);
            let client_id = if is_default_client {
                DEFAULT_GCP_CLIENT_ID
            } else {
                self.config.custom_oauth_client_id.as_deref().unwrap().trim()
            };
            let client_secret = if is_default_client {
                self.config
                    .custom_oauth_client_secret
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
                    .or(Some(DEFAULT_GCP_CLIENT_SECRET))
            } else {
                self.config
                    .custom_oauth_client_secret
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
            };

            // If we have a refresh token, verify/refresh access token
            if let Some(ref refresh_tok) = self.config.oauth_refresh_token {
                if !refresh_tok.trim().is_empty() {
                    if let Ok(refreshed) =
                        refresh_oauth_token(refresh_tok, client_id, client_secret).await
                    {
                        access_token = refreshed;
                    }
                }
            }

            if !access_token.is_empty() {
                return Ok(access_token);
            }
        }

        // Try service account
        if !self.config.service_account_json_path.trim().is_empty()
            || self
                .config
                .service_account_json_content
                .as_deref()
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false)
        {
            let content = if let Some(ref raw_json) = self.config.service_account_json_content {
                if !raw_json.trim().is_empty() {
                    raw_json.trim().to_string()
                } else {
                    let key_path = self.config.service_account_json_path.trim();
                    if key_path.is_empty() {
                        return Err("Service account key path is empty".into());
                    }
                    std::fs::read_to_string(key_path)
                        .map_err(|e| format!("Failed to read service account JSON: {}", e))?
                }
            } else {
                let key_path = self.config.service_account_json_path.trim();
                if key_path.is_empty() {
                    return Err("Service account key path is empty".into());
                }
                std::fs::read_to_string(key_path)
                    .map_err(|e| format!("Failed to read service account JSON: {}", e))?
            };

            let json_key: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("Invalid service account JSON format: {}", e))?;

            let client_email = json_key["client_email"]
                .as_str()
                .ok_or("Missing client_email in JSON")?;
            let private_key_pem = json_key["private_key"]
                .as_str()
                .ok_or("Missing private_key in JSON")?;

            let now = chrono::Utc::now().timestamp();
            let exp = now + 3600;

            let claims = serde_json::json!({
                "iss": client_email,
                "scope": "https://www.googleapis.com/auth/compute https://www.googleapis.com/auth/cloud-platform",
                "aud": "https://oauth2.googleapis.com/token",
                "iat": now,
                "exp": exp
            });

            use rsa::pkcs1v15::SigningKey;
            use rsa::pkcs8::DecodePrivateKey;
            use rsa::signature::{RandomizedSigner, SignatureEncoding};
            use sha2::Sha256;

            let priv_key = rsa::RsaPrivateKey::from_pkcs8_pem(private_key_pem)
                .or_else(|_| {
                    use rsa::pkcs1::DecodeRsaPrivateKey;
                    rsa::RsaPrivateKey::from_pkcs1_pem(private_key_pem)
                })
                .map_err(|e| format!("Failed to parse Service Account RSA key: {}", e))?;

            let header = serde_json::json!({
                "alg": "RS256",
                "typ": "JWT"
            });

            let b64_url = &URL_SAFE_NO_PAD;
            let header_b64 = b64_url.encode(serde_json::to_vec(&header).unwrap());
            let claims_b64 = b64_url.encode(serde_json::to_vec(&claims).unwrap());
            let signing_input = format!("{}.{}", header_b64, claims_b64);

            let assertion = {
                let signer = SigningKey::<Sha256>::new(priv_key);
                let mut rng = rand::thread_rng();
                let sig = signer.sign_with_rng(&mut rng, signing_input.as_bytes());
                let sig_b64 = b64_url.encode(sig.to_vec());
                format!("{}.{}", signing_input, sig_b64)
            };

            let client = reqwest::Client::new();
            let token_resp = client
                .post("https://oauth2.googleapis.com/token")
                .form(&[
                    ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
                    ("assertion", &assertion),
                ])
                .send()
                .await
                .map_err(|e| format!("OAuth2 token request failed: {}", e))?;

            if token_resp.status().is_success() {
                let token_data: serde_json::Value =
                    token_resp.json().await.map_err(|e| e.to_string())?;
                if let Some(tok) = token_data["access_token"].as_str() {
                    return Ok(tok.to_string());
                }
            }
        }

        Err("No valid Google Cloud authentication found (OAuth or Service Account)".into())
    }

    pub async fn delete_instance<R: tauri::Runtime>(
        &self,
        instance_name: &str,
        zone: &str,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<(), String> {
        let _ = app_handle.emit(
            "deploy-log",
            format!(
                "[GCP] Initiating deletion of instance '{}' in zone {}...",
                instance_name, zone
            ),
        );

        let token_res = self.get_active_bearer_token().await;
        if let Ok(token) = token_res {
            let project_id = self.config.project_id.trim();
            if project_id.is_empty() {
                return Err("Project ID is missing for VM deletion".into());
            }

            let client = reqwest::Client::new();
            let delete_url = format!(
                "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}",
                project_id, zone, instance_name
            );

            let resp = client
                .delete(&delete_url)
                .bearer_auth(&token)
                .send()
                .await
                .map_err(|e| format!("Failed to send delete request: {}", e))?;

            let status = resp.status();
            if status.is_success() || status.as_u16() == 404 {
                let _ = app_handle.emit(
                    "deploy-log",
                    format!(
                        "[GCP] Deletion operation submitted for '{}'. Waiting for cleanup...",
                        instance_name
                    ),
                );

                // Poll for up to 30 seconds to confirm instance is deleted
                for _ in 0..15 {
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    let check = client.get(&delete_url).bearer_auth(&token).send().await;
                    if let Ok(res) = check {
                        if res.status().as_u16() == 404 {
                            let _ = app_handle.emit(
                                "deploy-log",
                                format!(
                                    "[GCP] Instance '{}' completely removed from Google Cloud.",
                                    instance_name
                                ),
                            );
                            return Ok(());
                        }
                    }
                }
                return Ok(());
            }

            let err_body = resp.text().await.unwrap_or_default();
            return Err(format!("GCP delete instance failed: {}", err_body));
        }

        // Fallback: try gcloud
        let mut cmd = crate::process_utils::tokio_command("gcloud");
        cmd.args([
            "compute",
            "instances",
            "delete",
            instance_name,
            &format!("--zone={}", zone),
            "--quiet",
        ]);
        if !self.config.project_id.trim().is_empty() {
            cmd.arg(format!("--project={}", self.config.project_id.trim()));
        }

        let output = cmd
            .output()
            .await
            .map_err(|e| format!("gcloud delete failed: {}", e))?;
        if output.status.success() {
            let _ = app_handle.emit(
                "deploy-log",
                format!(
                    "[GCP] Instance '{}' successfully deleted via gcloud.",
                    instance_name
                ),
            );
            Ok(())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("gcloud delete error: {}", err))
        }
    }

    pub async fn cleanup_existing_cloudpress_vms<R: tauri::Runtime>(
        &self,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<(), String> {
        // If user explicitly gave an existing IP, do NOT delete anything!
        if let Some(ref ip) = self.config.existing_vm_ip {
            if !ip.trim().is_empty() {
                return Ok(());
            }
        }

        let project_id = self.config.project_id.trim();
        if project_id.is_empty() {
            return Ok(());
        }

        let token_res = self.get_active_bearer_token().await;
        if let Ok(token) = token_res {
            let client = reqwest::Client::new();
            // Check aggregated instances across all zones in the project
            let agg_url = format!(
                "https://compute.googleapis.com/compute/v1/projects/{}/aggregated/instances",
                project_id
            );

            let mut deleted_count = 0;
            if let Ok(resp) = client.get(&agg_url).bearer_auth(&token).send().await {
                if let Ok(json_data) = resp.json::<serde_json::Value>().await {
                    if let Some(items_map) = json_data["items"].as_object() {
                        for (_zone_key, zone_val) in items_map {
                            if let Some(instances) = zone_val["instances"].as_array() {
                                for inst in instances {
                                    if let Some(name) = inst["name"].as_str() {
                                        if name.starts_with("cloudpress-vm-") {
                                            let inst_zone = inst["zone"]
                                                .as_str()
                                                .and_then(|z| z.split('/').last())
                                                .unwrap_or(&self.config.zone);
                                            deleted_count += 1;
                                            let _ = app_handle.emit(
                                                "deploy-log",
                                                format!(
                                                    "[GCP Pre-flight] Found previous CloudPress VM '{}' in {}. Deleting it now to prevent duplicate VMs and preserve Always Free tier...",
                                                    name, inst_zone
                                                ),
                                            );
                                            let _ = self.delete_instance(name, inst_zone, app_handle).await;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if deleted_count == 0 {
                // Also check configured zone explicitly as a fallback
                let list_url = format!(
                    "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances",
                    project_id, self.config.zone
                );
                if let Ok(resp) = client.get(&list_url).bearer_auth(&token).send().await {
                    if let Ok(json_data) = resp.json::<serde_json::Value>().await {
                        if let Some(items) = json_data["items"].as_array() {
                            for item in items {
                                if let Some(name) = item["name"].as_str() {
                                    if name.starts_with("cloudpress-vm-") {
                                        let _ = app_handle.emit(
                                            "deploy-log",
                                            format!(
                                                "[GCP Pre-flight] Found previous CloudPress VM '{}' in {}. Deleting it...",
                                                name, self.config.zone
                                            ),
                                        );
                                        let _ = self
                                            .delete_instance(name, &self.config.zone, app_handle)
                                            .await;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return Ok(());
        }

        // Fallback: check via local gcloud CLI if OAuth/Service Account wasn't used
        let mut list_cmd = crate::process_utils::tokio_command("gcloud");
        list_cmd.args([
            "compute",
            "instances",
            "list",
            "--filter=name ~ ^cloudpress-vm-",
            "--format=json",
        ]);
        if !project_id.is_empty() {
            list_cmd.arg(format!("--project={}", project_id));
        }

        if let Ok(output) = list_cmd.output().await {
            if output.status.success() {
                let out_str = String::from_utf8_lossy(&output.stdout);
                if let Ok(instances) = serde_json::from_str::<serde_json::Value>(&out_str) {
                    if let Some(items) = instances.as_array() {
                        for item in items {
                            if let Some(name) = item["name"].as_str() {
                                let item_zone = item["zone"]
                                    .as_str()
                                    .and_then(|z| z.split('/').last())
                                    .unwrap_or(&self.config.zone);
                                let _ = app_handle.emit(
                                    "deploy-log",
                                    format!(
                                        "[GCP Pre-flight] Found previous CloudPress VM '{}' in {}. Deleting via gcloud...",
                                        name, item_zone
                                    ),
                                );
                                let _ = self.delete_instance(name, item_zone, app_handle).await;
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Helpers: Firewall and Instance Creation
// ---------------------------------------------------------------------------

async fn ensure_firewall_rules<R: tauri::Runtime>(
    client: &reqwest::Client,
    access_token: &str,
    project_id: &str,
    app_handle: &tauri::AppHandle<R>,
) -> Result<(), String> {
    let url = format!(
        "https://compute.googleapis.com/compute/v1/projects/{}/global/firewalls",
        project_id
    );

    let fw_payload = serde_json::json!({
        "name": "cloudpress-allow-web-mail",
        "description": "Allow HTTP, HTTPS, SSH, and Email ports for CloudPress WordPress & Email server",
        "network": "global/networks/default",
        "direction": "INGRESS",
        "priority": 1000,
        "targetTags": ["http-server", "https-server", "cloudpress-server"],
        "allowed": [
            {
                "IPProtocol": "tcp",
                "ports": ["22", "80", "443", "25", "587", "993"]
            }
        ],
        "sourceRanges": ["0.0.0.0/0"]
    });

    let resp = client
        .post(&url)
        .bearer_auth(access_token)
        .json(&fw_payload)
        .send()
        .await;

    if let Ok(res) = resp {
        if res.status().is_success() {
            let _ = app_handle.emit(
                "deploy-log",
                "[GCP] Security firewall configured (ports 80, 443, 22, 25, 587, 993 open).",
            );
        } else if res.status().as_u16() == 409 {
            let _ = app_handle.emit(
                "deploy-log",
                "[GCP] CloudPress firewall security rule already active.",
            );
        } else {
            let err_text = res.text().await.unwrap_or_default();
            let _ = app_handle.emit(
                "deploy-log",
                format!("[GCP Notice] Firewall status: {}", err_text),
            );
        }
    }

    Ok(())
}

async fn create_instance_and_poll_ip<R: tauri::Runtime>(
    client: &reqwest::Client,
    access_token: &str,
    project_id: &str,
    zone: &str,
    ssh_public_key: &str,
    app_handle: &tauri::AppHandle<R>,
) -> Result<GcpProvisioningResult, String> {
    let now = chrono::Utc::now().timestamp();
    let instance_name = format!("cloudpress-vm-{}", now);
    let url = format!(
        "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances",
        project_id, zone
    );

    let payload = serde_json::json!({
        "name": instance_name,
        "machineType": format!("zones/{}/machineTypes/e2-micro", zone),
        "disks": [
            {
                "boot": true,
                "autoDelete": true,
                "initializeParams": {
                    "sourceImage": "projects/ubuntu-os-cloud/global/images/family/ubuntu-2404-lts-amd64",
                    "diskSizeGb": "30",
                    "diskType": format!("zones/{}/diskTypes/pd-standard", zone)
                }
            }
        ],
        "networkInterfaces": [
            {
                "network": "global/networks/default",
                "accessConfigs": [
                    {
                        "name": "External NAT",
                        "type": "ONE_TO_ONE_NAT"
                    }
                ]
            }
        ],
        "metadata": {
            "items": [
                {
                    "key": "ssh-keys",
                    "value": format!("ubuntu:{}", ssh_public_key.trim())
                }
            ]
        },
        "tags": {
            "items": ["http-server", "https-server", "cloudpress-server"]
        }
    });

    let _ = app_handle.emit(
        "deploy-log",
        format!(
            "[GCP] Creating e2-micro instance {} in {} (Ubuntu 24.04, 30GB disk)...",
            instance_name, zone
        ),
    );

    let resp = client
        .post(&url)
        .bearer_auth(access_token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Compute Engine create request failed: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GCP Compute Engine API error: {}", body));
    }

    let _ = app_handle.emit(
        "deploy-log",
        format!(
            "[GCP] Creation operation submitted for {}. Polling for assigned External IP...",
            instance_name
        ),
    );

    // Poll for instance External IP
    let instance_url = format!(
        "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}",
        project_id, zone, instance_name
    );

    for i in 1..=45 {
        tokio::time::sleep(Duration::from_secs(4)).await;
        if crate::commands::is_deployment_cancelled() {
            let _ = app_handle.emit(
                "deploy-log",
                format!("[GCP Rollback] Deployment cancelled. Deleting instance {}...", instance_name),
            );
            let _ = client.delete(&instance_url).bearer_auth(access_token).send().await;
            return Err("Deployment cancelled by user. Provisioned VM was deleted.".into());
        }

        let check_resp = client
            .get(&instance_url)
            .bearer_auth(access_token)
            .send()
            .await;
        if let Ok(res) = check_resp {
            if let Ok(data) = res.json::<serde_json::Value>().await {
                let status = data["status"].as_str().unwrap_or("");
                if status == "RUNNING" {
                    let nat_ip = data["networkInterfaces"][0]["accessConfigs"][0]["natIP"]
                        .as_str()
                        .unwrap_or("");
                    if !nat_ip.is_empty() {
                        let _ = app_handle.emit(
                            "deploy-log",
                            format!(
                                "[GCP] Instance {} is RUNNING! External IP: {}",
                                instance_name, nat_ip
                            ),
                        );
                        return Ok(GcpProvisioningResult {
                            instance_name,
                            public_ip: nat_ip.to_string(),
                            zone: zone.to_string(),
                        });
                    }
                } else if i % 4 == 0 {
                    let _ = app_handle.emit(
                        "deploy-log",
                        format!(
                            "[GCP] Instance status: {} (waiting for boot and IP assignment)...",
                            status
                        ),
                    );
                }
            }
        }
    }

    let _ = app_handle.emit(
        "deploy-log",
        format!(
            "[GCP Rollback] Timed out waiting for External IP. Automatically deleting instance {} to prevent billing...",
            instance_name
        ),
    );
    let _ = client.delete(&instance_url).bearer_auth(access_token).send().await;

    Err(format!(
        "Instance '{}' was created, but timed out waiting for External IP to be assigned. The VM was deleted to prevent billing.",
        instance_name
    ))
}

// ---------------------------------------------------------------------------
// OAuth 2.0 PKCE Browser Flow & Project Listing
// ---------------------------------------------------------------------------

fn generate_random_string(length: usize) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let mut rng = rand::thread_rng();
    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

fn percent_decode(s: &str) -> String {
    let mut result = String::new();
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if hex.len() == 2 {
                if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                    result.push(byte as char);
                    continue;
                }
            }
            result.push('%');
            result.push_str(&hex);
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }
    result
}

pub async fn start_google_oauth_flow(
    custom_client_id: Option<String>,
    custom_client_secret: Option<String>,
) -> Result<GoogleAuthResult, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    // 1. Bind ephemeral loopback listener
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind local loopback listener: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read local port: {}", e))?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{}/oauth2callback", port);

    // 2. Prepare PKCE and State
    let verifier = generate_random_string(64);
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());
    let state = generate_random_string(32);

    let is_default_client = custom_client_id
        .as_deref()
        .map(|s| s.trim().is_empty())
        .unwrap_or(true);
    let client_id = if is_default_client {
        DEFAULT_GCP_CLIENT_ID
    } else {
        custom_client_id.as_deref().unwrap().trim()
    };
    let client_secret = if is_default_client {
        custom_client_secret
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .or(Some(DEFAULT_GCP_CLIENT_SECRET))
    } else {
        custom_client_secret
            .as_deref()
            .filter(|s| !s.trim().is_empty())
    };

    let scopes = "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/compute";

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256&access_type=offline&prompt=consent",
        urlencoding::encode(client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(scopes),
        urlencoding::encode(&state),
        urlencoding::encode(&challenge)
    );

    // 3. Open user's default browser
    crate::commands::open_external_url(auth_url)?;

    // 4. Wait for incoming browser connection (3 minute timeout)
    let (mut socket, _) = tokio::time::timeout(Duration::from_secs(180), listener.accept())
        .await
        .map_err(|_| "OAuth sign-in timed out waiting for browser authorization (3 minutes).")?
        .map_err(|e| format!("Failed to accept incoming OAuth callback: {}", e))?;

    let mut buf = [0u8; 4096];
    let n = socket
        .read(&mut buf)
        .await
        .map_err(|e| format!("Failed to read callback request: {}", e))?;
    let req = String::from_utf8_lossy(&buf[..n]);

    let first_line = req.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("");
    let query = path.split('?').nth(1).unwrap_or("");

    let mut code: Option<String> = None;
    let mut recv_state: Option<String> = None;
    let mut error: Option<String> = None;

    for pair in query.split('&') {
        let mut parts = pair.split('=');
        if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
            let decoded = percent_decode(v);
            if k == "code" {
                code = Some(decoded);
            } else if k == "state" {
                recv_state = Some(decoded);
            } else if k == "error" {
                error = Some(decoded);
            }
        }
    }

    if let Some(err) = error {
        let safe_err = html_escape(&err);
        let html_err = format!(
            "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
            <html><body style='font-family:-apple-system,sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;'>\
            <div style='text-align:center;'><h2>Google Sign-In Cancelled</h2><p style='color:#f87171;'>{}</p></div></body></html>",
            safe_err
        );
        let _ = socket.write_all(html_err.as_bytes()).await;
        return Err(format!("Google sign-in cancelled or denied: {}", err));
    }

    if recv_state.as_deref() != Some(&state) {
        let _ = socket
            .write_all(b"HTTP/1.1 400 Bad Request\r\n\r\nOAuth state mismatch.")
            .await;
        return Err("OAuth state mismatch; potential CSRF or stale request.".into());
    }

    let auth_code = code.ok_or_else(|| "No authorization code returned from Google".to_string())?;

    // Send sleek success response to browser
    let html_ok = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n\
    <!DOCTYPE html>\
    <html><head><meta charset='utf-8'><title>Connected - CloudPress</title>\
    <style>\
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }\
      .card { background: #131b2e; border: 1px solid #1e293b; padding: 40px; border-radius: 20px; text-align: center; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); }\
      .icon { width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 24px auto; color: #10b981; }\
      h1 { font-size: 24px; font-weight: 700; margin: 0 0 12px 0; color: #ffffff; letter-spacing: -0.5px; }\
      p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 28px 0; }\
      .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; padding: 8px 18px; border-radius: 9999px; font-size: 13px; font-weight: 600; }\
    </style></head>\
    <body><div class='card'>\
      <div class='icon'><svg width='32' height='32' fill='none' stroke='currentColor' stroke-width='2.5' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M5 13l4 4L19 7'/></svg></div>\
      <h1>Google Cloud Connected!</h1>\
      <p>Authorization was successful. You can safely close this browser tab and return to the CloudPress desktop app to continue.</p>\
      <div class='badge'>Connected to CloudPress</div>\
    </div></body></html>";

    let _ = socket.write_all(html_ok.as_bytes()).await;
    let _ = socket.flush().await;

    // 5. Exchange code for access & refresh tokens
    let client = reqwest::Client::new();
    let mut params = std::collections::HashMap::new();
    params.insert("code", auth_code.as_str());
    params.insert("client_id", client_id);
    if let Some(sec) = client_secret {
        if !sec.trim().is_empty() {
            params.insert("client_secret", sec);
        }
    }
    params.insert("redirect_uri", redirect_uri.as_str());
    params.insert("grant_type", "authorization_code");
    params.insert("code_verifier", verifier.as_str());

    let token_resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to reach Google token exchange endpoint: {}", e))?;

    if !token_resp.status().is_success() {
        let err_body = token_resp.text().await.unwrap_or_default();
        return Err(format!("Google token exchange failed: {}", err_body));
    }

    let token_data: serde_json::Value = token_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let access_token = token_data["access_token"]
        .as_str()
        .ok_or("Missing access_token in Google response")?
        .to_string();
    let refresh_token = token_data["refresh_token"].as_str().map(|s| s.to_string());
    let expires_in = token_data["expires_in"].as_u64();

    // 6. Fetch user profile (email, name, picture)
    let user_resp = client
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(&access_token)
        .send()
        .await;

    let mut user_email = "authenticated-user@google.com".to_string();
    let mut user_name = None;
    let mut user_picture = None;

    if let Ok(u_res) = user_resp {
        if let Ok(u_json) = u_res.json::<serde_json::Value>().await {
            if let Some(email) = u_json["email"].as_str() {
                user_email = email.to_string();
            }
            if let Some(name) = u_json["name"].as_str() {
                user_name = Some(name.to_string());
            }
            if let Some(picture) = u_json["picture"].as_str() {
                user_picture = Some(picture.to_string());
            }
        }
    }

    Ok(GoogleAuthResult {
        access_token,
        refresh_token,
        expires_in,
        user_email,
        user_name,
        user_picture,
    })
}

pub async fn refresh_oauth_token(
    refresh_token: &str,
    client_id: &str,
    client_secret: Option<&str>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut params = std::collections::HashMap::new();
    params.insert("client_id", client_id);
    let effective_secret = client_secret
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            if client_id == DEFAULT_GCP_CLIENT_ID {
                Some(DEFAULT_GCP_CLIENT_SECRET)
            } else {
                None
            }
        });
    if let Some(sec) = effective_secret {
        if !sec.trim().is_empty() {
            params.insert("client_secret", sec);
        }
    }
    params.insert("refresh_token", refresh_token);
    params.insert("grant_type", "refresh_token");

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token refresh network error: {}", e))?;

    if !resp.status().is_success() {
        let err_body = resp.text().await.unwrap_or_default();
        return Err(format!("Google token refresh failed: {}", err_body));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let access_token = data["access_token"]
        .as_str()
        .ok_or("No access_token in refresh response")?;
    Ok(access_token.to_string())
}

pub async fn list_google_projects(access_token: &str) -> Result<Vec<GoogleProject>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://cloudresourcemanager.googleapis.com/v1/projects")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Failed to reach Google Resource Manager: {}", e))?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        return Err(format!("Could not list Google Cloud projects: {}", err));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    if let Some(projects) = data["projects"].as_array() {
        for p in projects {
            if let Some(pid) = p["projectId"].as_str() {
                let name = p["name"].as_str().unwrap_or(pid);
                let pnum = p["projectNumber"].as_str().map(|s| s.to_string());
                let state = p["lifecycleState"].as_str().unwrap_or("ACTIVE");
                if state == "ACTIVE" {
                    list.push(GoogleProject {
                        project_id: pid.to_string(),
                        name: name.to_string(),
                        project_number: pnum,
                    });
                }
            }
        }
    }
    Ok(list)
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut encoded = String::new();
        for b in s.as_bytes() {
            match *b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(*b as char);
                }
                _ => {
                    encoded.push_str(&format!("%{:02X}", b));
                }
            }
        }
        encoded
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

