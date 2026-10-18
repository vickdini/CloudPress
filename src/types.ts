export interface OciConfig {
  tenancy_ocid: string;
  user_ocid: string;
  compartment_ocid: string;
  region: string;
  fingerprint: string;
  private_key_path: string;
  private_key_pem?: string;
  subnet_ocid?: string;
  security_list_ocid?: string;
  shape: string;
  ocpus: number;
  memory_in_gbs: number;
  ssh_public_key: string;
  auto_retry_out_of_capacity: boolean;
  existing_vm_ip?: string;
}

export interface DeployConfig {
  domain: string;
  oci_vm_ip: string;
  wp_site_title: string;
  wp_admin_user: string;
  wp_admin_email: string;
  wp_admin_password: string;
  mail_account: string;
  mail_password: string;
  smtp_relay_host: string;
  smtp_relay_user: string;
  smtp_relay_password: string;
  mysql_database: string;
  mysql_user: string;
  mysql_password: string;
  mysql_root_password: string;
}

export interface FullDeployPayload {
  oci: OciConfig;
  cloudflare_api_token: string;
  cloudflare_zone_id: string;
  deploy: DeployConfig;
  ssh_private_key: string;
}

export interface GeneratedKeyPair {
  public_key: string;
  private_key: string;
}

export interface StageProgress {
  stage: number;
  stage_name: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  text: string;
  type: 'oci' | 'cloudflare' | 'ssh' | 'remote' | 'bootstrap' | 'success' | 'error' | 'info';
}
