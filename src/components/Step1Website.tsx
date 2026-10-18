import React, { useState } from 'react';
import type { DeployConfig } from '../types';
import {
  Globe,
  Sparkles,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface Step1WebsiteProps {
  config: DeployConfig;
  onChangeConfig: (updater: (prev: DeployConfig) => DeployConfig) => void;
  onNext: () => void;
}

export const Step1Website: React.FC<Step1WebsiteProps> = ({
  config,
  onChangeConfig,
  onNext,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onChangeConfig(prev => ({ ...prev, wp_admin_password: pass }));
  };

  const handleDomainChange = (raw: string) => {
    // Automatically sanitize domain input for non-technical users
    const clean = raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '');

    onChangeConfig(prev => ({
      ...prev,
      domain: clean,
      wp_admin_email: prev.wp_admin_email.includes('@') && !prev.wp_admin_email.startsWith('admin@')
        ? prev.wp_admin_email
        : `admin@${clean || 'example.com'}`,
      mail_account: prev.mail_account.includes('@') && !prev.mail_account.startsWith('admin@')
        ? prev.mail_account
        : `admin@${clean || 'example.com'}`,
    }));
  };

  const isFormValid =
    config.wp_site_title.trim().length > 0 &&
    config.domain.trim().length > 0 &&
    config.wp_admin_user.trim().length > 0 &&
    config.wp_admin_password.trim().length >= 6;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Intro Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/40 via-surface to-surface-lighter/50 border border-indigo-500/20 p-6 md:p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Step 1 of 5: Website Basics</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Tell us about your website
          </h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Let's start with the fun part! Pick a name for your website, enter the domain name you own, and create your WordPress administrator login.
          </p>
        </div>
      </div>

      {/* Main Form Box */}
      <div className="bg-surface/80 border border-surface-border rounded-2xl p-6 md:p-8 space-y-6 backdrop-blur-sm shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Website Title */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              Website Title
            </label>
            <input
              type="text"
              placeholder="e.g. Acme Studio or Sarah's Blog"
              value={config.wp_site_title}
              onChange={e => onChangeConfig(prev => ({ ...prev, wp_site_title: e.target.value }))}
              className="w-full px-4 py-3 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <p className="text-xs text-slate-400">
              This will be displayed at the top of your website and in search results.
            </p>
          </div>

          {/* Domain Name */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                Domain Name
              </label>
              <button
                type="button"
                onClick={() => setShowDomainHelp(!showDomainHelp)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>What is this?</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="e.g. mybusiness.com"
              value={config.domain}
              onChange={e => handleDomainChange(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
            <p className="text-xs text-slate-400">
              Enter your domain without <code className="text-cyan-300 font-mono">https://</code> or <code className="text-cyan-300 font-mono">www</code>.
            </p>
          </div>
        </div>

        {/* Domain Helper Accordion */}
        {showDomainHelp && (
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-slate-300 space-y-2 animate-in fade-in duration-200">
            <div className="font-semibold text-cyan-200 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              What is a domain name?
            </div>
            <p>
              A domain name is your website's internet address (like <code className="text-cyan-300 font-mono">google.com</code> or <code className="text-cyan-300 font-mono">yourname.com</code>).
              You can purchase one for a few dollars per year from providers like Namecheap, Porkbun, or Cloudflare Registrar.
            </p>
            <p className="text-slate-400">
              In Step 3, CloudPress will automatically connect this domain to your free cloud server!
            </p>
          </div>
        )}

        {/* Separator */}
        <div className="border-t border-surface-border/60 pt-6">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            WordPress Administrator Login
          </h3>
          <p className="text-xs text-slate-400 mb-5">
            You will use these credentials to log into your WordPress admin dashboard once it's created.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Admin User */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Admin Username
              </label>
              <input
                type="text"
                placeholder="admin"
                value={config.wp_admin_user}
                onChange={e => onChangeConfig(prev => ({ ...prev, wp_admin_user: e.target.value }))}
                className="w-full px-4 py-2.5 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Admin Email */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Notification Email
              </label>
              <input
                type="email"
                placeholder={`admin@${config.domain || 'example.com'}`}
                value={config.wp_admin_email}
                onChange={e => onChangeConfig(prev => ({ ...prev, wp_admin_email: e.target.value }))}
                className="w-full px-4 py-2.5 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Admin Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Admin Password
                </label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Suggest Strong</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.wp_admin_password}
                  onChange={e => onChangeConfig(prev => ({ ...prev, wp_admin_password: e.target.value }))}
                  className="w-full px-4 py-2.5 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 pr-10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Guidance */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-surface-border/40">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {isFormValid ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Great! Everything on this step looks complete.
              </span>
            ) : (
              <span>Please fill in your site title, domain, and password to continue.</span>
            )}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={!isFormValid}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
          >
            <span>Next: Set Up Free Server</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
