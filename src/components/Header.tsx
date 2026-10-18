import React from 'react';
import { Sparkles, Download, Save, RefreshCw, Shield, Zap } from 'lucide-react';

interface HeaderProps {
  onSaveProfile: () => void;
  onLoadProfile: () => void;
  onReset: () => void;
  isDeploying: boolean;
  currentStep: number;
  totalSteps: number;
}

export const Header: React.FC<HeaderProps> = ({
  onSaveProfile,
  onLoadProfile,
  onReset,
  isDeploying,
  currentStep,
  totalSteps,
}) => {
  return (
    <header className="border-b border-surface-border bg-surface/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-primary-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-surface rounded-[15px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse-subtle" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                CloudPress
              </h1>
              <span className="text-[10px] font-semibold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
                Zero-Cost Cloud Wizard
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Deploy WordPress &amp; Custom Mail on Oracle Cloud Always Free in 5 simple steps
            </p>
          </div>
        </div>

        {/* Center Progress Tag (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-lighter/80 border border-surface-border text-xs text-slate-300">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Progress: Step {currentStep} of {totalSteps}</span>
          <span className="text-slate-600">|</span>
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>No Coding Required</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSaveProfile}
            disabled={isDeploying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-surface-lighter hover:bg-surface-border border border-surface-border rounded-xl transition-all shadow-sm disabled:opacity-40"
            title="Save your form answers to re-use anytime"
          >
            <Save className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Save Progress</span>
          </button>

          <button
            type="button"
            onClick={onLoadProfile}
            disabled={isDeploying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-surface-lighter hover:bg-surface-border border border-surface-border rounded-xl transition-all shadow-sm disabled:opacity-40"
            title="Load your saved settings"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Load Saved</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            disabled={isDeploying}
            className="p-2 text-slate-400 hover:text-rose-300 hover:bg-surface-lighter rounded-xl border border-transparent hover:border-surface-border transition-colors disabled:opacity-40"
            title="Reset form fields to blank defaults"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
