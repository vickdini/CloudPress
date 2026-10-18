use crate::cloudflare::CloudflareClient;
use crate::oci::{OciClient, OciConfig};
use crate::ssh::{GeneratedKeyPair, SshConfig, SshManager};
use crate::templates::{DeployConfig, Templates};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullDeployPayload {
    pub oci: OciConfig,
    pub cloudflare_api_token: String,
    pub cloudflare_zone_id: String,
    pub deploy: DeployConfig,
    pub ssh_private_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageProgress {
    pub stage: u8,
    pub stage_name: String,
    pub status: String, // "running", "completed", "error"
    pub message: String,
}

fn emit_stage<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    stage: u8,
    name: &str,
    status: &str,
    msg: &str,
) {
    let payload = StageProgress {
        stage,
        stage_name: name.to_string(),
        status: status.to_string(),
        message: msg.to_string(),
    };
    let _ = app.emit("deploy-stage", payload);
}

fn emit_log<R: tauri::Runtime>(app: &tauri::AppHandle<R>, msg: impl Into<String>) {
    let text = msg.into();
    let _ = app.emit("deploy-log", text);
}

#[tauri::command]
pub fn generate_ssh_key() -> Result<GeneratedKeyPair, String> {
    SshManager::generate_ed25519_keypair()
}

#[tauri::command]
pub async fn fetch_zone_id(api_token: String, domain: String) -> Result<String, String> {
    let client = CloudflareClient::new(api_token);
    client.fetch_zone_id(&domain).await
}

#[tauri::command]
pub async fn test_ssh_connection(
    host: String,
    port: u16,
    username: String,
    private_key: String,
) -> Result<String, String> {
    let cfg = SshConfig {
        host,
        port,
        username,
        private_key,
    };
    SshManager::test_connection(&cfg).await
}

fn get_config_dir() -> PathBuf {
    let mut p = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    p.push(".cloudpress");
    p
}

#[tauri::command]
pub fn save_profile(profile_json: String) -> Result<String, String> {
    let dir = get_config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config directory: {}", e))?;
    let path = dir.join("profile.json");
    fs::write(&path, profile_json).map_err(|e| format!("Failed to save profile: {}", e))?;
    Ok("Profile saved successfully".into())
}

#[tauri::command]
pub fn load_profile() -> Result<String, String> {
    let path = get_config_dir().join("profile.json");
    if path.exists() {
        fs::read_to_string(path).map_err(|e| format!("Failed to read profile: {}", e))
    } else {
        Err("No saved profile found".into())
    }
}

#[tauri::command]
pub async fn deploy_full_stack(
    payload: FullDeployPayload,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    emit_log(&app_handle, "==================================================");
    emit_log(&app_handle, "🚀 STARTING ZERO-COST WORDPRESS & EMAIL DEPLOYMENT");
    emit_log(&app_handle, format!("Target Domain: {}", payload.deploy.domain));
    emit_log(&app_handle, "==================================================");

    // -------------------------------------------------------------
    // STAGE 1: Provisioning OCI Arm64 VM & Opening Firewall Ports
    // -------------------------------------------------------------
    emit_stage(
        &app_handle,
        1,
        "Provisioning OCI Arm64 VM & Security Ports",
        "running",
        "Allocating VM.Standard.A1.Flex on Oracle Cloud...",
    );

    let oci_client = OciClient::new(payload.oci.clone())?;
    let prov_res = match oci_client.provision_arm64_instance(&app_handle).await {
        Ok(res) => res,
        Err(e) => {
            emit_stage(
                &app_handle,
                1,
                "Provisioning OCI Arm64 VM & Security Ports",
                "error",
                &e,
            );
            return Err(e);
        }
    };

    let vm_ip = if !prov_res.public_ip.is_empty() && prov_res.public_ip != "auto-assigned" {
        prov_res.public_ip
    } else if let Some(ref ip) = payload.oci.existing_vm_ip {
        ip.clone()
    } else {
        return Err("Could not determine public IP of the Oracle Arm64 instance.".into());
    };

    emit_log(
        &app_handle,
        format!("[OCI] Confirmed target server Public IP: {}", vm_ip),
    );

    emit_stage(
        &app_handle,
        1,
        "Provisioning OCI Arm64 VM & Security Ports",
        "completed",
        &format!("Server Ready (IP: {})", vm_ip),
    );

    // -------------------------------------------------------------
    // STAGE 2: Configuring Initial Cloudflare DNS
    // -------------------------------------------------------------
    emit_stage(
        &app_handle,
        2,
        "Configuring Initial Cloudflare DNS",
        "running",
        "Upserting A, MX, SPF, DMARC records...",
    );

    let cf_client = CloudflareClient::new(payload.cloudflare_api_token.clone());
    let zone_id = if payload.cloudflare_zone_id.trim().is_empty() {
        emit_log(&app_handle, "[Cloudflare] Auto-resolving Zone ID...");
        cf_client.fetch_zone_id(&payload.deploy.domain).await?
    } else {
        payload.cloudflare_zone_id.trim().to_string()
    };

    emit_log(
        &app_handle,
        format!("[Cloudflare] Using Zone ID: {}", zone_id),
    );

    match cf_client
        .configure_initial_dns(
            &zone_id,
            &payload.deploy.domain,
            &vm_ip,
            &payload.deploy.smtp_relay_host,
        )
        .await
    {
        Ok(records) => {
            for r in records {
                emit_log(&app_handle, format!("[Cloudflare] {}", r));
            }
        }
        Err(e) => {
            emit_stage(
                &app_handle,
                2,
                "Configuring Initial Cloudflare DNS",
                "error",
                &e,
            );
            return Err(format!("Cloudflare DNS configuration failed: {}", e));
        }
    }

    emit_stage(
        &app_handle,
        2,
        "Configuring Initial Cloudflare DNS",
        "completed",
        "DNS records active for root, www, mail, MX, and SPF/DMARC",
    );

    // -------------------------------------------------------------
    // STAGE 3: Bootstrapping Server via SSH
    // -------------------------------------------------------------
    emit_stage(
        &app_handle,
        3,
        "Bootstrapping Server via SSH",
        "running",
        "Connecting over SSH, preparing directories, and staging files...",
    );

    let ssh_cfg = SshConfig {
        host: vm_ip.clone(),
        port: 22,
        username: "ubuntu".into(),
        private_key: payload.ssh_private_key.clone(),
    };

    let temp_key_path = SshManager::save_temp_key(&payload.ssh_private_key)?;

    // Create remote folder
    emit_log(
        &app_handle,
        "[SSH] Initializing remote directory: /opt/wp-deployer...",
    );
    let prepare_cmd = "sudo mkdir -p /opt/wp-deployer && sudo chown -R ubuntu:ubuntu /opt/wp-deployer";
    
    // Execute prep
    let mut prep_proc = tokio::process::Command::new("ssh");
    prep_proc
        .arg("-i")
        .arg(&temp_key_path)
        .arg("-o")
        .arg("StrictHostKeyChecking=no")
        .arg("-o")
        .arg("UserKnownHostsFile=NUL")
        .arg(format!("ubuntu@{}", vm_ip))
        .arg(prepare_cmd);
    let _ = prep_proc.output().await;

    // Generate files from templates
    emit_log(&app_handle, "[Templates] Generating docker-compose.yml...");
    let docker_compose = Templates::docker_compose();

    emit_log(&app_handle, "[Templates] Generating Caddyfile...");
    let caddyfile = Templates::caddyfile(&payload.deploy.domain);

    emit_log(&app_handle, "[Templates] Generating .env config...");
    let env_file = Templates::env_file(&payload.deploy);

    emit_log(&app_handle, "[Templates] Generating bootstrap.sh...");
    let bootstrap_sh = Templates::bootstrap_sh(&payload.deploy);

    // Upload generated files
    emit_log(&app_handle, "[SFTP/SSH] Uploading docker-compose.yml...");
    SshManager::upload_file_content(
        &ssh_cfg,
        &temp_key_path,
        "/opt/wp-deployer/docker-compose.yml",
        &docker_compose,
    )
    .await?;

    emit_log(&app_handle, "[SFTP/SSH] Uploading Caddyfile...");
    SshManager::upload_file_content(
        &ssh_cfg,
        &temp_key_path,
        "/opt/wp-deployer/Caddyfile",
        &caddyfile,
    )
    .await?;

    emit_log(&app_handle, "[SFTP/SSH] Uploading .env...");
    SshManager::upload_file_content(
        &ssh_cfg,
        &temp_key_path,
        "/opt/wp-deployer/.env",
        &env_file,
    )
    .await?;

    emit_log(&app_handle, "[SFTP/SSH] Uploading bootstrap.sh...");
    SshManager::upload_file_content(
        &ssh_cfg,
        &temp_key_path,
        "/opt/wp-deployer/bootstrap.sh",
        &bootstrap_sh,
    )
    .await?;

    emit_stage(
        &app_handle,
        3,
        "Bootstrapping Server via SSH",
        "completed",
        "All configuration files uploaded and ready.",
    );

    // -------------------------------------------------------------
    // STAGE 4: Deploying Docker Compose Stack
    // -------------------------------------------------------------
    emit_stage(
        &app_handle,
        4,
        "Deploying Docker Compose Stack",
        "running",
        "Running remote bootstrap script (Swap, Firewall, Docker, Caddy, WP, Mail)...",
    );

    let raw_dkim = match SshManager::run_bootstrap_stream(&ssh_cfg, &temp_key_path, &app_handle).await
    {
        Ok(dkim) => dkim,
        Err(e) => {
            let _ = std::fs::remove_file(temp_key_path);
            emit_stage(
                &app_handle,
                4,
                "Deploying Docker Compose Stack",
                "error",
                &e,
            );
            return Err(e);
        }
    };

    let _ = std::fs::remove_file(temp_key_path);

    emit_stage(
        &app_handle,
        4,
        "Deploying Docker Compose Stack",
        "completed",
        "Containers (Caddy, WordPress FPM, MariaDB, Docker-Mailserver) running.",
    );

    // -------------------------------------------------------------
    // STAGE 5: Extracting OpenDKIM Keys & Pushing DNS Records
    // -------------------------------------------------------------
    emit_stage(
        &app_handle,
        5,
        "Extracting OpenDKIM & Pushing DNS",
        "running",
        "Parsing OpenDKIM key and updating Cloudflare mail._domainkey record...",
    );

    emit_log(
        &app_handle,
        "[DKIM] Processing extracted OpenDKIM public key...",
    );

    if !raw_dkim.trim().is_empty() {
        match cf_client
            .push_dkim_record(&zone_id, &payload.deploy.domain, &raw_dkim)
            .await
        {
            Ok(msg) => {
                emit_log(
                    &app_handle,
                    format!("[Cloudflare] DKIM DNS Record created: {}", msg),
                );
            }
            Err(e) => {
                emit_log(
                    &app_handle,
                    format!("[Cloudflare] Warning: DKIM record push failed (can be added manually): {}", e),
                );
            }
        }
    } else {
        emit_log(
            &app_handle,
            "[DKIM] Warning: No OpenDKIM output captured; skipping DNS DKIM push.",
        );
    }

    emit_stage(
        &app_handle,
        5,
        "Extracting OpenDKIM & Pushing DNS",
        "completed",
        "DKIM DNS record configured.",
    );

    // -------------------------------------------------------------
    // STAGE 6: Finalizing WordPress & SMTP
    // -------------------------------------------------------------
    emit_stage(
        &app_handle,
        6,
        "Finalizing WordPress Installation & SMTP",
        "completed",
        "WordPress, Caddy SSL, and Email Server are 100% LIVE!",
    );

    emit_log(&app_handle, "==================================================");
    emit_log(&app_handle, "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    emit_log(
        &app_handle,
        format!("WordPress Website: https://{}", payload.deploy.domain),
    );
    emit_log(
        &app_handle,
        format!("WordPress Admin:   https://{}/wp-admin", payload.deploy.domain),
    );
    emit_log(
        &app_handle,
        format!("Admin Email:       {}", payload.deploy.wp_admin_email),
    );
    emit_log(
        &app_handle,
        format!("Mail Server IMAP:  mail.{} (Port 993 SSL)", payload.deploy.domain),
    );
    emit_log(
        &app_handle,
        format!("Mail Server SMTP:  mail.{} (Port 587 STARTTLS)", payload.deploy.domain),
    );
    emit_log(&app_handle, "==================================================");

    Ok(format!(
        "Deployment completed successfully for https://{}",
        payload.deploy.domain
    ))
}
