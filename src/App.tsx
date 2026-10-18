import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Step1Oci } from './components/Step1Oci';
import { Step2Cloudflare } from './components/Step2Cloudflare';
import { Step3AppConfig } from './components/Step3AppConfig';
import { Step4Deploy } from './components/Step4Deploy';
import { Terminal } from './components/Terminal';
import type {
  OciConfig,
  DeployConfig,
  FullDeployPayload,
  StageProgress,
  LogMessage,
} from './types';
import {
  Server,
  Cloud,
  Settings,
  Rocket,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const INITIAL_STAGES: StageProgress[] = [
  {
    stage: 1,
    stage_name: 'Provisioning OCI Arm64 VM & Security Ports',
    status: 'idle',
    message: 'Allocates VM.Standard.A1.Flex (4 OCPUs, 24GB RAM) on Oracle Always Free.',
  },
  {
    stage: 2,
    stage_name: 'Configuring Initial Cloudflare DNS',
    status: 'idle',
    message: 'Upserts A records for @, www, mail and sets MX & SPF/DMARC policies.',
  },
  {
    stage: 3,
    stage_name: 'Bootstrapping Server via SSH',
    status: 'idle',
    message: 'Configures 2GB swapfile, opens OS firewall iptables, installs Docker Engine.',
  },
  {
    stage: 4,
    stage_name: 'Deploying Docker Compose Stack',
    status: 'idle',
    message: 'Starts Caddy 2, WordPress FPM, MariaDB 11, and Docker-Mailserver.',
  },
  {
    stage: 5,
    stage_name: 'Extracting OpenDKIM & Pushing DNS',
    status: 'idle',
    message: 'Generates DKIM keys in container and pushes mail._domainkey to Cloudflare.',
  },
  {
    stage: 6,
    stage_name: 'Finalizing WordPress Installation & SMTP',
    status: 'idle',
    message: 'Runs wp core install and activates lightweight SMTP MU-Plugin.',
  },
];

export const App: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [currentStageNumber, setCurrentStageNumber] = useState<number>(1);
  const [stages, setStages] = useState<StageProgress[]>(INITIAL_STAGES);

  // Terminal State
  const [logs, setLogs] = useState<LogMessage[]>([
    {
      id: 'init',
      timestamp: '00:00:00',
      text: '[CloudPress Initialized] Welcome. Configure your credentials to deploy.',
      type: 'info',
    },
  ]);
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(true);

  // Form State
  const [ociConfig, setOciConfig] = useState<OciConfig>({
    tenancy_ocid: '',
    user_ocid: '',
    compartment_ocid: '',
    region: 'eu-milan-1',
    fingerprint: '',
    private_key_path: '',
    shape: 'VM.Standard.A1.Flex',
    ocpus: 4,
    memory_in_gbs: 24,
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
    wp_site_title: 'My Cloud WordPress',
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
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
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
      ociConfig,
      sshPrivateKey,
      cfApiToken,
      cfZoneId,
      deployConfig,
    };
    try {
      await invoke('save_profile', { profileJson: JSON.stringify(profile, null, 2) });
      addLog('[Profile Saved] Configuration saved locally to ~/.cloudpress/profile.json');
      alert('Profile saved successfully!');
    } catch (err) {
      alert(`Failed to save profile: ${err}`);
    }
  };

  const handleLoadProfile = async () => {
    try {
      const dataStr = await invoke<string>('load_profile');
      const data = JSON.parse(dataStr);
      if (data.ociConfig) setOciConfig(data.ociConfig);
      if (data.sshPrivateKey) setSshPrivateKey(data.sshPrivateKey);
      if (data.cfApiToken) setCfApiToken(data.cfApiToken);
      if (data.cfZoneId) setCfZoneId(data.cfZoneId);
      if (data.deployConfig) setDeployConfig(data.deployConfig);
      addLog('[Profile Loaded] Successfully loaded settings from ~/.cloudpress/profile.json');
      alert('Profile loaded successfully!');
    } catch (err) {
      alert(`Failed to load profile: ${err}`);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all form fields to default?')) {
      setStages(INITIAL_STAGES);
      setLogs([]);
      addLog('[Reset] Form fields reset to defaults.');
    }
  };

  // Launch Deployment
  const handleStartDeploy = async () => {
    try {
      setIsDeploying(true);
      setDeployError(null);
      setIsTerminalOpen(true);
      setStages(INITIAL_STAGES.map(s => ({ ...s, status: 'idle' })));

      const payload: FullDeployPayload = {
        oci: ociConfig,
        cloudflare_api_token: cfApiToken,
        cloudflare_zone_id: cfZoneId,
        deploy: deployConfig,
        ssh_private_key: sshPrivateKey,
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

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans pb-40">
      <Header
        onSaveProfile={handleSaveProfile}
        onLoadProfile={handleLoadProfile}
        onReset={handleReset}
        isDeploying={isDeploying}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Step Navigation Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeStep === 1
                ? 'bg-surface-lighter border-indigo-500 shadow-md shadow-indigo-500/10'
                : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Step 1</span>
              <Server className={`w-4 h-4 ${activeStep === 1 ? 'text-indigo-400' : 'text-slate-500'}`} />
            </div>
            <div className="text-xs font-semibold text-white">Oracle Arm64 &amp; SSH</div>
            <div className="text-[11px] text-slate-400 truncate">VM.Standard.A1.Flex</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeStep === 2
                ? 'bg-surface-lighter border-cyan-500 shadow-md shadow-cyan-500/10'
                : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Step 2</span>
              <Cloud className={`w-4 h-4 ${activeStep === 2 ? 'text-cyan-400' : 'text-slate-500'}`} />
            </div>
            <div className="text-xs font-semibold text-white">Domain &amp; Cloudflare</div>
            <div className="text-[11px] text-slate-400 truncate">Automated DNS v4</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeStep === 3
                ? 'bg-surface-lighter border-emerald-500 shadow-md shadow-emerald-500/10'
                : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Step 3</span>
              <Settings className={`w-4 h-4 ${activeStep === 3 ? 'text-emerald-400' : 'text-slate-500'}`} />
            </div>
            <div className="text-xs font-semibold text-white">WordPress &amp; Mail</div>
            <div className="text-[11px] text-slate-400 truncate">Admin &amp; Port 587 Relay</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(4)}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeStep === 4
                ? 'bg-surface-lighter border-primary-500 shadow-md shadow-primary-500/10'
                : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Step 4</span>
              <Rocket className={`w-4 h-4 ${activeStep === 4 ? 'text-primary-400' : 'text-slate-500'}`} />
            </div>
            <div className="text-xs font-semibold text-white">Deploy &amp; Live Status</div>
            <div className="text-[11px] text-slate-400 truncate">6-Stage Orchestration</div>
          </button>
        </div>

        {/* Step Content */}
        <div className="transition-all duration-200">
          {activeStep === 1 && (
            <Step1Oci
              config={ociConfig}
              sshPrivateKey={sshPrivateKey}
              onChangeOci={setOciConfig}
              onChangeSshKey={setSshPrivateKey}
              onLog={addLog}
            />
          )}

          {activeStep === 2 && (
            <Step2Cloudflare
              domain={deployConfig.domain}
              apiToken={cfApiToken}
              zoneId={cfZoneId}
              smtpRelayHost={deployConfig.smtp_relay_host}
              onChangeDomain={d => {
                setDeployConfig(prev => ({
                  ...prev,
                  domain: d,
                  wp_admin_email: `admin@${d}`,
                  mail_account: `admin@${d}`,
                }));
              }}
              onChangeApiToken={setCfApiToken}
              onChangeZoneId={setCfZoneId}
              onLog={addLog}
            />
          )}

          {activeStep === 3 && (
            <Step3AppConfig
              config={deployConfig}
              onChangeConfig={setDeployConfig}
            />
          )}

          {activeStep === 4 && (
            <Step4Deploy
              deployConfig={deployConfig}
              stages={stages}
              currentStage={currentStageNumber}
              isDeploying={isDeploying}
              deployError={deployError}
              onStartDeploy={handleStartDeploy}
              onOpenTerminal={() => setIsTerminalOpen(true)}
            />
          )}
        </div>

        {/* Bottom Navigation Controls */}
        <div className="mt-8 pt-4 border-t border-surface-border flex items-center justify-between">
          <button
            type="button"
            disabled={activeStep === 1 || isDeploying}
            onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-surface-lighter hover:bg-surface-border border border-surface-border rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Step</span>
          </button>

          <div className="text-xs text-slate-500 font-mono">
            Step {activeStep} of 4
          </div>

          {activeStep < 4 ? (
            <button
              type="button"
              disabled={isDeploying}
              onClick={() => setActiveStep(prev => Math.min(4, prev + 1))}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-40"
            >
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isDeploying}
              onClick={handleStartDeploy}
              className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-40"
            >
              <Rocket className="w-4 h-4" />
              <span>Launch Stack</span>
            </button>
          )}
        </div>
      </main>

      {/* Persistent Collapsible Live Terminal */}
      <Terminal
        logs={logs}
        isOpen={isTerminalOpen}
        onToggleOpen={() => setIsTerminalOpen(!isTerminalOpen)}
        onClearLogs={() => setLogs([])}
      />
    </div>
  );
};

export default App;
