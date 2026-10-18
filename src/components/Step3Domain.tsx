import React, { useState } from 'react';
import {
  Cloud,
  Globe,
  Key,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Lock,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Step3DomainProps {
  domain: string;
  apiToken: string;
  zoneId: string;
  smtpRelayHost: string;
  onChangeApiToken: (token: string) => void;
  onChangeZoneId: (zoneId: string) => void;
  onNext: () => void;
  onBack: () => void;
  onLog: (msg: string) => void;
}

export const Step3Domain: React.FC<Step3DomainProps> = ({
  domain,
  apiToken,
  zoneId,
  smtpRelayHost,
  onChangeApiToken,
  onChangeZoneId,
  onNext,
  onBack,
  onLog,
}) => {
  const [isFetchingZone, setIsFetchingZone] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [showDnsTable, setShowDnsTable] = useState(false);
  const [showTokenGuide, setShowTokenGuide] = useState(false);

  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const relayDomain = smtpRelayHost.trim().replace(/^smtp-relay\./, '').replace(/^smtp\./, '');

  const handleAutoFetchZone = async () => {
    if (!apiToken.trim()) {
      setFetchStatus({ success: false, message: 'Please enter your Cloudflare API Token first.' });
      return;
    }
    if (!cleanDomain) {
      setFetchStatus({ success: false, message: 'Please ensure your domain name was entered in Step 1.' });
      return;
    }

    try {
      setIsFetchingZone(true);
      setFetchStatus(null);
      const fetchedZoneId = await invoke<string>('fetch_zone_id', {
        apiToken: apiToken.trim(),
        domain: cleanDomain,
      });
      onChangeZoneId(fetchedZoneId);
      setFetchStatus({
        success: true,
        message: `Successfully connected to Cloudflare! Domain verified.`,
      });
      onLog(`[Cloudflare] Successfully resolved Zone ID for ${cleanDomain}: ${fetchedZoneId}`);
    } catch (err) {
      setFetchStatus({
        success: false,
        message: `Could not find domain on Cloudflare: ${err}. Please ensure your domain is added to your Cloudflare account.`,
      });
      onLog(`[Cloudflare Error] ${err}`);
    } finally {
      setIsFetchingZone(false);
    }
  };

  const isFormValid = Boolean(cleanDomain && apiToken.trim().length > 10 && zoneId.trim().length > 10);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Intro Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-950/40 via-surface to-surface-lighter/50 border border-cyan-500/20 p-6 md:p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-3">
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
            <span>Step 3 of 5: Connect Domain &amp; Security</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Connect Your Domain with Cloudflare
          </h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Cloudflare connects your domain to your free server, provides <strong>free HTTPS SSL security</strong> (the padlock icon in browsers), and safeguards your website against DDoS attacks.
          </p>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="bg-surface/80 border border-surface-border rounded-2xl p-6 md:p-8 space-y-6 backdrop-blur-sm shadow-xl">
        {/* Domain Confirmation Badge */}
        <div className="p-4 rounded-xl bg-surface-lighter border border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Target Domain Name</div>
              <div className="text-base font-bold text-white font-mono">
                {cleanDomain || 'No domain specified in Step 1'}
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-400 hidden sm:block">
            Configured in Step 1
          </div>
        </div>

        {/* Cloudflare Token Input */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-surface-border/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Cloudflare API Token
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Allows CloudPress to set up your domain's web &amp; email routes automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTokenGuide(!showTokenGuide)}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showTokenGuide ? 'Hide Token Guide' : 'How to get this token (30 seconds)'}</span>
            </button>
          </div>

          {/* Quick Token Guide */}
          {showTokenGuide && (
            <div className="p-5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-slate-300 space-y-3 animate-in fade-in duration-200">
              <div className="font-bold text-white flex items-center justify-between">
                <span>How to get your free Cloudflare API token:</span>
                <a
                  href="https://dash.cloudflare.com/profile/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                >
                  <span>Open Cloudflare API Tokens Page</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>Log in to your free Cloudflare account and on the left menu click <strong>Manage Account</strong> and then <strong>Account API tokens</strong>.</li>
                <li>Click <strong>Create a token</strong> at the center of the page.</li>
                <li>In the <strong>Permission policies</strong> section, click <strong>Edit zone DNS</strong>, and select <strong>All zones in [YOUR] account</strong>.</li>
                <li>Scroll to the bottom of the page and click <strong>Review token</strong>.</li>
                <li>Click <strong>Create token</strong> at the bottom right.</li>
                <li>Copy the generated token string and paste it below!</li>
              </ol>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              API Token
            </label>
            <input
              type="password"
              placeholder="Paste your Cloudflare Bearer API Token here"
              value={apiToken}
              onChange={e => onChangeApiToken(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
            />
          </div>

          {/* 1-Click Auto Detect Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAutoFetchZone}
              disabled={isFetchingZone || !apiToken.trim() || !cleanDomain}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-cyan-600/20 flex items-center justify-center gap-2 transition-all"
            >
              <Search className={`w-4 h-4 ${isFetchingZone ? 'animate-spin' : ''}`} />
              <span>{isFetchingZone ? 'Detecting Domain on Cloudflare...' : 'Auto-Detect Domain Settings'}</span>
            </button>
          </div>

          {/* Verification Status */}
          {fetchStatus && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-center gap-3 ${fetchStatus.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
            >
              {fetchStatus.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="space-y-0.5">
                <div className="font-semibold">{fetchStatus.message}</div>
                {zoneId && (
                  <div className="text-[11px] text-slate-400 font-mono">
                    Zone Identifier: {zoneId}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* What Will Happen Automatically Checklist */}
        <div className="border-t border-surface-border/60 pt-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            What CloudPress Will Automatically Configure For You:
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-lighter/60 border border-surface-border space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Free SSL Padlock</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Automatic Let's Encrypt certificates so visitors see secure <code className="text-slate-300">https://</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-lighter/60 border border-surface-border space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Instant Web Routing</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Points both <code className="text-slate-300">yourdomain.com</code> and <code className="text-slate-300">www</code> to your server.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-lighter/60 border border-surface-border space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Anti-Spam Security</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Configures SPF, DKIM, and DMARC so your outgoing emails don't hit spam filters.
              </p>
            </div>
          </div>
        </div>

        {/* Advanced DNS Records Accordion */}
        <div className="border-t border-surface-border/60 pt-4">
          <button
            type="button"
            onClick={() => setShowDnsTable(!showDnsTable)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors font-medium"
          >
            <span>Advanced: View Technical DNS Records</span>
            {showDnsTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDnsTable && (
            <div className="mt-4 overflow-x-auto p-4 rounded-xl bg-surface-lighter/40 border border-surface-border">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-surface-border pb-2">
                  <tr>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 px-2">Record Name</th>
                    <th className="py-2 px-2">Target / Value</th>
                    <th className="py-2 px-2">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/40 font-mono text-[11px] text-slate-300">
                  <tr>
                    <td className="py-2 px-2 text-cyan-400 font-bold">A</td>
                    <td className="py-2 px-2">@ ({cleanDomain})</td>
                    <td className="py-2 px-2 text-amber-300">[Server IP]</td>
                    <td className="py-2 px-2 text-slate-400 font-sans">Main website</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-cyan-400 font-bold">A</td>
                    <td className="py-2 px-2">www</td>
                    <td className="py-2 px-2 text-amber-300">[Server IP]</td>
                    <td className="py-2 px-2 text-slate-400 font-sans">WWW prefix</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-cyan-400 font-bold">A</td>
                    <td className="py-2 px-2">mail</td>
                    <td className="py-2 px-2 text-amber-300">[Server IP]</td>
                    <td className="py-2 px-2 text-slate-400 font-sans">Mail Server</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-indigo-400 font-bold">MX</td>
                    <td className="py-2 px-2">@</td>
                    <td className="py-2 px-2">mail.{cleanDomain}</td>
                    <td className="py-2 px-2 text-slate-400 font-sans">Incoming mail routing</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-amber-400 font-bold">TXT</td>
                    <td className="py-2 px-2">@</td>
                    <td className="py-2 px-2">v=spf1 mx {relayDomain ? `include:${relayDomain}` : ''} ~all</td>
                    <td className="py-2 px-2 text-slate-400 font-sans">SPF security</td>
                  </tr>
                </tbody>
              </table>
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
            <span>Back: Cloud Server</span>
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!isFormValid}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
          >
            <span>Next: Email Setup</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
