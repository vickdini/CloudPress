import React, { useState } from 'react';
import type { DeployConfig } from '../types';
import {
  Mail,
  Send,
  Database,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { openExternalUrl } from '../utils';

interface Step4EmailProps {
  config: DeployConfig;
  onChangeConfig: (updater: (prev: DeployConfig) => DeployConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step4Email: React.FC<Step4EmailProps> = ({
  config,
  onChangeConfig,
  onNext,
  onBack,
}) => {
  const [showMailPass, setShowMailPass] = useState(false);
  const [showAdvancedDb, setShowAdvancedDb] = useState(false);
  const [showRelayGuide, setShowRelayGuide] = useState(false);
  const [guideTab, setGuideTab] = useState<'brevo' | 'sendgrid'>('brevo');

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const setRelayPreset = (preset: 'brevo' | 'sendgrid' | 'custom') => {
    if (preset === 'brevo') {
      onChangeConfig(prev => ({
        ...prev,
        smtp_relay_host: 'smtp-relay.brevo.com',
        smtp_relay_user: prev.smtp_relay_user === 'apikey' ? '' : prev.smtp_relay_user,
      }));
      setGuideTab('brevo');
    } else if (preset === 'sendgrid') {
      onChangeConfig(prev => ({
        ...prev,
        smtp_relay_host: 'smtp.sendgrid.net',
        smtp_relay_user: prev.smtp_relay_user || 'apikey',
      }));
      setGuideTab('sendgrid');
    }
  };

  const isFormValid =
    config.mail_account.trim().length > 0 &&
    config.mail_password.trim().length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Intro Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950/40 via-surface to-surface-lighter/50 border border-emerald-500/20 p-6 md:p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-3">
            <Mail className="w-3.5 h-3.5 text-emerald-400" />
            <span>Step 4 of 5: Business Email Setup</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Professional Business Email &amp; Inboxes
          </h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Get your own personalized business email address (like <code className="text-emerald-300 font-mono">admin@{config.domain || 'yourdomain.com'}</code>). All incoming emails are stored safely on your free cloud server with unlimited storage!
          </p>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="bg-surface/80 border border-surface-border rounded-2xl p-6 md:p-8 space-y-6 backdrop-blur-sm shadow-xl">
        {/* Mailbox Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-400" />
            Primary Email Mailbox
          </h3>
          <p className="text-xs text-slate-400">
            You will use this address and password to send and receive emails from your phone, Thunderbird, or Apple Mail.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Email Address
              </label>
              <input
                type="text"
                placeholder={`admin@${config.domain || 'example.com'}`}
                value={config.mail_account}
                onChange={e => onChangeConfig(prev => ({ ...prev, mail_account: e.target.value }))}
                className="w-full px-4 py-2.5 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Mailbox Password
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onChangeConfig(prev => ({ ...prev, mail_password: generateRandomPassword() }))
                  }
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
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
                  className="w-full px-4 py-2.5 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 pr-10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowMailPass(!showMailPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showMailPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Outbound Sending Relay (Anti-Spam) */}
        <div className="border-t border-surface-border/60 pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-400" />
                Outgoing Email Delivery (Zero-Cost Anti-Spam Relay)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Connecting to a free delivery provider ensures your outbound emails land in inboxes, not spam folders.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowRelayGuide(!showRelayGuide)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 font-medium transition-colors shrink-0"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showRelayGuide ? 'Hide Instructions' : 'How to get your API key'}</span>
              {showRelayGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* API Key Instructions Drawer */}
          {showRelayGuide && (
            <div className="p-5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-slate-300 space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">Select instructions:</span>
                  <div className="flex p-0.5 bg-surface rounded-lg border border-surface-border">
                    <button
                      type="button"
                      onClick={() => {
                        setGuideTab('brevo');
                        setRelayPreset('brevo');
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        guideTab === 'brevo'
                          ? 'bg-amber-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Brevo (300/day)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuideTab('sendgrid');
                        setRelayPreset('sendgrid');
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        guideTab === 'sendgrid'
                          ? 'bg-amber-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      SendGrid (100/day)
                    </button>
                  </div>
                </div>

                <a
                  href={
                    guideTab === 'brevo'
                      ? 'https://app.brevo.com/settings/keys/smtp'
                      : 'https://app.sendgrid.com/settings/api_keys'
                  }
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => {
                    e.preventDefault();
                    openExternalUrl(
                      guideTab === 'brevo'
                        ? 'https://app.brevo.com/settings/keys/smtp'
                        : 'https://app.sendgrid.com/settings/api_keys'
                    );
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>
                    Open {guideTab === 'brevo' ? 'Brevo SMTP & API' : 'SendGrid API Keys'} Page
                  </span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {guideTab === 'brevo' ? (
                <div className="space-y-2">
                  <div className="font-semibold text-amber-200">
                    Step-by-step guide for Brevo (Sendinblue):
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                    <li>
                      Create a free account at <strong>brevo.com</strong> (no credit card required, includes 300 free emails every day).
                    </li>
                    <li>
                      Click on your account name in the top right corner and select <strong>SMTP &amp; API</strong> (or click the direct link button above).
                    </li>
                    <li>
                      Click on the <strong>SMTP</strong> tab.
                    </li>
                    <li>
                      Find your <strong>Login</strong> (e.g. your login email or an address like <code className="text-amber-300 font-mono">7f89b001@smtp-brevo.com</code>) and copy it into the <strong>Relay Username</strong> field below.
                    </li>
                    <li>
                      Click <strong>Generate a new SMTP key</strong> (or use your master key), copy the key value, and paste it into the <strong>Relay API Key / Password</strong> field below.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="font-semibold text-amber-200">
                    Step-by-step guide for SendGrid:
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                    <li>
                      Create a free account at <strong>sendgrid.com</strong> (free tier provides 100 emails every day).
                    </li>
                    <li>
                      In the left navigation menu, go to <strong>Settings</strong> &gt; <strong>API Keys</strong> (or click the direct link button above).
                    </li>
                    <li>
                      Click the blue <strong>Create API Key</strong> button in the top right corner.
                    </li>
                    <li>
                      Give the key a name (such as <code className="text-amber-300 font-mono">CloudPress</code>), choose <strong>Full Access</strong> (or <strong>Restricted Access</strong> with <em>Mail Send</em> permissions), and click <strong>Create &amp; View</strong>.
                    </li>
                    <li>
                      Copy the generated API key (it starts with <code className="text-amber-300 font-mono">SG.</code>) and paste it into the <strong>Relay API Key / Password</strong> field below.
                    </li>
                    <li>
                      <strong>Important:</strong> For SendGrid, your <strong>Relay Username</strong> is always strictly the literal word <code className="text-amber-300 font-mono">apikey</code> (CloudPress automatically sets this for you).
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Preset Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setRelayPreset('brevo')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                config.smtp_relay_host.includes('brevo')
                  ? 'bg-amber-950/20 border-amber-500/50 shadow-sm'
                  : 'bg-surface-lighter border-surface-border hover:bg-surface-lighter/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                <span>Brevo (Sendinblue)</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                300 free emails per day forever. Quick setup with standard SMTP keys.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRelayPreset('sendgrid')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                config.smtp_relay_host.includes('sendgrid')
                  ? 'bg-amber-950/20 border-amber-500/50 shadow-sm'
                  : 'bg-surface-lighter border-surface-border hover:bg-surface-lighter/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                <span>SendGrid</span>
                <span className="text-[10px] text-slate-400 bg-surface px-1.5 py-0.5 rounded">
                  100 / day
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                100 free emails per day. Well-known enterprise provider.
              </p>
            </button>

            <div className="p-3.5 rounded-xl bg-surface-lighter/40 border border-surface-border flex flex-col justify-center">
              <div className="text-xs font-semibold text-slate-300">Custom Relay</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                You can also enter your own custom SMTP relay host below.
              </p>
            </div>
          </div>

          {/* Relay Credentials Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Relay Host</label>
              <input
                type="text"
                value={config.smtp_relay_host}
                onChange={e => onChangeConfig(prev => ({ ...prev, smtp_relay_host: e.target.value }))}
                placeholder="smtp-relay.brevo.com"
                className="w-full px-3.5 py-2 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Relay Username / Login
              </label>
              <input
                type="text"
                value={config.smtp_relay_user}
                onChange={e => onChangeConfig(prev => ({ ...prev, smtp_relay_user: e.target.value }))}
                placeholder="e.g. 7f89b001@smtp-brevo.com"
                className="w-full px-3.5 py-2 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Relay API Key / Password
              </label>
              <input
                type="password"
                value={config.smtp_relay_password}
                onChange={e => onChangeConfig(prev => ({ ...prev, smtp_relay_password: e.target.value }))}
                placeholder="Paste SMTP Secret Key"
                className="w-full px-3.5 py-2 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-lighter/50 border border-surface-border/50 text-xs text-slate-400 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero-Cost Tip:</strong> You can configure the relay keys now, or leave them blank and add them anytime later. Your website and inbound email receiving will work immediately regardless!
            </span>
          </div>
        </div>

        {/* Database Drawer (Hidden for Non-Technical Users) */}
        <div className="border-t border-surface-border/60 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvancedDb(!showAdvancedDb)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors font-medium"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Advanced: WordPress MariaDB Database Settings (Pre-configured automatically)</span>
            {showAdvancedDb ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdvancedDb && (
            <div className="mt-4 p-4 rounded-xl bg-surface-lighter/40 border border-surface-border space-y-3 animate-in fade-in duration-200">
              <p className="text-xs text-slate-400">
                These settings are already optimized for high performance on MariaDB 11. You do not need to alter them.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Database Name</label>
                  <input
                    type="text"
                    value={config.mysql_database}
                    onChange={e => onChangeConfig(prev => ({ ...prev, mysql_database: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface border border-surface-border rounded text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Database User</label>
                  <input
                    type="text"
                    value={config.mysql_user}
                    onChange={e => onChangeConfig(prev => ({ ...prev, mysql_user: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface border border-surface-border rounded text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">User Password</label>
                  <input
                    type="password"
                    value={config.mysql_password}
                    onChange={e => onChangeConfig(prev => ({ ...prev, mysql_password: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface border border-surface-border rounded text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Root Password</label>
                  <input
                    type="password"
                    value={config.mysql_root_password}
                    onChange={e => onChangeConfig(prev => ({ ...prev, mysql_root_password: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs bg-surface border border-surface-border rounded text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-surface-border/40">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-surface-lighter hover:bg-surface-border border border-surface-border rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back: Connect Domain</span>
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!isFormValid}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
          >
            <span>Next: Review &amp; Launch</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
