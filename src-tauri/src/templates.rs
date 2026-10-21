use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeployConfig {
    pub domain: String,
    pub oci_vm_ip: String,
    pub wp_site_title: String,
    pub wp_admin_user: String,
    pub wp_admin_email: String,
    pub wp_admin_password: String,
    pub mail_account: String,
    pub mail_password: String,
    pub smtp_relay_host: String,
    pub smtp_relay_user: String,
    pub smtp_relay_password: String,
    pub mysql_database: String,
    pub mysql_user: String,
    pub mysql_password: String,
    pub mysql_root_password: String,
}

impl Default for DeployConfig {
    fn default() -> Self {
        Self {
            domain: "example.com".into(),
            oci_vm_ip: "".into(),
            wp_site_title: "My Cloud WordPress".into(),
            wp_admin_user: "admin".into(),
            wp_admin_email: "admin@example.com".into(),
            wp_admin_password: "ChangeMe123!".into(),
            mail_account: "admin@example.com".into(),
            mail_password: "MailPassword123!".into(),
            smtp_relay_host: "smtp-relay.brevo.com".into(),
            smtp_relay_user: "".into(),
            smtp_relay_password: "".into(),
            mysql_database: "wordpress".into(),
            mysql_user: "wpuser".into(),
            mysql_password: "WpDbPassword123!".into(),
            mysql_root_password: "RootDbPassword123!".into(),
        }
    }
}

pub struct Templates;

impl Templates {
    /// Generates docker-compose.yml tailored for ARM64 Ampere A1
    pub fn docker_compose() -> String {
        r#"services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - wp_data:/var/www/html
    networks:
      - app-net

  wordpress:
    image: wordpress:fpm-alpine
    restart: unless-stopped
    env_file: .env
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_NAME: ${MYSQL_DATABASE:-wordpress}
      WORDPRESS_DB_USER: ${MYSQL_USER:-wpuser}
      WORDPRESS_DB_PASSWORD: ${MYSQL_PASSWORD}
      WORDPRESS_CONFIG_EXTRA: |
        define('WP_HOME', 'https://${DOMAIN}');
        define('WP_SITEURL', 'https://${DOMAIN}');
        define('FORCE_SSL_ADMIN', true);
        if (isset($$_SERVER['HTTP_X_FORWARDED_PROTO']) && $$_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
            $$_SERVER['HTTPS'] = 'on';
        }
    volumes:
      - wp_data:/var/www/html
    depends_on:
      - db
    networks:
      - app-net

  db:
    image: mariadb:11
    restart: unless-stopped
    env_file: .env
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --innodb-buffer-pool-size=256M
    environment:
      MYSQL_DATABASE: ${MYSQL_DATABASE:-wordpress}
      MYSQL_USER: ${MYSQL_USER:-wpuser}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - app-net

  wpcli:
    image: wordpress:cli-php8.3
    user: "0:0"
    env_file: .env
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_NAME: ${MYSQL_DATABASE:-wordpress}
      WORDPRESS_DB_USER: ${MYSQL_USER:-wpuser}
      WORDPRESS_DB_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - wp_data:/var/www/html
    depends_on:
      - wordpress
      - db
    networks:
      - app-net

  mailserver:
    image: ghcr.io/docker-mailserver/docker-mailserver:latest
    container_name: mailserver
    hostname: mail.${DOMAIN}
    env_file: .env
    ports:
      - "25:25"
      - "587:587"
      - "993:993"
    volumes:
      - mail_data:/var/mail
      - mail_state:/var/mail-state
      - mail_logs:/var/log/mail
      - mail_config:/tmp/docker-mailserver
      - /etc/localtime:/etc/localtime:ro
      - caddy_data:/etc/letsencrypt:ro
    environment:
      - OVERRIDE_HOSTNAME=mail.${DOMAIN}
      - DMS_SSL=manual
      - SSL_TYPE=manual
      - SSL_CERT_PATH=/etc/letsencrypt/caddy/certificates/acme-v02.api.letsencrypt.org-directory/mail.${DOMAIN}/mail.${DOMAIN}.crt
      - SSL_KEY_PATH=/etc/letsencrypt/caddy/certificates/acme-v02.api.letsencrypt.org-directory/mail.${DOMAIN}/mail.${DOMAIN}.key
      - ENABLE_SPAMASSASSIN=0
      - ENABLE_CLAMAV=0
      - ENABLE_FAIL2BAN=1
      - ENABLE_POSTGREY=0
      - ONE_DIR=1
      - DEFAULT_RELAY_HOST=[${SMTP_RELAY_HOST}]:587
      - RELAY_HOST=${SMTP_RELAY_HOST}
      - RELAY_PORT=587
      - RELAY_USER=${SMTP_RELAY_USER}
      - RELAY_PASSWORD=${SMTP_RELAY_PASSWORD}
    cap_add:
      - NET_ADMIN
    restart: always
    networks:
      - app-net

volumes:
  caddy_data:
  caddy_config:
  wp_data:
  db_data:
  mail_data:
  mail_state:
  mail_logs:
  mail_config:

networks:
  app-net:
    driver: bridge
"#
        .to_string()
    }

    /// Generates Caddyfile reverse-proxy config
    pub fn caddyfile(domain: &str) -> String {
        format!(
            r#"{{
    email admin@{domain}
}}

{domain}, www.{domain} {{
    root * /var/www/html
    encode zstd gzip
    php_fastcgi wordpress:9000
    file_server
}}

mail.{domain} {{
    respond "Mail Server Online" 200
}}
"#,
            domain = domain
        )
    }

    /// Generates .env file content with safe escaping
    pub fn env_file(cfg: &DeployConfig, cf_api_token: &str, cf_zone_id: &str) -> String {
        format!(
            r#"DOMAIN={domain}
MYSQL_DATABASE={db_name}
MYSQL_USER={db_user}
MYSQL_PASSWORD={db_pass}
MYSQL_ROOT_PASSWORD={db_root_pass}
SMTP_RELAY_HOST={smtp_host}
SMTP_RELAY_USER={smtp_user}
SMTP_RELAY_PASSWORD={smtp_pass}
MAIL_ACCOUNT={mail_acc}
MAIL_PASSWORD={mail_pass}
WP_SITE_TITLE={wp_title}
WP_ADMIN_USER={wp_user}
WP_ADMIN_PASSWORD={wp_pass}
WP_ADMIN_EMAIL={wp_email}
CF_API_TOKEN={cf_token}
CF_ZONE_ID={cf_zone}
"#,
            domain = escape_env(&cfg.domain),
            db_name = escape_env(&cfg.mysql_database),
            db_user = escape_env(&cfg.mysql_user),
            db_pass = escape_env(&cfg.mysql_password),
            db_root_pass = escape_env(&cfg.mysql_root_password),
            smtp_host = escape_env(&cfg.smtp_relay_host),
            smtp_user = escape_env(&cfg.smtp_relay_user),
            smtp_pass = escape_env(&cfg.smtp_relay_password),
            mail_acc = escape_env(&cfg.mail_account),
            mail_pass = escape_env(&cfg.mail_password),
            wp_title = escape_env(&cfg.wp_site_title),
            wp_user = escape_env(&cfg.wp_admin_user),
            wp_pass = escape_env(&cfg.wp_admin_password),
            wp_email = escape_env(&cfg.wp_admin_email),
            cf_token = escape_env(cf_api_token),
            cf_zone = escape_env(cf_zone_id),
        )
    }

    /// Generates cloudflare-ddns.sh script that dynamically monitors and updates Cloudflare DNS records
    /// if Google Cloud assigns a new external IP address to the VM.
    pub fn cloudflare_ddns_sh() -> String {
        r#"#!/usr/bin/env bash
# ==============================================================================
# CloudPress Automatic Dynamic DNS (DDNS) for Cloudflare
# Monitors the VM's public IP and syncs Cloudflare A records if the IP changes.
# ==============================================================================

set -euo pipefail

ENV_FILE="/opt/wp-deployer/.env"
CACHE_FILE="/opt/wp-deployer/.last_ip"
LOG_FILE="/var/log/cloudpress-ddns.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DDNS] $*" | tee -a "$LOG_FILE"
}

if [ ! -f "$ENV_FILE" ]; then
    log "Config file $ENV_FILE not found. Exiting."
    exit 0
fi

# Extract credentials from .env
CF_API_TOKEN=$(grep -E '^CF_API_TOKEN=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"\r\n' || true)
CF_ZONE_ID=$(grep -E '^CF_ZONE_ID=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"\r\n' || true)
DOMAIN=$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"\r\n' || true)

if [ -z "$CF_API_TOKEN" ] || [ -z "$CF_ZONE_ID" ] || [ -z "$DOMAIN" ]; then
    log "Cloudflare credentials or domain missing in $ENV_FILE. Skipping DDNS check."
    exit 0
fi

# Detect current external public IPv4 address with multiple redundant fallbacks
CURRENT_IP=""
for url in "https://api.ipify.org" "https://ifconfig.me" "https://checkip.amazonaws.com" "https://icanhazip.com"; do
    IP=$(curl -s4 --connect-timeout 8 --max-time 15 "$url" 2>/dev/null | tr -d '[:space:]' || true)
    if echo "$IP" | grep -Eq '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
        CURRENT_IP="$IP"
        break
    fi
done

if [ -z "$CURRENT_IP" ]; then
    log "Warning: Unable to determine public IPv4 address from any provider. Will retry next cycle."
    exit 0
fi

# Check against cached IP to prevent redundant API calls
if [ -f "$CACHE_FILE" ]; then
    LAST_IP=$(cat "$CACHE_FILE" | tr -d '[:space:]' || true)
    if [ "$CURRENT_IP" = "$LAST_IP" ]; then
        # IP has not changed, silent exit
        exit 0
    fi
fi

log "IP change detected! Previous: '${LAST_IP:-none}', New: '$CURRENT_IP'. Updating Cloudflare DNS..."

# Fetch existing A records for this zone from Cloudflare
EXISTING_RECORDS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?type=A" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" || true)

# Update @, www, and mail records
TARGET_RECORDS=("$DOMAIN" "www.$DOMAIN" "mail.$DOMAIN")

for REC_NAME in "${TARGET_RECORDS[@]}"; do
    # Mail must NOT be proxied (proxy breaks raw SMTP/IMAP ports); @ and www should be proxied
    PROXIED=true
    if [[ "$REC_NAME" == mail.* ]]; then
        PROXIED=false
    fi

    # Find matching record ID
    REC_ID=""
    if command -v jq &>/dev/null; then
        REC_ID=$(echo "$EXISTING_RECORDS" | jq -r --arg n "$REC_NAME" '.result[]? | select(.name == $n) | .id' 2>/dev/null | head -n 1 || true)
    else
        # Fallback without jq using grep & sed
        REC_ID=$(echo "$EXISTING_RECORDS" | grep -o '{"id":"[^"]*","zone_id":"[^"]*","zone_name":"[^"]*","name":"'"$REC_NAME"'"' | head -n 1 | sed -E 's/.*"id":"([^"]+)".*/\1/' || true)
    fi

    if [ -n "$REC_ID" ] && [ "$REC_ID" != "null" ]; then
        # Update existing record
        RES=$(curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$REC_ID" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data '{"content":"'"$CURRENT_IP"'","proxied":'"$PROXIED"'}' || true)
        log "Updated $REC_NAME -> $CURRENT_IP (proxied: $PROXIED)"
    else
        # Record does not exist, create it
        RES=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data '{"type":"A","name":"'"$REC_NAME"'","content":"'"$CURRENT_IP"'","ttl":1,"proxied":'"$PROXIED"'}' || true)
        log "Created $REC_NAME -> $CURRENT_IP (proxied: $PROXIED)"
    fi
done

echo "$CURRENT_IP" > "$CACHE_FILE"
chmod 600 "$CACHE_FILE"
log "Cloudflare DNS update complete. Cached IP is now $CURRENT_IP."
"#
        .to_string()
    }

    /// Generates the WordPress SMTP MU-Plugin to route all wp_mail through mailserver.
    /// Safely escapes interpolated variables and relies on standard TLS certificate verification.
    pub fn wp_smtp_mu_plugin(cfg: &DeployConfig) -> String {
        format!(
            r#"<?php
/**
 * Plugin Name: Auto CloudPress SMTP Mailer
 * Description: Automatically routes all WordPress emails through the local Docker Mailserver container.
 * Version: 1.0.0
 * Author: CloudPress Deployer
 */

add_action('phpmailer_init', function($phpmailer) {{
    $phpmailer->isSMTP();
    $phpmailer->Host = 'mailserver';
    $phpmailer->Port = 587;
    $phpmailer->SMTPAuth = true;
    $phpmailer->Username = getenv('MAIL_ACCOUNT') ?: '{mail_acc}';
    $phpmailer->Password = getenv('MAIL_PASSWORD') ?: '{mail_pass}';
    $phpmailer->SMTPSecure = 'tls';
    $phpmailer->From = getenv('MAIL_ACCOUNT') ?: '{mail_acc}';
    $phpmailer->FromName = getenv('WP_SITE_TITLE') ?: '{site_title}';
}});
"#,
            mail_acc = escape_php_string(&cfg.mail_account),
            mail_pass = escape_php_string(&cfg.mail_password),
            site_title = escape_php_string(&cfg.wp_site_title)
        )
    }

    /// Generates bootstrap.sh shell script for the remote server.
    /// Relies on safely quoted environment variables from .env to prevent command injection.
    pub fn bootstrap_sh(cfg: &DeployConfig) -> String {
        let mu_plugin_content = Self::wp_smtp_mu_plugin(cfg);
        use base64::Engine;
        let mu_plugin_b64 =
            base64::engine::general_purpose::STANDARD.encode(mu_plugin_content.as_bytes());

        format!(
            r#"#!/usr/bin/env bash
set -e

echo "[BOOTSTRAP] Starting Zero-Cost WordPress + Mailserver setup on Google Cloud (e2-micro)..."
export DEBIAN_FRONTEND=noninteractive

# 1. Setup 3GB Swap space (crucial for stability on Google Cloud e2-micro 1GB RAM)
if [ ! -f /swapfile ]; then
    echo "[BOOTSTRAP] Creating 3GB swapfile for Google Cloud e2-micro..."
    fallocate -l 3G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=3072
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "[BOOTSTRAP] 3GB swapfile configured successfully."
else
    echo "[BOOTSTRAP] Swapfile already exists."
fi

# 2. Configure Ubuntu firewall (opening 80, 443, 25, 587, 993)
echo "[BOOTSTRAP] Configuring firewall (opening 80, 443, 25, 587, 993)..."
iptables -I INPUT 1 -p tcp --match multiport --dports 80,443,25,587,993 -j ACCEPT || true

if command -v netfilter-persistent &> /dev/null; then
    netfilter-persistent save || true
fi

if command -v ufw &> /dev/null; then
    ufw allow 22/tcp || true
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    ufw allow 25/tcp || true
    ufw allow 587/tcp || true
    ufw allow 993/tcp || true
fi

# 3. Ensure Docker and Docker Compose Plugin are installed
if ! command -v docker &> /dev/null; then
    echo "[BOOTSTRAP] Docker not found. Installing Docker engine (this takes about 5 minutes)..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh 2>&1 | grep -v '^+ ' || true
    systemctl enable docker
    systemctl start docker
    echo "[BOOTSTRAP] Docker installed successfully."
else
    echo "[BOOTSTRAP] Docker is already installed."
fi

# 4. Navigate to deployment directory and spin up Docker stack
cd /opt/wp-deployer

# Load environment variables safely
if [ -f /opt/wp-deployer/.env ]; then
    set -a
    . /opt/wp-deployer/.env
    set +a
fi

echo "[BOOTSTRAP] Pulling container images and starting Docker Compose stack..."
docker compose pull
docker compose up -d

echo "[BOOTSTRAP] Waiting for containers to initialize..."
sleep 15

# 5. Setup Mail Account and DKIM in docker-mailserver
echo "[BOOTSTRAP] Configuring docker-mailserver user '${{MAIL_ACCOUNT}}'..."
docker exec mailserver setup email add "${{MAIL_ACCOUNT}}" "${{MAIL_PASSWORD}}" || true

echo "[BOOTSTRAP] Generating OpenDKIM keys for domain '${{DOMAIN}}'..."
docker exec mailserver setup config dkim domain "${{DOMAIN}}" || true

# Extract OpenDKIM key for Cloudflare DNS pushing
echo "===BEGIN_DKIM_OUTPUT==="
DKIM_FILE="/tmp/docker-mailserver/opendkim/keys/${{DOMAIN}}/mail.txt"
if [ -f "$DKIM_FILE" ]; then
    cat "$DKIM_FILE"
elif docker exec mailserver test -f "$DKIM_FILE"; then
    docker exec mailserver cat "$DKIM_FILE"
else
    echo "NO_DKIM_FILE_FOUND"
fi
echo "===END_DKIM_OUTPUT==="

# 6. WordPress core install & MU-Plugin configuration
# Wait for WordPress container to initialize core files into volume
echo "[BOOTSTRAP] Waiting for WordPress core initialization..."
RETRIES=40
until docker compose exec -T -u root wordpress test -f /var/www/html/wp-includes/version.php; do
    echo "[BOOTSTRAP] Waiting for WordPress files..."
    sleep 3
    RETRIES=$((RETRIES-1))
    if [ $RETRIES -le 0 ]; then
        break
    fi
done

# Configure PHP-FPM to preserve container environment variables
docker compose exec -T -u root wordpress sh -c 'echo "clear_env = no" >> /usr/local/etc/php-fpm.d/zz-docker.conf' || true

# Wait for MariaDB to be fully initialized and accept queries from WordPress
echo "[BOOTSTRAP] Waiting for MariaDB to accept connections from WordPress container..."
RETRIES=60
until docker compose exec -T -u root wordpress php -r '
mysqli_report(MYSQLI_REPORT_OFF);
$conn = @mysqli_connect("db", getenv("MYSQL_USER"), getenv("MYSQL_PASSWORD"), getenv("MYSQL_DATABASE"));
if ($conn) {{
    mysqli_close($conn);
    exit(0);
}}
exit(1);
'; do
    echo "[BOOTSTRAP] Waiting for database 'db' to be ready..."
    sleep 3
    RETRIES=$((RETRIES-1))
    if [ $RETRIES -le 0 ]; then
        echo "[BOOTSTRAP ERROR] Database connection to MariaDB timed out."
        exit 1
    fi
done
echo "[BOOTSTRAP] Database connection verified successfully!"

echo "[BOOTSTRAP] Setting initial permissions on WordPress volume..."
docker compose exec -T -u root wordpress chown -R www-data:www-data /var/www/html || true

echo "[BOOTSTRAP] Generating robust wp-config.php..."
docker compose run --rm wpcli wp config create \
    --dbname="$MYSQL_DATABASE" \
    --dbuser="$MYSQL_USER" \
    --dbpass="$MYSQL_PASSWORD" \
    --dbhost="db" \
    --force \
    --extra-php="
define('WP_HOME', 'https://${{DOMAIN}}');
define('WP_SITEURL', 'https://${{DOMAIN}}');
define('FORCE_SSL_ADMIN', true);
if (isset(\$_SERVER['HTTP_X_FORWARDED_PROTO']) && \$_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {{
    \$_SERVER['HTTPS'] = 'on';
}}
" \
    --allow-root

if ! docker compose run --rm wpcli wp core is-installed --allow-root 2>/dev/null; then
    echo "[BOOTSTRAP] Installing WordPress core via wpcli..."
    docker compose run --rm wpcli wp core install \
        --url="https://${{DOMAIN}}" \
        --title="$WP_SITE_TITLE" \
        --admin_user="$WP_ADMIN_USER" \
        --admin_password="$WP_ADMIN_PASSWORD" \
        --admin_email="$WP_ADMIN_EMAIL" \
        --skip-email \
        --allow-root
else
    echo "[BOOTSTRAP] WordPress is already installed."
fi

# 7. Install SMTP MU-Plugin
echo "[BOOTSTRAP] Installing SMTP MU-Plugin to route WordPress mail..."
docker compose exec -T -u root wordpress mkdir -p /var/www/html/wp-content/mu-plugins
echo "{mu_plugin_b64}" | base64 -d | docker compose exec -T -u root wordpress tee /var/www/html/wp-content/mu-plugins/smtp.php > /dev/null

echo "[BOOTSTRAP] Setting correct permissions on WordPress files..."
docker compose exec -T -u root wordpress chown -R www-data:www-data /var/www/html || true
docker compose exec -T -u root wordpress chmod -R 755 /var/www/html || true

echo "[BOOTSTRAP] Restarting WordPress PHP-FPM container..."
docker compose restart wordpress

# 8. Setup Cloudflare Dynamic DNS (DDNS) Service & Timer
echo "[BOOTSTRAP] Configuring automatic Cloudflare Dynamic DNS (DDNS) monitoring..."
chmod +x /opt/wp-deployer/cloudflare-ddns.sh

# Install jq if missing for robust JSON parsing
if ! command -v jq &> /dev/null; then
    apt-get update -y && apt-get install -y jq || true
fi

# Create systemd service for DDNS
cat << 'EOF' > /etc/systemd/system/cloudpress-ddns.service
[Unit]
Description=CloudPress Cloudflare Dynamic DNS Updater
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/wp-deployer/cloudflare-ddns.sh
StandardOutput=journal
StandardError=journal
EOF

# Create systemd timer to run DDNS 1 min after boot and every 5 minutes
cat << 'EOF' > /etc/systemd/system/cloudpress-ddns.timer
[Unit]
Description=Run CloudPress Cloudflare Dynamic DNS every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now cloudpress-ddns.timer

# Run the DDNS script once immediately to cache the initial IP
/opt/wp-deployer/cloudflare-ddns.sh || true
echo "[BOOTSTRAP] Dynamic DNS (DDNS) service activated and running."

echo "[BOOTSTRAP] Stack successfully deployed and active!"
"#,
            mu_plugin_b64 = mu_plugin_b64
        )
    }
}

/// Helper function to safely escape strings for .env file
fn escape_env(val: &str) -> String {
    let clean = val.replace('\r', "").replace('\n', "");
    let escaped = clean.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{}\"", escaped)
}

/// Helper function to safely escape strings for PHP code
fn escape_php_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace('\0', "")
}
