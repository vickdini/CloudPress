import React from 'react';
import { Server, Cloud, ShieldCheck, Download, Save, RefreshCw, Sparkles } from 'lucide-react';

interface HeaderProps {
  onSaveProfile: () => void;
  onLoadProfile: () => void;
  onReset: () => void;
  isDeploying: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onSaveProfile,
  onLoadProfile,
  onReset,
  isDeploying,
}) => {
  return (
    <header className="border-b border-surface-border bg-surface/70 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-primary-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-surface rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse-subtle" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                CloudPress <span className="text-indigo-400 font-medium text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">Arm64 Always-Free</span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Automated zero-cost WordPress &amp; Mail Server orchestration on Oracle Cloud + Cloudflare
            </p>
          </div>
        </div>

        {/* Feature Badges & Quick Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-lighter/60 border border-surface-border text-xs text-slate-300">
            <Server className="w-3.5 h-3.5 text-amber-400" />
            <span>Ampere 4 OCPU / 24GB</span>
            <span className="text-slate-600">|</span>
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cloudflare DNS v4</span>
            <span className="text-slate-600">|</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Caddy Let's Encrypt</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSaveProfile}
              disabled={isDeploying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-surface-lighter hover:bg-surface-border border border-surface-border rounded-lg transition-colors shadow-sm disabled:opacity-50"
              title="Save current form values to ~/.cloudpress/profile.json"
            >
              <Save className="w-3.5 h-3.5 text-indigo-400" />
              <span>Save Profile</span>
            </button>

            <button
              onClick={onLoadProfile}
              disabled={isDeploying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-surface-lighter hover:bg-surface-border border border-surface-border rounded-lg transition-colors shadow-sm disabled:opacity-50"
              title="Load saved profile configuration"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Load Profile</span>
            </button>

            <button
              onClick={onReset}
              disabled={isDeploying}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-surface-lighter rounded-lg border border-transparent hover:border-surface-border transition-colors disabled:opacity-50"
              title="Reset form fields"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
