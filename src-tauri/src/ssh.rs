use serde::{Deserialize, Serialize};
use ssh_key::rand_core::OsRng;
use ssh_key::{Algorithm, LineEnding, PrivateKey};
use std::io::Write;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedKeyPair {
    pub public_key: String,
    pub private_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub private_key: String,
}

impl Default for SshConfig {
    fn default() -> Self {
        Self {
            host: "".into(),
            port: 22,
            username: "ubuntu".into(),
            private_key: "".into(),
        }
    }
}

pub struct SshManager;

impl SshManager {
    /// Generates a brand new Ed25519 SSH Keypair locally
    pub fn generate_ed25519_keypair() -> Result<GeneratedKeyPair, String> {
        let private_key = PrivateKey::random(&mut OsRng, Algorithm::Ed25519)
            .map_err(|e| format!("Failed to generate Ed25519 key: {}", e))?;

        let public_key = private_key.public_key();
        let openssh_pub = public_key
            .to_openssh()
            .map_err(|e| format!("Failed to encode public key: {}", e))?;

        let openssh_priv = private_key
            .to_openssh(LineEnding::LF)
            .map_err(|e| format!("Failed to encode private key: {}", e))?;

        Ok(GeneratedKeyPair {
            public_key: format!("{} ubuntu", openssh_pub),
            private_key: openssh_priv.to_string(),
        })
    }

    /// Saves the private key to a secure temporary file and returns the path
    pub fn save_temp_key(key_content: &str) -> Result<PathBuf, String> {
        let temp_dir = std::env::temp_dir();
        let key_path = temp_dir.join(format!("cloudpress_key_{}", uuid_simple()));

        let mut file = std::fs::File::create(&key_path)
            .map_err(|e| format!("Failed to create temporary SSH key file: {}", e))?;

        // Normalize line endings to LF
        let normalized = key_content.replace("\r\n", "\n");
        file.write_all(normalized.as_bytes())
            .map_err(|e| format!("Failed to write private key: {}", e))?;

        drop(file);

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&key_path)
                .map_err(|e| e.to_string())?
                .permissions();
            perms.set_mode(0o600);
            std::fs::set_permissions(&key_path, perms).map_err(|e| e.to_string())?;
        }

        #[cfg(windows)]
        {
            let username = std::env::var("USERNAME").unwrap_or_else(|_| "Users".to_string());
            let path_str = key_path.to_string_lossy().to_string();

            // 1. Remove inheritance and wipe all other user/group permissions
            let _ = crate::process_utils::std_command("icacls")
                .arg(&path_str)
                .arg("/inheritance:r")
                .output();

            // 2. Explicitly grant only the current user Read & Write permissions
            let _ = crate::process_utils::std_command("icacls")
                .arg(&path_str)
                .arg("/grant:r")
                .arg(format!("{}:(R,W)", username))
                .output();
        }

        Ok(key_path)
    }

    /// Test basic SSH connectivity
    pub async fn test_connection(cfg: &SshConfig) -> Result<String, String> {
        let key_path = Self::save_temp_key(&cfg.private_key)?;

        let mut cmd = crate::process_utils::tokio_command("ssh");
        cmd.arg("-i")
            .arg(&key_path)
            .arg("-p")
            .arg(cfg.port.to_string())
            .arg("-o")
            .arg("StrictHostKeyChecking=no")
            .arg("-o")
            .arg("UserKnownHostsFile=NUL")
            .arg("-o")
            .arg("ConnectTimeout=10")
            .arg(format!("{}@{}", cfg.username, cfg.host))
            .arg("echo 'SSH_CONNECTION_SUCCESS'");

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let output = cmd
            .output()
            .await
            .map_err(|e| format!("SSH command execution failed: {}", e))?;

        let _ = std::fs::remove_file(key_path);

        if output.status.success() {
            Ok("SSH connection established successfully!".into())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("SSH Connection error: {}", stderr))
        }
    }

    /// Poll until SSH is accepting connections and accepts the key
    pub async fn wait_for_ssh_ready<R: tauri::Runtime>(
        cfg: &SshConfig,
        key_path: &PathBuf,
        max_wait_secs: u64,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<(), String> {
        let start = std::time::Instant::now();
        let _ = app_handle.emit(
            "deploy-log",
            format!("[SSH] Waiting for SSH service on {} to start and authenticate...", cfg.host),
        );

        while start.elapsed().as_secs() < max_wait_secs {
            let mut cmd = crate::process_utils::tokio_command("ssh");
            cmd.arg("-i")
                .arg(key_path)
                .arg("-p")
                .arg(cfg.port.to_string())
                .arg("-o")
                .arg("StrictHostKeyChecking=no")
                .arg("-o")
                .arg("UserKnownHostsFile=NUL")
                .arg("-o")
                .arg("ConnectTimeout=5")
                .arg(format!("{}@{}", cfg.username, cfg.host))
                .arg("echo 'SSH_VM_READY'");

            cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

            if let Ok(output) = cmd.output().await {
                if output.status.success() {
                    let out_str = String::from_utf8_lossy(&output.stdout);
                    if out_str.contains("SSH_VM_READY") {
                        let _ = app_handle.emit(
                            "deploy-log",
                            format!("[SSH] VM {} is ready and accepted key authentication! Proceeding...", cfg.host),
                        );
                        return Ok(());
                    }
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        }

        Err(format!(
            "Timed out waiting for SSH service on {} after {}s. The VM may still be booting.",
            cfg.host, max_wait_secs
        ))
    }

    /// Transfer a file to the remote server using base64 stream and sudo tee
    pub async fn upload_file_content(
        cfg: &SshConfig,
        key_path: &PathBuf,
        remote_path: &str,
        content: &str,
    ) -> Result<(), String> {
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(content.as_bytes());

        // Always ensure the parent directory exists before writing to the target file
        let remote_cmd = format!(
            "sudo mkdir -p $(dirname {}) && echo '{}' | base64 -d | sudo tee {} > /dev/null",
            remote_path, b64, remote_path
        );

        let mut last_err = String::new();
        for attempt in 1..=3 {
            let mut cmd = crate::process_utils::tokio_command("ssh");
            cmd.arg("-i")
                .arg(key_path)
                .arg("-p")
                .arg(cfg.port.to_string())
                .arg("-o")
                .arg("StrictHostKeyChecking=no")
                .arg("-o")
                .arg("UserKnownHostsFile=NUL")
                .arg("-o")
                .arg("ConnectTimeout=15")
                .arg(format!("{}@{}", cfg.username, cfg.host))
                .arg(&remote_cmd);

            match cmd.output().await {
                Ok(output) => {
                    if output.status.success() {
                        return Ok(());
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                        last_err = format!("Error uploading {}: {}", remote_path, stderr);
                    }
                }
                Err(e) => {
                    last_err = format!("Failed to execute SSH upload to {}: {}", remote_path, e);
                }
            }

            if attempt < 3 {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
        }

        Err(last_err)
    }

    /// Execute bootstrap script remotely and stream stdout/stderr in real-time
    pub async fn run_bootstrap_stream<R: tauri::Runtime>(
        cfg: &SshConfig,
        key_path: &PathBuf,
        app_handle: &tauri::AppHandle<R>,
    ) -> Result<String, String> {
        let _ = app_handle.emit(
            "deploy-log",
            format!("[SSH] Connecting to {}@{}...", cfg.username, cfg.host),
        );

        let mut cmd = crate::process_utils::tokio_command("ssh");
        cmd.arg("-i")
            .arg(key_path)
            .arg("-p")
            .arg(cfg.port.to_string())
            .arg("-o")
            .arg("StrictHostKeyChecking=no")
            .arg("-o")
            .arg("UserKnownHostsFile=NUL")
            .arg(format!("{}@{}", cfg.username, cfg.host))
            .arg("sudo chmod +x /opt/wp-deployer/bootstrap.sh && sudo /opt/wp-deployer/bootstrap.sh");

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn remote SSH process: {}", e))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();

        let mut captured_dkim = String::new();
        let mut in_dkim_block = false;

        loop {
            tokio::select! {
                line = stdout_reader.next_line() => {
                    match line {
                        Ok(Some(l)) => {
                            if l.contains("===BEGIN_DKIM_OUTPUT===") {
                                in_dkim_block = true;
                            } else if l.contains("===END_DKIM_OUTPUT===") {
                                in_dkim_block = false;
                            } else if in_dkim_block {
                                captured_dkim.push_str(&l);
                                captured_dkim.push('\n');
                            }

                            let _ = app_handle.emit("deploy-log", format!("[REMOTE] {}", l));
                        }
                        Ok(None) => break,
                        Err(e) => {
                            let _ = app_handle.emit("deploy-log", format!("[ERROR reading stdout] {}", e));
                            break;
                        }
                    }
                }
                line = stderr_reader.next_line() => {
                    match line {
                        Ok(Some(l)) => {
                            let trimmed = l.trim();
                            // Do not flag standard shell tracing (+ sh -c ...) or SSH host notices as errors
                            if trimmed.starts_with('+') || trimmed.starts_with("Warning:") {
                                let _ = app_handle.emit("deploy-log", format!("[REMOTE] {}", l));
                            } else if trimmed.to_lowercase().contains("error:") || trimmed.to_lowercase().contains("fatal:") || trimmed.to_lowercase().contains("failed") {
                                let _ = app_handle.emit("deploy-log", format!("[REMOTE:ERR] {}", l));
                            } else {
                                let _ = app_handle.emit("deploy-log", format!("[REMOTE] {}", l));
                            }
                        }
                        Ok(None) => {},
                        Err(e) => {
                            let _ = app_handle.emit("deploy-log", format!("[ERROR reading stderr] {}", e));
                        }
                    }
                }
            }
        }

        let status = child
            .wait()
            .await
            .map_err(|e| format!("Error waiting on SSH process: {}", e))?;

        if !status.success() {
            return Err(format!(
                "Bootstrap script failed with exit code: {:?}",
                status.code()
            ));
        }

        Ok(captured_dkim)
    }
}

fn uuid_simple() -> String {
    let val: u64 = rand::random();
    format!("{:x}", val)
}

