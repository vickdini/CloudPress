import React, { useEffect, useState } from 'react';
import type { StageProgress, DeployConfig, GcpConfig, OciConfig } from '../types';
import {
  Rocket,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Globe,
  Mail,
  Server,
  Cloud,
  ArrowLeft,
  Copy,
  Check,
  Edit2,
  Sparkles,
  XCircle,
} from 'lucide-react';

interface Step5LaunchProps {
  deployConfig: DeployConfig;
  gcpConfig?: GcpConfig;
  ociConfig?: OciConfig;
  stages: StageProgress[];
  currentStage: number;
  isDeploying: boolean;
  deployError: string | null;
  onStartDeploy: () => void;
  onCancelDeploy: () => void;
  onOpenTerminal: () => void;
  onBack: () => void;
  onJumpToStep: (step: number) => void;
}

const FRIENDLY_STAGE_INFO: Record<number, { title: string; desc: string }> = {
  1: {
    title: 'Allocating Free Cloud Server',
    desc: 'Connecting to Google Cloud to provision your Always Free e2-micro instance (30 GB disk, us-central1/west1/east1) and configure security firewalls.',
  },
  2: {
    title: 'Connecting Domain & DNS Security',
    desc: 'Creating web routing records, setting up MX email routes, and configuring anti-spam policies on Cloudflare.',
  },
  3: {
    title: 'Preparing Server & Installing Software',
    desc: 'Securing the operating system, establishing swap space, and installing Docker Engine via automated SSH.',
  },
  4: {
    title: 'Launching WordPress & Email Containers',
    desc: 'Starting Caddy 2 web server, WordPress, MariaDB database, and the Docker-Mailserver container stack.',
  },
  5: {
    title: 'Generating Email Security Signatures (DKIM)',
    desc: 'Generating cryptographic anti-tamper email keys inside your mail container and syncing them to Cloudflare.',
  },
  6: {
    title: 'Finalizing WordPress Setup',
    desc: 'Running automated WordPress installation, provisioning SSL certificates, and activating the email delivery plugin.',
  },
};

export const Step5Launch: React.FC<Step5LaunchProps> = ({
  deployConfig,
  gcpConfig,
  ociConfig,
  stages,
  currentStage,
  isDeploying,
  deployError,
  onStartDeploy,
  onCancelDeploy,
  onOpenTerminal,
  onBack,
  onJumpToStep,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copiedInfo, setCopiedInfo] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isDeploying) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isDeploying]);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}m ${remaining < 10 ? '0' : ''}${remaining}s`;
  };

  const isCompleted = stages.length > 0 && stages.every(s => s.status === 'completed');
  const completedStagesCount = stages.filter(s => s.status === 'completed').length;
  const progressPercent = Math.round((completedStagesCount / Math.max(1, stages.length)) * 100);

  const handleCopyCredentials = () => {
    const text = `CloudPress Deployment Summary
----------------------------------------
Website Title:   ${deployConfig.wp_site_title}
Website URL:     https://${deployConfig.domain}
Admin Login:     https://${deployConfig.domain}/wp-admin
Admin Username:  ${deployConfig.wp_admin_user}
Admin Password:  ${deployConfig.wp_admin_password}

Mailbox Account: ${deployConfig.mail_account}
Mailbox Pass:    ${deployConfig.mail_password}
IMAP (Incoming): mail.${deployConfig.domain}:993 (SSL)
SMTP (Outgoing): mail.${deployConfig.domain}:587 (STARTTLS)
----------------------------------------`;

    navigator.clipboard.writeText(text);
    setCopiedInfo(true);
    setTimeout(() => setCopiedInfo(false), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Intro Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/40 via-surface to-surface-lighter/50 border border-indigo-500/20 p-6 md:p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
              <Rocket className="w-3.5 h-3.5 text-indigo-400" />
              <span>Step 5 of 5: Review &amp; Launch</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isCompleted
                ? 'Your Website & Email Stack is Live!'
                : isDeploying
                ? 'Building Your Free Cloud Website...'
                : 'Ready to Launch Your Free Cloud Stack'}
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              {isCompleted
                ? 'All cloud resources, SSL certificates, WordPress core files, and custom mailboxes have been deployed and verified successfully.'
                : isDeploying
                ? 'Please keep this window open while CloudPress provisions your cloud server, installs WordPress, and sets up your email server.'
                : 'Review your configuration below. When you are ready, click the Launch button to begin automated zero-cost deployment.'}
            </p>
          </div>

          {isDeploying && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <div className="px-4 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-center">
                <div className="text-xs uppercase font-semibold tracking-wider flex items-center gap-1.5 justify-center">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Elapsed Time</span>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {formatElapsed(elapsedSeconds)}
                </div>
                <div className="text-[11px] text-cyan-400">Step {currentStage} of 6</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to stop the deployment process?')) {
                    onCancelDeploy();
                  }
                }}
                className="px-4 py-3 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-500 border border-rose-500/50 shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                title="Stop and cancel the active deployment"
              >
                <XCircle className="w-4 h-4 text-white" />
                <span>Cancel Process</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS / CELEBRATION VIEW */}
      {isCompleted && (
        <div className="bg-gradient-to-br from-emerald-950/40 via-surface to-surface-lighter/60 border border-emerald-500/40 rounded-2xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-500/30 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Congratulations! Your Website is Ready!
                </h3>
                <p className="text-xs text-emerald-300/90 mt-1">
                  WordPress is installed with Let's Encrypt SSL, MariaDB database, and active email routing.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyCredentials}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
            >
              {copiedInfo ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedInfo ? 'Copied to Clipboard!' : 'Copy All Login Info'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* WordPress Card */}
            <div className="p-5 bg-surface rounded-xl border border-surface-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span>WordPress Website &amp; Admin</span>
                </div>
                <a
                  href={`https://${deployConfig.domain}/wp-admin`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 text-xs font-semibold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded-lg flex items-center gap-1 transition-all"
                >
                  <span>Open Admin</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-surface-border/40">
                  <span className="text-slate-400">Website URL:</span>
                  <a
                    href={`https://${deployConfig.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white hover:text-indigo-300 font-mono flex items-center gap-1"
                  >
                    https://{deployConfig.domain}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex justify-between py-1.5 border-b border-surface-border/40">
                  <span className="text-slate-400">Admin Username:</span>
                  <span className="text-white font-mono font-semibold">{deployConfig.wp_admin_user}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-surface-border/40">
                  <span className="text-slate-400">Admin Password:</span>
                  <span className="text-emerald-400 font-mono font-semibold">{deployConfig.wp_admin_password}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Admin Email:</span>
                  <span className="text-white font-mono">{deployConfig.wp_admin_email}</span>
                </div>
              </div>
            </div>

            {/* Email Card */}
            <div className="p-5 bg-surface rounded-xl border border-surface-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>Email Server Connection</span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                  DKIM &amp; SPF Verified
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-surface-border/40">
                  <span className="text-slate-400">Mailbox Address:</span>
                  <span className="text-white font-mono font-semibold">{deployConfig.mail_account}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-surface-border/40">
                  <span className="text-slate-400">Mailbox Password:</span>
                  <span className="text-emerald-400 font-mono font-semibold">{deployConfig.mail_password}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-surface-border/40">
                  <span className="text-slate-400">Incoming IMAP:</span>
                  <span className="text-slate-300 font-mono">mail.{deployConfig.domain}:993 (SSL)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Outgoing SMTP:</span>
                  <span className="text-slate-300 font-mono">mail.{deployConfig.domain}:587 (STARTTLS)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRE-LAUNCH REVIEW CARDS (when not deploying & not finished) */}
      {!isDeploying && !isCompleted && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Website */}
            <div className="p-5 rounded-2xl bg-surface/80 border border-surface-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span>1. Website &amp; Login</span>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToStep(1)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-base font-bold text-white">{deployConfig.wp_site_title || 'Untitled Site'}</div>
                <div className="text-indigo-400 font-mono">https://{deployConfig.domain}</div>
                <div className="text-slate-400">
                  Admin: <span className="text-slate-200 font-mono font-medium">{deployConfig.wp_admin_user}</span> ({deployConfig.wp_admin_email})
                </div>
              </div>
            </div>

            {/* Card 2: Cloud Server */}
            <div className="p-5 rounded-2xl bg-surface/80 border border-surface-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>2. Cloud Computer</span>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToStep(2)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-base font-bold text-white">
                  {gcpConfig?.existing_vm_ip
                    ? `Google Cloud e2-micro (${gcpConfig.existing_vm_ip})`
                    : ociConfig?.existing_vm_ip
                    ? `Existing Server (${ociConfig.existing_vm_ip})`
                    : `Google Cloud e2-micro (${gcpConfig?.region || 'us-central1'})`}
                </div>
                <div className="text-slate-300">
                  Always Free: e2-micro (2 vCPUs burstable, 1 GB RAM + 3 GB CloudPress Swap, 30 GB standard disk) ($0.00 / mo)
                </div>
                <div className="text-slate-400">
                  Security Key: <span className="text-emerald-400 font-medium">Secured with Ed25519 (user: ubuntu)</span>
                </div>
              </div>
            </div>

            {/* Card 3: Domain & Security */}
            <div className="p-5 rounded-2xl bg-surface/80 border border-surface-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Cloud className="w-4 h-4 text-cyan-400" />
                  <span>3. Domain &amp; Security</span>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToStep(3)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-base font-bold text-white">Cloudflare DNS v4</div>
                <div className="text-slate-300">
                  Automated A, MX, SPF, DKIM, and DMARC routes
                </div>
                <div className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Free HTTPS Let's Encrypt SSL enabled</span>
                </div>
              </div>
            </div>

            {/* Card 4: Email */}
            <div className="p-5 rounded-2xl bg-surface/80 border border-surface-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>4. Email &amp; Inboxes</span>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToStep(4)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-base font-bold text-white font-mono">{deployConfig.mail_account}</div>
                <div className="text-slate-300">
                  Unlimited Inbound Storage + Outbound Relay
                </div>
                <div className="text-slate-400">
                  Relay: <span className="text-amber-400 font-mono">{deployConfig.smtp_relay_host}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Big Launch Banner */}
          <div className="p-8 rounded-2xl bg-gradient-to-r from-indigo-600 via-primary-500 to-cyan-500 shadow-xl shadow-indigo-500/20 text-center space-y-4">
            <h3 className="text-2xl font-bold text-white">
              Ready to launch your zero-cost cloud website?
            </h3>
            <p className="text-sm text-indigo-100 max-w-xl mx-auto">
              Click the button below to start the autonomous installer. CloudPress will handle all server provisioning, container deployments, and DNS routing in 6 automated steps.
            </p>
            <button
              type="button"
              onClick={onStartDeploy}
              className="px-8 py-4 rounded-xl text-base font-bold text-indigo-950 bg-white hover:bg-slate-100 shadow-2xl transition-all active:scale-95 inline-flex items-center gap-2.5"
            >
              <Rocket className="w-5 h-5 text-indigo-600" />
              <span>Launch Free WordPress Stack Now</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Alert Box */}
      {deployError && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="font-bold text-rose-200 text-sm">Deployment Error Encountered:</div>
            <div className="font-mono text-xs whitespace-pre-wrap">{deployError}</div>
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenTerminal}
                className="px-3 py-1.5 rounded-lg bg-surface text-slate-200 hover:text-white border border-surface-border flex items-center gap-1.5 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open Diagnostic Logs</span>
              </button>
              <button
                type="button"
                onClick={onStartDeploy}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
              >
                Retry Deployment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6-STAGE PROGRESS STEPPER (During Deployment or After) */}
      {(isDeploying || isCompleted || stages.some(s => s.status !== 'idle')) && (
        <div className="bg-surface/80 border border-surface-border rounded-2xl p-6 md:p-8 space-y-5 backdrop-blur-sm shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-surface-border/60 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Automated Process Timeline</span>
                <span className="text-xs font-mono text-slate-400 font-normal">
                  ({completedStagesCount} of {stages.length} steps complete)
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each step runs autonomously without requiring technical commands.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isDeploying && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to stop the deployment process?')) {
                      onCancelDeploy();
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Stop and cancel the active deployment"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Process</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenTerminal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-surface-lighter hover:bg-surface-border border border-surface-border flex items-center gap-1.5 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>View Technical Logs</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Overall Pipeline Progress</span>
              <span className="font-mono font-bold text-white">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-surface-lighter rounded-full overflow-hidden border border-surface-border/40">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-primary-500 to-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Stage Cards */}
          <div className="space-y-3 pt-2">
            {stages.map(stageItem => {
              const isCurrent = stageItem.status === 'running';
              const isDone = stageItem.status === 'completed';
              const isErr = stageItem.status === 'error';
              const info = FRIENDLY_STAGE_INFO[stageItem.stage] || {
                title: stageItem.stage_name,
                desc: stageItem.message,
              };

              return (
                <div
                  key={stageItem.stage}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-indigo-950/30 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                      : isDone
                      ? 'bg-surface/60 border-emerald-500/20'
                      : isErr
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : 'bg-surface/30 border-surface-border/40 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="mt-0.5">
                        {isDone ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500 flex items-center justify-center text-indigo-400 animate-pulse">
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                          </div>
                        ) : isErr ? (
                          <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-surface-lighter border border-surface-border flex items-center justify-center text-slate-500 text-xs font-mono font-bold">
                            {stageItem.stage}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                          <span>{info.title}</span>
                          {isCurrent && (
                            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.2 rounded border border-cyan-500/20 animate-pulse">
                              In Progress...
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {isCurrent || isDone ? stageItem.message || info.desc : info.desc}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${
                        isDone
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : isCurrent
                          ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                          : isErr
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          : 'text-slate-500 bg-surface border-surface-border'
                      }`}
                    >
                      {stageItem.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Back Button (if not deploying) */}
      {!isDeploying && (
        <div className="pt-2 flex items-center justify-start">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-surface-lighter hover:bg-surface-border border border-surface-border rounded-xl flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back: Email Setup</span>
          </button>
        </div>
      )}
    </div>
  );
};
