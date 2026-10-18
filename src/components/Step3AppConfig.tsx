import React, { useState } from 'react';
import type { DeployConfig } from '../types';
import {
  Globe,
  Mail,
  Send,
  Database,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Step3Props {
  config: DeployConfig;
  onChangeConfig: (updater: (prev: DeployConfig) => DeployConfig) => void;
}

export const Step3AppConfig: React.FC<Step3Props> = ({ config, onChangeConfig }) => {
  const [showWpPass, setShowWpPass] = useState(false);
  const [showMailPass, setShowMailPass] = useState(false);
  const [showAdvancedDb, setShowAdvancedDb] = useState(false);


  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const setRelayPreset = (host: string) => {
    onChangeConfig(prev => ({
      ...prev,
      smtp_relay_host: host,
    }));
  };

  return (
    <div className="space-y-6">
      {/* WordPress Configuration Section */}
      <div className="bg-surface-lighter/30 border border-surface-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              WordPress Core &amp; Admin Account
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated deployment using high-performance WordPress FPM-Alpine + Caddy Web Server
            </p>
          </div>
          <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            FPM + MariaDB 11
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Website Title</label>
            <input
              type="text"
              placeholder="My Awesome Website"
              value={config.wp_site_title}
              onChange={e => onChangeConfig(prev => ({ ...prev, wp_site_title: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Admin Username</label>
            <input
              type="text"
              placeholder="admin"
              value={config.wp_admin_user}
              onChange={e => onChangeConfig(prev => ({ ...prev, wp_admin_user: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Admin Notification Email</label>
            <input
              type="email"
              placeholder={`admin@${config.domain || 'example.com'}`}
              value={config.wp_admin_email}
              onChange={e => onChangeConfig(prev => ({ ...prev, wp_admin_email: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Admin Password</label>
              <button
                type="button"
                onClick={() =>
                  onChangeConfig(prev => ({ ...prev, wp_admin_password: generateRandomPassword() }))
                }
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showWpPass ? 'text' : 'password'}
                value={config.wp_admin_password}
                onChange={e => onChangeConfig(prev => ({ ...prev, wp_admin_password: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowWpPass(!showWpPass)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
              >
                {showWpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Database Config Drawer */}
        <div className="pt-2 border-t border-surface-border/40">
          <button
            type="button"
            onClick={() => setShowAdvancedDb(!showAdvancedDb)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Database Credentials (Pre-Configured MariaDB)</span>
            {showAdvancedDb ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </button>

          {showAdvancedDb && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-surface rounded-lg border border-surface-border">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Database Name</label>
                <input
                  type="text"
                  value={config.mysql_database}
                  onChange={e => onChangeConfig(prev => ({ ...prev, mysql_database: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface-lighter border border-surface-border rounded text-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Database User</label>
                <input
                  type="text"
                  value={config.mysql_user}
                  onChange={e => onChangeConfig(prev => ({ ...prev, mysql_user: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface-lighter border border-surface-border rounded text-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">User Password</label>
                <input
                  type="password"
                  value={config.mysql_password}
                  onChange={e => onChangeConfig(prev => ({ ...prev, mysql_password: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface-lighter border border-surface-border rounded text-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Root Password</label>
                <input
                  type="password"
                  value={config.mysql_root_password}
                  onChange={e => onChangeConfig(prev => ({ ...prev, mysql_root_password: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-surface-lighter border border-surface-border rounded text-white font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Server & Outbound SMTP Relay */}
      <div className="bg-surface-lighter/30 border border-surface-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              Docker-Mailserver &amp; Outbound Relay (Port 587 Bypass)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Receives emails directly on port 25. Sends outbound emails securely through a free SMTP relay on port 587.
            </p>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
            IMAP 993 + Submission 587
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Initial Mailbox Account</label>
            <input
              type="text"
              placeholder={`admin@${config.domain || 'example.com'}`}
              value={config.mail_account}
              onChange={e => onChangeConfig(prev => ({ ...prev, mail_account: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Mailbox Password</label>
              <button
                type="button"
                onClick={() =>
                  onChangeConfig(prev => ({ ...prev, mail_password: generateRandomPassword() }))
                }
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showMailPass ? 'text' : 'password'}
                value={config.mail_password}
                onChange={e => onChangeConfig(prev => ({ ...prev, mail_password: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowMailPass(!showMailPass)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
              >
                {showMailPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Outbound SMTP Relay Settings */}
        <div className="p-4 bg-surface rounded-xl border border-surface-border space-y-3.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-200">
                Outbound SMTP Relay (Port 25 Bypass)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() => setRelayPreset('smtp-relay.brevo.com')}
                className="text-[10px] px-2 py-0.5 rounded bg-surface-lighter hover:bg-surface-border text-slate-300 border border-surface-border"
              >
                Brevo (300/day Free)
              </button>
              <button
                type="button"
                onClick={() => setRelayPreset('smtp.sendgrid.net')}
                className="text-[10px] px-2 py-0.5 rounded bg-surface-lighter hover:bg-surface-border text-slate-300 border border-surface-border"
              >
                SendGrid (100/day Free)
              </button>
              <button
                type="button"
                onClick={() => setRelayPreset('smtp.mailgun.org')}
                className="text-[10px] px-2 py-0.5 rounded bg-surface-lighter hover:bg-surface-border text-slate-300 border border-surface-border"
              >
                Mailgun
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">SMTP Relay Host</label>
              <input
                type="text"
                placeholder="smtp-relay.brevo.com"
                value={config.smtp_relay_host}
                onChange={e => onChangeConfig(prev => ({ ...prev, smtp_relay_host: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs bg-surface-lighter border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Relay Username / Key ID</label>
              <input
                type="text"
                placeholder="e.g. 7f89b001@smtp-brevo.com"
                value={config.smtp_relay_user}
                onChange={e => onChangeConfig(prev => ({ ...prev, smtp_relay_user: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs bg-surface-lighter border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Relay Password / Secret</label>
              <input
                type="password"
                placeholder="SMTP Master Key"
                value={config.smtp_relay_password}
                onChange={e => onChangeConfig(prev => ({ ...prev, smtp_relay_password: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs bg-surface-lighter border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-3 bg-surface-lighter/50 rounded-lg text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero-Cost Architecture:</strong> Oracle Cloud Always Free blocks outbound port 25 to fight spam. Docker-Mailserver automatically routes all outbound mail via your free relay on port 587, while accepting all incoming inbound mail directly on port 25 with 100% free unlimited mailbox storage!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
