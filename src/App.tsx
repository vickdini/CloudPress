import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Step1Website } from './components/Step1Website';
import { Step2Server } from './components/Step2Server';
import { Step3Domain } from './components/Step3Domain';
import { Step4Email } from './components/Step4Email';
import { Step5Launch } from './components/Step5Launch';
import { Terminal } from './components/Terminal';
import type {
  GcpConfig,
  OciConfig,
  DeployConfig,
  FullDeployPayload,
  StageProgress,
  LogMessage,
  GeneratedKeyPair,
  CloudflareRecord,
} from './types';
import {
  Globe,
  Server,
  Cloud,
  Mail,
  Rocket,
  Check,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const INITIAL_STAGES: StageProgress[] = [
  {
    stage: 1,
    stage_name: 'Provisioning Google Cloud e2-micro VM & Firewall',
    status: 'idle',
    message: 'Allocates Always Free e2-micro instance (30 GB disk, us-central1/west1/east1) on Google Cloud.',
  },
  {
    stage: 2,
    stage_name: 'Connecting Domain & Cloudflare DNS',
    status: 'idle',
    message: 'Upserts A records for @, www, mail and sets MX & SPF/DMARC policies.',
  },
  {
    stage: 3,
    stage_name: 'Securing Server & Installing Software',
    status: 'idle',
    message: 'Configures 2GB swapfile, opens OS firewall iptables, installs Docker Engine.',
  },
  {
    stage: 4,
    stage_name: 'Starting WordPress & Email Stack',
    status: 'idle',
    message: 'Starts Caddy 2, WordPress FPM, MariaDB 11, and Docker-Mailserver.',
  },
  {
    stage: 5,
    stage_name: 'Generating Email Security Keys (DKIM)',
    status: 'idle',
    message: 'Generates DKIM keys in container and pushes mail._domainkey to Cloudflare.',
  },
  {
    stage: 6,
    stage_name: 'Finalizing WordPress & Email Integration',
    status: 'idle',
    message: 'Runs wp core install and activates lightweight SMTP MU-Plugin.',
  },
];

const STEPS = [
  {
    id: 1,
    title: 'Website & Login',
    subtitle: 'Name & passwords',
    icon: Globe,
  },
  {
    id: 2,
    title: 'Google Cloud VM',
    subtitle: 'e2-micro Always Free',
    icon: Server,
  },
  {
    id: 3,
    title: 'Connect Domain',
    subtitle: 'Cloudflare & SSL',
    icon: Cloud,
  },
  {
    id: 4,
    title: 'Email Setup',
    subtitle: 'Mailbox & sending',
    icon: Mail,
  },
  {
    id: 5,
    title: 'Review & Launch',
    subtitle: 'Autonomous deploy',
    icon: Rocket,
  },
];

export const App: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [currentStageNumber, setCurrentStageNumber] = useState<number>(1);
  const [stages, setStages] = useState<StageProgress[]>(INITIAL_STAGES);
  const [isDeletingVm, setIsDeletingVm] = useState<boolean>(false);
  const [vmDeleted, setVmDeleted] = useState<boolean>(false);

  // Terminal State - default closed to keep UI friendly and calm
  const [logs, setLogs] = useState<LogMessage[]>([
    {
      id: 'init',
      timestamp: '00:00:00',
      text: '[CloudPress Initialized] Welcome to the guided setup wizard.',
      type: 'info',
    },
  ]);
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(false);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState<boolean>(false);

  // Dynamic clearance for terminal so content is never trapped behind it when open
  const terminalBottomPadding = !isTerminalOpen
    ? '5rem'
    : isTerminalExpanded
    ? 'calc(75vh + 3.5rem)'
    : 'calc(18rem + 3.5rem)';

  useEffect(() => {
    if (isTerminalOpen) {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const distanceFromBottom = docHeight - (scrollY + windowHeight);

      if (distanceFromBottom < 400) {
        const timer = setTimeout(() => {
          window.scrollBy({
            top: isTerminalExpanded ? windowHeight * 0.75 : 300,
            behavior: 'smooth',
          });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isTerminalOpen, isTerminalExpanded]);

  // Form State
  const [gcpConfig, setGcpConfig] = useState<GcpConfig>({
    project_id: '',
    region: 'us-central1',
    zone: 'us-central1-a',
    machine_type: 'e2-micro',
    disk_size_gb: 30,
    service_account_json_path: '',
    service_account_json_content: '',
    ssh_public_key: '',
    existing_vm_ip: '',
    auth_mode: 'oauth',
    oauth_access_token: '',
    oauth_refresh_token: '',
    oauth_user_email: '',
    oauth_user_name: '',
    oauth_user_picture: '',
  });

  const [ociConfig, setOciConfig] = useState<OciConfig>({
    tenancy_ocid: '',
    user_ocid: '',
    compartment_ocid: '',
    region: 'eu-milan-1',
    fingerprint: '',
    private_key_path: '',
    shape: 'VM.Standard.A1.Flex',
    ocpus: 1,
    memory_in_gbs: 6,
    ssh_public_key: '',
    auto_retry_out_of_capacity: true,
    existing_vm_ip: '',
  });

  const [sshPrivateKey, setSshPrivateKey] = useState<string>('');
  const [cfApiToken, setCfApiToken] = useState<string>('');
  const [cfZoneId, setCfZoneId] = useState<string>('');

  const [deployConfig, setDeployConfig] = useState<DeployConfig>({
    domain: 'example.com',
    oci_vm_ip: '',
    wp_site_title: 'My Free Cloud Website',
    wp_admin_user: 'admin',
    wp_admin_email: 'admin@example.com',
    wp_admin_password: 'ChangeMeWp123!',
    mail_account: 'admin@example.com',
    mail_password: 'ChangeMeMail123!',
    smtp_relay_host: 'smtp-relay.brevo.com',
    smtp_relay_user: '',
    smtp_relay_password: '',
    mysql_database: 'wordpress',
    mysql_user: 'wpuser',
    mysql_password: 'ChangeMeDb123!',
    mysql_root_password: 'ChangeMeRootDb123!',
  });

  // Log append helper
  const addLog = (text: string) => {
    const now = new Date();
    const timeStr =
      now.toTimeString().split(' ')[0] +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0');
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: timeStr,
        text,
        type: 'info',
      },
    ]);
  };

  // Pre-generate SSH Key on initial mount so users don't have to fiddle with keys manually
  useEffect(() => {
    const initSshKey = async () => {
      try {
        const res = await invoke<GeneratedKeyPair>('generate_ssh_key');
        setGcpConfig(prev => ({ ...prev, ssh_public_key: res.public_key }));
        setOciConfig(prev => ({ ...prev, ssh_public_key: res.public_key }));
        setSshPrivateKey(res.private_key);
        addLog('[Security Key] Automatically initialized high-security Ed25519 digital key.');
      } catch {
        // Fallback or ignore in browser dev preview
      }
    };
    initSshKey();
  }, []);

  // Setup Tauri Event Listeners
  useEffect(() => {
    let unlistenLog: (() => void) | undefined;
    let unlistenStage: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unlistenLog = await listen<string>('deploy-log', event => {
          addLog(event.payload);
        });

        unlistenStage = await listen<StageProgress>('deploy-stage', event => {
          const updated = event.payload;
          setCurrentStageNumber(updated.stage);
          setStages(prev =>
            prev.map(s => (s.stage === updated.stage ? { ...s, ...updated } : s))
          );
        });
      } catch (e) {
        console.warn('Could not register Tauri event listeners (browser fallback):', e);
      }
    };

    setupListeners();

    return () => {
      if (unlistenLog) unlistenLog();
      if (unlistenStage) unlistenStage();
    };
  }, []);

  // Profile Save / Load
  const handleSaveProfile = async () => {
    const profile = {
      gcpConfig,
      ociConfig,
      sshPrivateKey,
      cfApiToken,
      cfZoneId,
      deployConfig,
    };
    try {
      await invoke('save_profile', { profileJson: JSON.stringify(profile, null, 2) });
      addLog('[Profile Saved] Configuration saved locally to ~/.cloudpress/profile.json');
      alert('Your progress has been saved! You can load it anytime.');
    } catch (err) {
      alert(`Failed to save profile: ${err}`);
    }
  };

  const handleLoadProfile = async () => {
    try {
      const dataStr = await invoke<string>('load_profile');
      const data = JSON.parse(dataStr);
      if (data.gcpConfig) {
        setGcpConfig(data.gcpConfig);
      } else if (data.ociConfig?.existing_vm_ip) {
        // Seamlessly migrate existing IP to Google Cloud config
        setGcpConfig(prev => ({ ...prev, existing_vm_ip: data.ociConfig.existing_vm_ip }));
      }
      if (data.ociConfig) {
        setOciConfig(data.ociConfig);
      }
      if (data.sshPrivateKey) setSshPrivateKey(data.sshPrivateKey);
      if (data.cfApiToken) setCfApiToken(data.cfApiToken);
      if (data.cfZoneId) setCfZoneId(data.cfZoneId);
      if (data.deployConfig) setDeployConfig(data.deployConfig);
      addLog('[Profile Loaded] Successfully loaded settings from ~/.cloudpress/profile.json');
      alert('Saved profile loaded successfully!');
    } catch (err) {
      alert(`Failed to load profile: ${err}`);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all form fields back to blank defaults?')) {
      setStages(INITIAL_STAGES);
      setLogs([]);
      setActiveStep(1);
      setVmDeleted(false);
      addLog('[Reset] Form fields reset to default.');
    }
  };

  const [existingDnsModal, setExistingDnsModal] = useState<{
    records: CloudflareRecord[];
    domain: string;
  } | null>(null);
  const [isCheckingDns, setIsCheckingDns] = useState(false);

  // Launch Deployment
  const handleStartDeploy = async (forceOverwrite?: boolean) => {
    // If user has not yet confirmed the prompt, check Cloudflare DNS first
    if (forceOverwrite === undefined && cfApiToken.trim()) {
      try {
        setIsCheckingDns(true);
        const cleanDomain = deployConfig.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        let zoneId = cfZoneId.trim();
        if (!zoneId) {
          zoneId = await invoke<string>('fetch_zone_id', {
            apiToken: cfApiToken.trim(),
            domain: cleanDomain,
          });
        }
        if (zoneId) {
          const records = await invoke<CloudflareRecord[]>('check_existing_dns', {
            apiToken: cfApiToken.trim(),
            zoneId,
            domain: cleanDomain,
          });
          if (records && records.length > 0) {
            setExistingDnsModal({ records, domain: cleanDomain });
            setIsCheckingDns(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Could not pre-check existing Cloudflare DNS records:', e);
      } finally {
        setIsCheckingDns(false);
      }
    }

    try {
      setIsDeploying(true);
      setDeployError(null);
      setExistingDnsModal(null);
      setVmDeleted(false);
      setActiveStep(5); // Switch view to Launch status screen
      setStages(INITIAL_STAGES.map(s => ({ ...s, status: 'idle' })));

      const payload: FullDeployPayload = {
        gcp: gcpConfig,
        cloudflare_api_token: cfApiToken,
        cloudflare_zone_id: cfZoneId,
        deploy: deployConfig,
        ssh_private_key: sshPrivateKey,
        overwrite_dns: forceOverwrite !== undefined ? forceOverwrite : true,
      };

      const result = await invoke<string>('deploy_full_stack', { payload });
      addLog(`[COMPLETED] ${result}`);
    } catch (err) {
      const errorStr = String(err);
      setDeployError(errorStr);
      addLog(`[DEPLOYMENT ERROR] ${errorStr}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCancelDeploy = async () => {
    try {
      await invoke('cancel_deployment');
      addLog('[Cancellation] Stopping deployment process...');
    } catch (err) {
      console.error('Failed to cancel deployment:', err);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDeleteVm = async () => {
    try {
      setIsDeletingVm(true);
      setIsTerminalOpen(true);
      addLog('[GCP] User initiated CloudPress Google Cloud VM teardown & deletion...');
      const res = await invoke<string>('delete_cloudpress_vm', { gcp: gcpConfig });
      addLog(`[GCP Success] ${res}`);
      setVmDeleted(true);
    } catch (err) {
      const errorStr = String(err);
      addLog(`[GCP ERROR] Failed to delete VM: ${errorStr}`);
      alert(`Failed to delete VM: ${errorStr}`);
    } finally {
      setIsDeletingVm(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-background text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200 transition-[padding-bottom] duration-300 ease-in-out"
      style={{ paddingBottom: terminalBottomPadding }}
    >
      <Header
        onSaveProfile={handleSaveProfile}
        onLoadProfile={handleLoadProfile}
        onReset={handleReset}
        isDeploying={isDeploying}
        currentStep={activeStep}
        totalSteps={5}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Step-by-Step Progress Bar (Process Stepper) */}
        <nav aria-label="Deployment Process Steps" className="bg-surface/90 border border-surface-border rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = activeStep === step.id;
              const isPast = activeStep > step.id;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => !isDeploying && setActiveStep(step.id)}
                  disabled={isDeploying}
                  className={`relative p-3 rounded-xl border text-left transition-all flex items-start gap-3 select-none ${
                    isActive
                      ? 'bg-surface-lighter border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                      : isPast
                      ? 'bg-surface-lighter/40 border-emerald-500/30 hover:bg-surface-lighter/70'
                      : 'bg-surface/50 border-surface-border/50 hover:bg-surface-lighter/40'
                  }`}
                >
                  {/* Step Icon or Completed Check */}
                  <div className="mt-0.5">
                    {isPast ? (
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                            : 'bg-surface border border-surface-border text-slate-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  {/* Step Labels */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                        Step {step.id}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">
                      {step.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate hidden md:block">
                      {step.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Step Content View */}
        <div className="transition-all duration-300">
          {activeStep === 1 && (
            <Step1Website
              config={deployConfig}
              onChangeConfig={setDeployConfig}
              onNext={() => setActiveStep(2)}
            />
          )}

          {activeStep === 2 && (
            <Step2Server
              config={gcpConfig}
              sshPrivateKey={sshPrivateKey}
              onChangeGcp={setGcpConfig}
              onChangeSshKey={setSshPrivateKey}
              onNext={() => setActiveStep(3)}
              onBack={() => setActiveStep(1)}
              onLog={addLog}
            />
          )}

          {activeStep === 3 && (
            <Step3Domain
              domain={deployConfig.domain}
              apiToken={cfApiToken}
              zoneId={cfZoneId}
              smtpRelayHost={deployConfig.smtp_relay_host}
              onChangeApiToken={setCfApiToken}
              onChangeZoneId={setCfZoneId}
              onNext={() => setActiveStep(4)}
              onBack={() => setActiveStep(2)}
              onLog={addLog}
            />
          )}

          {activeStep === 4 && (
            <Step4Email
              config={deployConfig}
              onChangeConfig={setDeployConfig}
              onNext={() => setActiveStep(5)}
              onBack={() => setActiveStep(3)}
            />
          )}

          {activeStep === 5 && (
            <Step5Launch
              deployConfig={deployConfig}
              gcpConfig={gcpConfig}
              ociConfig={ociConfig}
              stages={stages}
              currentStage={currentStageNumber}
              isDeploying={isDeploying}
              deployError={deployError}
              isCheckingDns={isCheckingDns}
              onStartDeploy={() => handleStartDeploy()}
              onCancelDeploy={handleCancelDeploy}
              onOpenTerminal={() => setIsTerminalOpen(true)}
              onBack={() => setActiveStep(4)}
              onJumpToStep={step => setActiveStep(step)}
              onDeleteVm={handleDeleteVm}
              isDeletingVm={isDeletingVm}
              vmDeleted={vmDeleted}
            />
          )}
        </div>
      </main>

      {/* Existing DNS Records Confirmation Modal */}
      {existingDnsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 border-b border-surface-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Existing DNS Records Detected
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cloudflare already has active records for <span className="font-semibold text-amber-300 font-mono">{existingDnsModal.domain}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExistingDnsModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-lighter transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-300">
                The following records were found in your Cloudflare DNS zone:
              </p>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-surface-border bg-surface-lighter/60 p-2 space-y-1.5 font-mono text-xs">
                {existingDnsModal.records.map((rec, i) => (
                  <div key={rec.id || i} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-surface/50 border border-surface-border/50">
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                        {rec.type}
                      </span>
                      <span className="text-slate-200 truncate">{rec.name}</span>
                    </div>
                    <span className="text-slate-400 truncate max-w-[200px]" title={rec.content}>
                      {rec.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Do you want CloudPress to automatically update these DNS records with your new WordPress server IP, or preserve your existing DNS settings?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setExistingDnsModal(null)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-surface-lighter border border-transparent rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStartDeploy(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-surface-lighter hover:bg-surface-border border border-surface-border rounded-xl transition-all shadow-sm"
              >
                Keep Existing Records
              </button>
              <button
                type="button"
                onClick={() => handleStartDeploy(true)}
                className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Yes, Update DNS Records</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dockable Live Terminal & Status Bar */}
      <Terminal
        logs={logs}
        isOpen={isTerminalOpen}
        onToggleOpen={() => setIsTerminalOpen(!isTerminalOpen)}
        onClearLogs={() => setLogs([])}
        isExpanded={isTerminalExpanded}
        onToggleExpanded={() => setIsTerminalExpanded(!isTerminalExpanded)}
      />
    </div>
  );
};

export default App;
