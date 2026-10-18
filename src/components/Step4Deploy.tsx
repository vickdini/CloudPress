import React, { useEffect, useState } from 'react';
import type { StageProgress, DeployConfig } from '../types';
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
} from 'lucide-react';

interface Step4Props {
  deployConfig: DeployConfig;
  stages: StageProgress[];
  currentStage: number;
  isDeploying: boolean;
  deployError: string | null;
  onStartDeploy: () => void;
  onOpenTerminal: () => void;
}

export const Step4Deploy: React.FC<Step4Props> = ({
  deployConfig,
  stages,
  currentStage,
  isDeploying,
  deployError,
  onStartDeploy,
  onOpenTerminal,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  return (
    <div className="space-y-6">
      {/* Launch Control Header Card */}
      <div className="bg-gradient-to-r from-surface-lighter/80 via-surface/60 to-surface-lighter/80 border border-surface-border rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                Stage 4: Execution Engine
              </span>
              {isDeploying && (
                <span className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  Elapsed: {formatElapsed(elapsedSeconds)}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-2">
              Automated Cloud Deployment Pipeline
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Deploys your WordPress site and email stack on Oracle Arm64, verifies TLS certificates with Caddy, and syncs Cloudflare DNS records in 6 autonomous stages.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {!isDeploying && !isCompleted ? (
              <button
                type="button"
                onClick={onStartDeploy}
                className="w-full md:w-auto px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 via-primary-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Rocket className="w-4 h-4" />
                <span>Deploy Zero-Cost Stack Now</span>
              </button>
            ) : isDeploying ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled
                  className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-indigo-600/70 cursor-wait flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                  <Rocket className="w-4 h-4 animate-bounce text-cyan-300" />
                  <span>Deploying Stack (Stage {currentStage}/6)...</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenTerminal}
                  className="px-4 py-3 rounded-xl text-xs font-medium text-slate-300 bg-surface-lighter hover:bg-surface-border border border-surface-border flex items-center gap-2 transition-colors"
                >
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>View Logs</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onStartDeploy}
                className="w-full md:w-auto px-6 py-3 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Re-Deploy / Update Stack</span>
              </button>
            )}
          </div>
        </div>

        {deployError && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-200">Deployment Error Encountered:</div>
              <div className="mt-1 font-mono text-[11px] whitespace-pre-wrap">{deployError}</div>
              <div className="mt-2 text-rose-400/80">
                Check the Live Terminal Logs below for detailed diagnostic messages.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6-Stage Progress Stepper */}
      <div className="bg-surface-lighter/30 border border-surface-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center justify-between">
          <span>Deployment Stages &amp; Health</span>
          <span className="text-xs text-slate-400 font-mono">
            {stages.filter(s => s.status === 'completed').length} / {stages.length} Completed
          </span>
        </h3>

        <div className="space-y-3">
          {stages.map((stageItem) => {
            const isCurrent = stageItem.status === 'running';
            const isDone = stageItem.status === 'completed';
            const isErr = stageItem.status === 'error';

            return (
              <div
                key={stageItem.stage}
                className={`p-4 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-indigo-950/20 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                    : isDone
                    ? 'bg-surface/50 border-emerald-500/20'
                    : isErr
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : 'bg-surface/30 border-surface-border/40 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    {/* Stage Number / Status Icon */}
                    <div className="mt-0.5">
                      {isDone ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : isCurrent ? (
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500 flex items-center justify-center text-indigo-400 animate-pulse">
                          <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                        </div>
                      ) : isErr ? (
                        <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-surface-border/50 border border-surface-border flex items-center justify-center text-slate-500 text-xs font-mono font-bold">
                          {stageItem.stage}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                        <span>{stageItem.stage_name}</span>
                        {isCurrent && (
                          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.2 rounded border border-cyan-500/20 animate-pulse">
                            In Progress
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {stageItem.message}
                      </div>
                    </div>
                  </div>

                  {/* Stage Status Pill */}
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

      {/* Deployment Completion / Success Card */}
      {isCompleted && (
        <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Stack Successfully Deployed &amp; Verified!
              </h3>
              <p className="text-xs text-emerald-300/80">
                Your WordPress site and Mail Server are operational with automated SSL certificates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WordPress Access */}
            <div className="p-4 bg-surface rounded-xl border border-surface-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  WordPress Site &amp; Admin
                </span>
                <a
                  href={`https://${deployConfig.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                >
                  <span>Visit Site</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-surface-border/40">
                  <span className="text-slate-400">Home URL:</span>
                  <span className="text-white font-mono">https://{deployConfig.domain}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-border/40">
                  <span className="text-slate-400">Admin Dashboard:</span>
                  <span className="text-indigo-400 font-mono">https://{deployConfig.domain}/wp-admin</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-border/40">
                  <span className="text-slate-400">Admin User:</span>
                  <span className="text-white font-mono">{deployConfig.wp_admin_user}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Admin Email:</span>
                  <span className="text-white font-mono">{deployConfig.wp_admin_email}</span>
                </div>
              </div>
            </div>

            {/* Email Server Access */}
            <div className="p-4 bg-surface rounded-xl border border-surface-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  Email Server Connection
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Active (DKIM + SPF)
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-surface-border/40">
                  <span className="text-slate-400">Mailbox Address:</span>
                  <span className="text-white font-mono">{deployConfig.mail_account}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-border/40">
                  <span className="text-slate-400">Incoming IMAP:</span>
                  <span className="text-emerald-400 font-mono">mail.{deployConfig.domain} : 993 (SSL)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-border/40">
                  <span className="text-slate-400">Outgoing SMTP:</span>
                  <span className="text-emerald-400 font-mono">mail.{deployConfig.domain} : 587 (STARTTLS)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Webmail / WP Mail:</span>
                  <span className="text-slate-300">Auto-configured via MU-Plugin</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
