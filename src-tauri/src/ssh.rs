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

/// RAII guard that automatically removes the temporary SSH key file when dropped
pub struct TempKeyGuard {
    path: PathBuf,
}

impl TempKeyGuard {
    pub fn path(&self) -> &PathBuf {
        &self.path
    }
}

impl Drop for TempKeyGuard {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

/// Validates SSH username and host to protect against command-line argument injection
pub fn validate_ssh_target(username: &str, host: &str) -> Result<(), String> {
    if username.starts_with('-') || host.starts_with('-') {
        return Err("SSH username and host must not start with '-'".into());
    }
    if !username.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("Invalid characters in SSH username".into());
    }
    if host.is_empty() || host.contains(|c: char| c.is_whitespace() || c == '\'' || c == '"' || c == ';') {
        return Err("Invalid characters in SSH host".into());
    }
    Ok(())
}

/// Returns the platform-appropriate null device ("NUL" on Windows, "/dev/null" on Unix)
pub fn get_null_device() -> &'static str {
    #[cfg(windows)]
    {
        "NUL"
    }
    #[cfg(not(windows))]
    {
        "/dev/null"
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

    /// Derives the OpenSSH public key corresponding to a given private key
    pub fn derive_public_key(private_key_str: &str) -> Result<String, String> {
        let normalized = private_key_str.replace("\r\n", "\n");
        let priv_key = PrivateKey::from_openssh(&normalized)
            .map_err(|e| format!("Failed to parse private key: {}", e))?;
        let pub_key = priv_key.public_key();
        let openssh_pub = pub_key
            .to_openssh()
            .map_err(|e| format!("Failed to encode public key: {}", e))?;
        Ok(format!("{} ubuntu", openssh_pub))
    }

    /// Saves the private key to a secure temporary file and returns a guard that auto-deletes on drop
    pub fn save_temp_key(key_content: &str) -> Result<TempKeyGuard, String> {
        let temp_dir = std::env::temp_dir();
        let key_path = temp_dir.join(format!("cloudpress_key_{}", uuid_simple()));
        let normalized = key_content.replace("\r\n", "\n");

        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&key_path)
                .map_err(|e| format!("Failed to create temporary SSH key file: {}", e))?;
            file.write_all(normalized.as_bytes())
                .map_err(|e| format!("Failed to write private key: {}", e))?;
        }

        #[cfg(windows)]
        {
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&key_path)
                .map_err(|e| format!("Failed to create temporary SSH key file: {}", e))?;
            file.write_all(normalized.as_bytes())
                .map_err(|e| format!("Failed to write private key: {}", e))?;
            drop(file);

            if let Ok(username) = std::env::var("USERNAME") {
                if !username.trim().is_empty() {
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
            }
        }

        Ok(TempKeyGuard { path: key_path })
    }

    /// Test basic SSH connectivity
    pub async fn test_connection(cfg: &SshConfig) -> Result<String, String> {
        validate_ssh_target(&cfg.username, &cfg.host)?;
        let key_guard = Self::save_temp_key(&cfg.private_key)?;

        let mut cmd = crate::process_utils::tokio_command("ssh");
        cmd.arg("-i")
            .arg(key_guard.path())
            .arg("-p")
            .arg(cfg.port.to_string())
            .arg("-o")
            .arg("IdentitiesOnly=yes")
            .arg("-o")
            .arg("PreferredAuthentications=publickey")
            .arg("-o")
            .arg("StrictHostKeyChecking=no")
            .arg("-o")
            .arg(format!("UserKnownHostsFile={}", get_null_device()))
            .arg("-o")
            .arg("ConnectTimeout=10")
            .arg("--")
            .arg(format!("{}@{}", cfg.username, cfg.host))
            .arg("echo 'SSH_CONNECTION_SUCCESS'");

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let output = cmd
            .output()
            .await
            .map_err(|e| format!("SSH command execution failed: {}", e))?;

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
        validate_ssh_target(&cfg.username, &cfg.host)?;
        let start = std::time::Instant::now();
        let _ = app_handle.emit(
            "deploy-log",
            format!("[SSH] Waiting for SSH service on {} to start and authenticate (timeout: {}s)...", cfg.host, max_wait_secs),
        );

        let mut last_err = String::new();
        let mut last_logged_state = String::new();
        let mut last_log_time = std::time::Instant::now();

        while start.elapsed().as_secs() < max_wait_secs {
            let mut cmd = crate::process_utils::tokio_command("ssh");
            cmd.arg("-i")
                .arg(key_path)
                .arg("-p")
                .arg(cfg.port.to_string())
                .arg("-o")
                .arg("IdentitiesOnly=yes")
                .arg("-o")
                .arg("PreferredAuthentications=publickey")
                .arg("-o")
                .arg("StrictHostKeyChecking=no")
                .arg("-o")
                .arg(format!("UserKnownHostsFile={}", get_null_device()))
                .arg("-o")
                .arg("ConnectTimeout=5")
                .arg("--")
                .arg(format!("{}@{}", cfg.username, cfg.host))
                .arg("echo 'SSH_VM_READY'");

            cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

            match cmd.output().await {
                Ok(output) => {
                    if output.status.success() {
                        let out_str = String::from_utf8_lossy(&output.stdout);
                        if out_str.contains("SSH_VM_READY") {
                            let _ = app_handle.emit(
                                "deploy-log",
                                format!("[SSH] VM {} is ready and accepted key authentication! Proceeding...", cfg.host),
                            );
                            return Ok(());
                        }
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                        if !stderr.is_empty() {
                            last_err = stderr.clone();
                        }

                        let state = if last_err.contains("Connection timed out") {
                            "VM starting up network interface (Connection timed out)..."
                        } else if last_err.contains("Connection refused") {
                            "VM network active; waiting for SSH daemon to start..."
                        } else if last_err.contains("Permission denied") {
                            "SSH daemon listening; waiting for cloud-init to inject SSH keys..."
                        } else if last_err.contains("UNPROTECTED PRIVATE KEY FILE") || last_err.contains("Permissions") {
                            "SSH key permissions warning, adjusting..."
                        } else if !last_err.is_empty() {
                            last_err.as_str()
                        } else {
                            "Waiting for response..."
                        };

                        let elapsed = start.elapsed().as_secs();
                        if state != last_logged_state || last_log_time.elapsed().as_secs() >= 15 {
                            last_logged_state = state.to_string();
                            last_log_time = std::time::Instant::now();
                            let _ = app_handle.emit(
                                "deploy-log",
                                format!("[SSH Check {}s] {}", elapsed, state),
                            );
                        }
                    }
                }
                Err(e) => {
                    last_err = format!("Failed to spawn local ssh: {}", e);
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        }

        let err_detail = if last_err.is_empty() {
            "No response received from VM.".to_string()
        } else {
            format!("Last SSH response: {}", last_err)
        };

        Err(format!(
            "Timed out waiting for SSH service on {} after {}s. {}. The VM may still be booting.",
            cfg.host, max_wait_secs, err_detail
        ))
    }

    /// Transfer a file to the remote server using base64 stream and sudo tee
    pub async fn upload_file_content(
        cfg: &SshConfig,
        key_path: &PathBuf,
        remote_path: &str,
        content: &str,
    ) -> Result<(), String> {
        validate_ssh_target(&cfg.username, &cfg.host)?;

        // Ensure remote path does not contain shell metacharacters
        if remote_path.contains(|c: char| c == ';' || c == '&' || c == '|' || c == '`' || c == '$' || c == '\n' || c == '\r' || c.is_whitespace()) {
            return Err("Invalid characters in remote file path".into());
        }

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
                .arg("IdentitiesOnly=yes")
                .arg("-o")
                .arg("PreferredAuthentications=publickey")
                .arg("-o")
                .arg("StrictHostKeyChecking=no")
                .arg("-o")
                .arg(format!("UserKnownHostsFile={}", get_null_device()))
                .arg("-o")
                .arg("ConnectTimeout=15")
                .arg("--")
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
        validate_ssh_target(&cfg.username, &cfg.host)?;
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
            .arg("IdentitiesOnly=yes")
            .arg("-o")
            .arg("PreferredAuthentications=publickey")
            .arg("-o")
            .arg("StrictHostKeyChecking=no")
            .arg("-o")
            .arg(format!("UserKnownHostsFile={}", get_null_device()))
            .arg("--")
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

