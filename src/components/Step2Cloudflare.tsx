import React, { useState } from 'react';
import { Cloud, Globe, Key, Search, CheckCircle2, AlertCircle, ExternalLink, ShieldAlert } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Step2Props {
  domain: string;
  apiToken: string;
  zoneId: string;
  smtpRelayHost: string;
  onChangeDomain: (domain: string) => void;
  onChangeApiToken: (token: string) => void;
  onChangeZoneId: (zoneId: string) => void;
  onLog: (msg: string) => void;
}

export const Step2Cloudflare: React.FC<Step2Props> = ({
  domain,
  apiToken,
  zoneId,
  smtpRelayHost,
  onChangeDomain,
  onChangeApiToken,
  onChangeZoneId,
  onLog,
}) => {
  const [isFetchingZone, setIsFetchingZone] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const relayDomain = smtpRelayHost.trim().replace(/^smtp-relay\./, '').replace(/^smtp\./, '');

  const handleAutoFetchZone = async () => {
    if (!apiToken.trim()) {
      setFetchStatus({ success: false, message: 'Please enter your Cloudflare API Token first.' });
      return;
    }
    if (!cleanDomain) {
      setFetchStatus({ success: false, message: 'Please enter a valid domain name first.' });
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
      setFetchStatus({ success: true, message: `Zone ID resolved: ${fetchedZoneId}` });
      onLog(`[Cloudflare] Successfully resolved Zone ID for ${cleanDomain}: ${fetchedZoneId}`);
    } catch (err) {
      setFetchStatus({ success: false, message: String(err) });
      onLog(`[Cloudflare Error] ${err}`);
    } finally {
      setIsFetchingZone(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cloudflare API Credentials */}
      <div className="bg-surface-lighter/30 border border-surface-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cloud className="w-4 h-4 text-cyan-400" />
              Cloudflare API &amp; Zone Configuration
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              CloudPress communicates with Cloudflare API v4 to automate all DNS records, SSL challenge routes, and email routing.
            </p>
          </div>

          <a
            href="https://dash.cloudflare.com/profile/api-tokens"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Create Token</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              Apex Domain Name
            </label>
            <input
              type="text"
              placeholder="e.g. yourdomain.com"
              value={domain}
              onChange={e => onChangeDomain(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-slate-500">Do not include http:// or www prefix.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              Cloudflare API Token
            </label>
            <input
              type="password"
              placeholder="Bearer API Token with Zone:DNS:Edit permission"
              value={apiToken}
              onChange={e => onChangeApiToken(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-slate-500">Requires Zone.DNS (Edit) &amp; Zone.Zone (Read) permissions.</p>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Cloudflare Zone ID</label>
              <button
                type="button"
                onClick={handleAutoFetchZone}
                disabled={isFetchingZone || !domain || !apiToken}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <Search className={`w-3.5 h-3.5 ${isFetchingZone ? 'animate-spin' : ''}`} />
                <span>Auto-Fetch Zone ID from Domain</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="32-character hexadecimal zone identifier (e.g. 023e105f4ecef8ad9ca31a8372d0c353)"
              value={zoneId}
              onChange={e => onChangeZoneId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {fetchStatus && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              fetchStatus.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {fetchStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{fetchStatus.message}</span>
          </div>
        )}
      </div>

      {/* Automated DNS Records Overview */}
      <div className="bg-surface-lighter/30 border border-surface-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            DNS Records Automated on Deployment
          </h3>
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            Automated via API v4
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-slate-400 uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-3 rounded-l-lg">Type</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Target / Value</th>
                <th className="py-2.5 px-3">Proxy</th>
                <th className="py-2.5 px-3 rounded-r-lg">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50 text-slate-300 font-mono text-[11px]">
              <tr>
                <td className="py-2 px-3 text-cyan-400 font-bold">A</td>
                <td className="py-2 px-3 text-white">@ ({cleanDomain || 'domain.com'})</td>
                <td className="py-2 px-3 text-amber-300">[Target VM IP]</td>
                <td className="py-2 px-3"><span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">DNS Only</span></td>
                <td className="py-2 px-3 text-slate-400 font-sans">Apex web traffic &amp; Let's Encrypt validation</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-cyan-400 font-bold">A</td>
                <td className="py-2 px-3 text-white">www</td>
                <td className="py-2 px-3 text-amber-300">[Target VM IP]</td>
                <td className="py-2 px-3"><span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">DNS Only</span></td>
                <td className="py-2 px-3 text-slate-400 font-sans">WWW subdomain</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-cyan-400 font-bold">A</td>
                <td className="py-2 px-3 text-white">mail</td>
                <td className="py-2 px-3 text-amber-300">[Target VM IP]</td>
                <td className="py-2 px-3"><span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">DNS Only</span></td>
                <td className="py-2 px-3 text-slate-400 font-sans">Mailserver (SMTP/IMAP cannot be HTTP-proxied)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-indigo-400 font-bold">MX</td>
                <td className="py-2 px-3 text-white">@</td>
                <td className="py-2 px-3 text-slate-200">mail.{cleanDomain || 'domain.com'} (Priority 10)</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3 text-slate-400 font-sans">Inbound mail routing to your server</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-amber-400 font-bold">TXT</td>
                <td className="py-2 px-3 text-white">@</td>
                <td className="py-2 px-3 text-slate-300">
                  v=spf1 mx {relayDomain ? `include:${relayDomain}` : ''} ~all
                </td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3 text-slate-400 font-sans">SPF email authentication</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-amber-400 font-bold">TXT</td>
                <td className="py-2 px-3 text-white">_dmarc</td>
                <td className="py-2 px-3 text-slate-300">v=DMARC1; p=quarantine; rua=mailto:admin@{cleanDomain || 'domain.com'}</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3 text-slate-400 font-sans">DMARC anti-spoofing policy</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-amber-400 font-bold">TXT</td>
                <td className="py-2 px-3 text-white">mail._domainkey</td>
                <td className="py-2 px-3 text-emerald-400">[OpenDKIM 2048-bit Key]</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3 text-slate-400 font-sans">Auto-extracted from container on deploy</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-surface/50 border border-surface-border/50 rounded-lg text-[11px] text-slate-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            DNS records are initially created with Cloudflare Proxy turned <strong>OFF</strong> so Caddy's automated Let's Encrypt certificates can provision smoothly.
          </span>
        </div>
      </div>
    </div>
  );
};
