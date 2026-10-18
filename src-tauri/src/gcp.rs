use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcpConfig {
    pub project_id: String,
    pub region: String, // "us-central1", "us-west1", "us-east1"
    pub zone: String,   // e.g. "us-central1-a", "us-west1-b", "us-east1-b"
    pub machine_type: String, // "e2-micro"
    pub disk_size_gb: u32,    // 30
    pub service_account_json_path: String,
    pub ssh_public_key: String,
    pub existing_vm_ip: Option<String>,
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
            ssh_public_key: "".into(),
            existing_vm_ip: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcpProvisioningResult {
    pub instance_name: String,
    pub public_ip: String,
    pub zone: String,
}

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
                    format!("[GCP] Using existing Google Cloud e2-micro instance External IP: {}", clean_ip),
                );
                return Ok(GcpProvisioningResult {
                    instance_name: "gcp-e2-micro".into(),
                    public_ip: clean_ip.to_string(),
                    zone: self.config.zone.clone(),
                });
            }
        }

        let _ = app_handle.emit(
            "deploy-log",
            format!(
                "[GCP] Initializing Google Cloud e2-micro VM in zone {} (Machine: {}, Disk: {}GB Standard)...",
                self.config.zone, self.config.machine_type, self.config.disk_size_gb
            ),
        );

        // 2. Try automated provisioning via gcloud CLI if available
        let gcloud_res = self.try_provision_via_gcloud(app_handle).await;
        if let Ok(res) = gcloud_res {
            let _ = app_handle.emit(
                "deploy-log",
                format!("[GCP] Instance successfully provisioned via gcloud! External IP: {}", res.public_ip),
            );
            return Ok(res);
        }

        // 3. Try automated provisioning via Service Account JSON REST API
        if !self.config.service_account_json_path.trim().is_empty() {
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
                    format!("[GCP API Notice] Service Account provisioning attempt: {}", e),
                );
            }
        }

        // 4. If automated creation couldn't complete, guide user to paste External IP
        let err_msg = "Google Cloud automated launch requires either an Existing VM IP, gcloud CLI, or a Service Account JSON key. Please enter your e2-micro instance's External IP in Step 2.";
        let _ = app_handle.emit("deploy-log", format!("[GCP ERROR] {}", err_msg));
        Err(err_msg.into())
    }

    async fn try_provision_via_gcloud<R: tauri::Runtime>(
        &self,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<GcpProvisioningResult, String> {
        let check = tokio::process::Command::new("gcloud")
            .arg("--version")
            .output()
            .await;

        if check.is_err() {
            return Err("gcloud CLI not installed or not in PATH".into());
        }

        let _ = app_handle.emit("deploy-log", "[GCP] Detected local gcloud CLI. Checking project and zone...");

        let instance_name = format!("cloudpress-vm-{}", chrono::Utc::now().timestamp());
        let mut cmd = tokio::process::Command::new("gcloud");
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
            "--tags=http-server,https-server",
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
            format!("[GCP] Executing gcloud compute instances create {} in {}...", instance_name, self.config.zone),
        );

        let output = cmd.output().await.map_err(|e| format!("gcloud execution failed: {}", e))?;

        if !output.status.success() {
            let err_str = String::from_utf8_lossy(&output.stderr);
            return Err(format!("gcloud error: {}", err_str));
        }

        let out_str = String::from_utf8_lossy(&output.stdout);
        let parsed: serde_json::Value = serde_json::from_str(&out_str)
            .map_err(|e| format!("Failed to parse gcloud output JSON: {}", e))?;

        // Extract networkInterfaces[0].accessConfigs[0].natIP
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

    async fn try_provision_via_service_account<R: tauri::Runtime>(
        &self,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<GcpProvisioningResult, String> {
        let key_path = self.config.service_account_json_path.trim();
        if key_path.is_empty() {
            return Err("Service account key path is empty".into());
        }

        let content = std::fs::read_to_string(key_path)
            .map_err(|e| format!("Failed to read service account JSON: {}", e))?;

        let json_key: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Invalid service account JSON format: {}", e))?;

        let client_email = json_key["client_email"].as_str().ok_or("Missing client_email in JSON")?;
        let private_key_pem = json_key["private_key"].as_str().ok_or("Missing private_key in JSON")?;
        let project_id = json_key["project_id"].as_str().unwrap_or(&self.config.project_id);

        let _ = app_handle.emit(
            "deploy-log",
            format!("[GCP] Authenticating with Service Account ({}) for project {}...", client_email, project_id),
        );

        // Build JWT claim for Google OAuth2 token
        let now = chrono::Utc::now().timestamp();
        let exp = now + 3600;

        let claims = serde_json::json!({
            "iss": client_email,
            "scope": "https://www.googleapis.com/auth/compute",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": exp
        });

        // Sign JWT with RSA SHA256 using private_key_pem
        use rsa::pkcs8::DecodePrivateKey;
        use rsa::pkcs1v15::SigningKey;
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

        use base64::Engine;
        let b64_url = &base64::engine::general_purpose::URL_SAFE_NO_PAD;
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
        let access_token = token_data["access_token"].as_str().ok_or("No access_token returned")?;

        let _ = app_handle.emit("deploy-log", "[GCP] Successfully obtained Google Cloud Compute API bearer token.");

        // Compute Engine API URL
        let instance_name = format!("cloudpress-vm-{}", now);
        let url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances",
            project_id, self.config.zone
        );

        let payload = serde_json::json!({
            "name": instance_name,
            "machineType": format!("zones/{}/machineTypes/e2-micro", self.config.zone),
            "disks": [
                {
                    "boot": true,
                    "autoDelete": true,
                    "initializeParams": {
                        "sourceImage": "projects/ubuntu-os-cloud/global/images/family/ubuntu-2404-lts-amd64",
                        "diskSizeGb": "30",
                        "diskType": format!("zones/{}/diskTypes/pd-standard", self.config.zone)
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
                        "value": format!("ubuntu:{}", self.config.ssh_public_key.trim())
                    }
                ]
            },
            "tags": {
                "items": ["http-server", "https-server"]
            }
        });

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
            format!("[GCP] Creation operation submitted for {}. Polling for assigned External IP...", instance_name),
        );

        // Poll for instance External IP
        let instance_url = format!(
            "https://compute.googleapis.com/compute/v1/projects/{}/zones/{}/instances/{}",
            project_id, self.config.zone, instance_name
        );

        for _ in 0..30 {
            tokio::time::sleep(Duration::from_secs(4)).await;
            if crate::commands::is_deployment_cancelled() {
                return Err("Deployment cancelled by user.".into());
            }

            let check_resp = client.get(&instance_url).bearer_auth(access_token).send().await;
            if let Ok(res) = check_resp {
                if let Ok(data) = res.json::<serde_json::Value>().await {
                    let status = data["status"].as_str().unwrap_or("");
                    if status == "RUNNING" {
                        let nat_ip = data["networkInterfaces"][0]["accessConfigs"][0]["natIP"]
                            .as_str()
                            .unwrap_or("");
                        if !nat_ip.is_empty() {
                            return Ok(GcpProvisioningResult {
                                instance_name,
                                public_ip: nat_ip.to_string(),
                                zone: self.config.zone.clone(),
                            });
                        }
                    }
                }
            }
        }

        Err("Instance was created, but timed out waiting for External IP to be assigned".into())
    }
}
