import React, { useState } from 'react';
import type { OciConfig, GeneratedKeyPair } from '../types';
import {
  Server,
  Layers,
  HelpCircle,
  ExternalLink,
  Shield,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Cpu,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Key,
  Copy,
  FolderOpen,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Step2ServerProps {
  config: OciConfig;
  sshPrivateKey: string;
  onChangeOci: (updater: (prev: OciConfig) => OciConfig) => void;
  onChangeSshKey: (key: string) => void;
  onNext: () => void;
  onBack: () => void;
  onLog: (msg: string) => void;
}

export const Step2Server: React.FC<Step2ServerProps> = ({
  config,
  sshPrivateKey,
  onChangeOci,
  onChangeSshKey,
  onNext,
  onBack,
  onLog,
}) => {
  const [useExistingVm, setUseExistingVm] = useState(Boolean(config.existing_vm_ip));
  const [showGuide, setShowGuide] = useState(false);
  const [showAdvancedSsh, setShowAdvancedSsh] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isTestingSsh, setIsTestingSsh] = useState(false);
  const [sshTestStatus, setSshTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSelectingFile, setIsSelectingFile] = useState(false);

  const popularRegions = [
    { label: 'Europe (Milan)', val: 'eu-milan-1' },
    { label: 'Europe (Frankfurt)', val: 'eu-frankfurt-1' },
    { label: 'US East (Ashburn)', val: 'us-ashburn-1' },
    { label: 'US West (Phoenix)', val: 'us-phoenix-1' },
    { label: 'Asia (Tokyo)', val: 'ap-tokyo-1' },
  ];

  const handleGenerateKey = async () => {
    try {
      setIsGeneratingKey(true);
      const res = await invoke<GeneratedKeyPair>('generate_ssh_key');
      onChangeOci(prev => ({ ...prev, ssh_public_key: res.public_key }));
      onChangeSshKey(res.private_key);
      onLog('[Security Key] Generated a new high-security Ed25519 digital key pair.');
    } catch (err) {
      alert(`Error generating security key: ${err}`);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleBrowsePrivateKey = async () => {
    try {
      setIsSelectingFile(true);
      const selectedPath = await invoke<string | null>('select_private_key_file');
      if (selectedPath) {
        onChangeOci(prev => ({ ...prev, private_key_path: selectedPath }));
        onLog(`[File Selected] Selected Oracle API private key: ${selectedPath}`);
      }
    } catch (err) {
      alert(`Could not open file browser: ${err}`);
    } finally {
      setIsSelectingFile(false);
    }
  };

  const handleTestSsh = async () => {
    const ip = config.existing_vm_ip?.trim();
    if (!ip) {
      setSshTestStatus({ success: false, message: 'Please enter a valid IP address first.' });
      return;
    }
    if (!sshPrivateKey.trim()) {
      setSshTestStatus({ success: false, message: 'Please generate or provide a private key first.' });
      return;
    }

    try {
      setIsTestingSsh(true);
      setSshTestStatus(null);
      const res = await invoke<string>('test_ssh_connection', {
        host: ip,
        port: 22,
        username: 'ubuntu',
        privateKey: sshPrivateKey,
      });
      setSshTestStatus({ success: true, message: res });
      onLog(`[Server Test] ${res}`);
    } catch (err) {
      setSshTestStatus({ success: false, message: String(err) });
      onLog(`[Server Test Failed] ${err}`);
    } finally {
      setIsTestingSsh(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isFormValid = useExistingVm
    ? Boolean(config.existing_vm_ip && config.existing_vm_ip.trim().length > 6)
    : Boolean(
      config.tenancy_ocid.trim() &&
      config.user_ocid.trim() &&
      config.fingerprint.trim() &&
      config.private_key_path.trim()
    );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Intro Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/40 via-surface to-surface-lighter/50 border border-indigo-500/20 p-6 md:p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>Step 2 of 5: Free Cloud Server</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Your Free Forever Cloud Computer
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Oracle Cloud provides an Always Free Ampere Arm64 instance (<strong>1 core OCPU, 6 GB memory, 1 Gbps network bandwidth</strong>, <code className="text-indigo-300 font-mono">VM.Standard.A1.Flex</code>). CloudPress will set up WordPress, your database, and your email server on it automatically.
            </p>
          </div>

          <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center shrink-0">
            <div className="text-xs uppercase font-semibold tracking-wider">Oracle Free Tier</div>
            <div className="text-xl font-bold text-white">$0.00 / month</div>
            <div className="text-[11px] text-emerald-400">Always Free Guaranteed</div>
          </div>
        </div>
      </div>

      {/* Mode Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => {
            setUseExistingVm(false);
            onChangeOci(prev => ({ ...prev, existing_vm_ip: undefined }));
          }}
          className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden ${!useExistingVm
            ? 'bg-surface-lighter/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10'
            : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
            }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              Recommended
            </span>
            <Layers className={`w-5 h-5 ${!useExistingVm ? 'text-indigo-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-base font-bold text-white">Automated Cloud Provisioning</div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Enter your Oracle Cloud account credentials. CloudPress will allocate the server, open firewalls, and install software automatically.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setUseExistingVm(true);
            onChangeOci(prev => ({ ...prev, existing_vm_ip: prev.existing_vm_ip || '' }));
          }}
          className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden ${useExistingVm
            ? 'bg-surface-lighter/80 border-cyan-500 ring-2 ring-cyan-500/20 shadow-lg shadow-cyan-500/10'
            : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
            }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
              Existing Server
            </span>
            <Server className={`w-5 h-5 ${useExistingVm ? 'text-cyan-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-base font-bold text-white">Use an Existing Server IP</div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Already have an Ubuntu 24.04 or 22.04 Arm64 instance running on Oracle Cloud? Just type its IP address and we'll configure it directly.
          </p>
        </button>
      </div>

      {/* Main Configuration Card */}
      <div className="bg-surface/80 border border-surface-border rounded-2xl p-6 md:p-8 space-y-6 backdrop-blur-sm shadow-xl">
        {useExistingVm ? (
          /* Existing VM Form */
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              Existing Server Connection
            </h3>
            <p className="text-xs text-slate-300">
              Provide the public IPv4 address of your Ubuntu Arm64 instance. Make sure port 22 (SSH) is open in your Oracle security list.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Server Public IPv4 Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 129.152.12.34"
                  value={config.existing_vm_ip || ''}
                  onChange={e => onChangeOci(prev => ({ ...prev, existing_vm_ip: e.target.value }))}
                  className="w-full px-4 py-3 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleTestSsh}
                  disabled={isTestingSsh || !config.existing_vm_ip}
                  className="w-full py-3 px-4 text-xs font-semibold bg-surface-lighter hover:bg-surface-border border border-surface-border text-slate-200 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  {isTestingSsh ? 'Testing Connection...' : 'Test Connection'}
                </button>
              </div>
            </div>

            {sshTestStatus && (
              <div
                className={`p-4 rounded-xl border text-xs flex items-center gap-3 ${sshTestStatus.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
              >
                {sshTestStatus.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>{sshTestStatus.message}</span>
              </div>
            )}
          </div>
        ) : (
          /* Automated Provisioning Form */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-surface-border/60 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Oracle Cloud API Credentials
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  These 4 keys allow CloudPress to communicate securely with your Oracle Cloud account.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-medium transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{showGuide ? 'Hide Guide' : 'How do I find these keys?'}</span>
                {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Beginner Guide Card */}
            {showGuide && (
              <div className="p-5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-xs text-slate-300 space-y-3 animate-in fade-in duration-200">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>How to get your free Oracle Cloud API keys in 2 minutes:</span>
                  <a
                    href="https://cloud.oracle.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-normal text-[11px]"
                  >
                    <span>Open Oracle Cloud Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-slate-300">
                  <li>
                    Log in to Oracle Cloud, click your profile icon in the top right corner, and select <strong>User Settings</strong>.
                  </li>
                  <li>
                    Click on the <strong>Tokens and keys</strong> section on the top menu then on <strong>Add API Key</strong>.
                  </li>
                  <li>
                    Select <em>Generate API Key Pair</em>, click <strong>Download Private Key</strong> (save it on your computer), then click <strong>Add</strong>.
                  </li>
                  <li>
                    A box with a configuration preview will appear containing your <code className="text-indigo-300">user</code>, <code className="text-indigo-300">tenancy</code>, <code className="text-indigo-300">fingerprint</code>, and <code className="text-indigo-300">region</code>. Simply copy those values into the fields below!
                  </li>
                </ol>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Tenancy OCID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Tenancy OCID
                </label>
                <input
                  type="text"
                  placeholder="ocid1.tenancy.oc1..aaaaaaa..."
                  value={config.tenancy_ocid}
                  onChange={e => onChangeOci(prev => ({ ...prev, tenancy_ocid: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {/* User OCID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  User OCID
                </label>
                <input
                  type="text"
                  placeholder="ocid1.user.oc1..aaaaaaa..."
                  value={config.user_ocid}
                  onChange={e => onChangeOci(prev => ({ ...prev, user_ocid: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Compartment OCID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Compartment OCID</span>
                  <span className="text-[11px] text-slate-500 font-normal">Optional (defaults to Tenancy)</span>
                </label>
                <input
                  type="text"
                  placeholder="ocid1.compartment.oc1.. (leave blank if unsure)"
                  value={config.compartment_ocid}
                  onChange={e => onChangeOci(prev => ({ ...prev, compartment_ocid: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Region */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Cloud Region
                  </label>
                  <div className="flex gap-1">
                    {popularRegions.slice(0, 3).map(r => (
                      <button
                        key={r.val}
                        type="button"
                        onClick={() => onChangeOci(prev => ({ ...prev, region: r.val }))}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${config.region === r.val
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-surface-lighter text-slate-400 border-surface-border hover:text-white'
                          }`}
                      >
                        {r.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="e.g. eu-milan-1, us-ashburn-1"
                  value={config.region}
                  onChange={e => onChangeOci(prev => ({ ...prev, region: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Fingerprint */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  API Key Fingerprint
                </label>
                <input
                  type="text"
                  placeholder="20:3b:97:13:..."
                  value={config.fingerprint}
                  onChange={e => onChangeOci(prev => ({ ...prev, fingerprint: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Private Key Path */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    OCI Private Key File (.pem)
                  </label>
                  <span className="text-[11px] text-indigo-400 font-medium">
                    Opens Downloads folder
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Click Browse... or paste path to your .pem key"
                    value={config.private_key_path}
                    onChange={e => onChangeOci(prev => ({ ...prev, private_key_path: e.target.value }))}
                    className="flex-1 min-w-0 px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500 transition-all truncate"
                  />
                  <button
                    type="button"
                    onClick={handleBrowsePrivateKey}
                    disabled={isSelectingFile}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 shadow-sm flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
                  >
                    <FolderOpen className="w-4 h-4 text-indigo-200" />
                    <span>{isSelectingFile ? 'Browsing...' : 'Browse...'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Select the private key you downloaded from Oracle Cloud Console.
                </p>
              </div>
            </div>

            {/* Smart Capacity Retry Protection */}
            <div className="p-4 rounded-xl bg-surface-lighter/60 border border-surface-border flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Cpu className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">
                    Auto-Retry Capacity Protection
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    If Oracle reports that free servers in your region are temporarily full, CloudPress will automatically retry every 60 seconds until a spot opens up.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={config.auto_retry_out_of_capacity}
                  onChange={e => onChangeOci(prev => ({ ...prev, auto_retry_out_of_capacity: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        )}

        {/* Automated Security Key (SSH) Section */}
        <div className="border-t border-surface-border/60 pt-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>Server Security Digital Key</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded border border-emerald-500/20">
                    {config.ssh_public_key ? 'Key Secured' : 'Ready to Generate'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  CloudPress uses this cryptographic keypair to securely connect to your server.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateKey}
                disabled={isGeneratingKey}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-surface-lighter hover:bg-surface-border border border-surface-border rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin text-indigo-400' : ''}`} />
                <span>{config.ssh_public_key ? 'Regenerate Key' : 'Generate Key'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdvancedSsh(!showAdvancedSsh)}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 transition-colors"
              >
                {showAdvancedSsh ? 'Hide Details' : 'View Key Details'}
              </button>
            </div>
          </div>

          {showAdvancedSsh && (
            <div className="mt-3 p-4 rounded-xl bg-surface-lighter/50 border border-surface-border space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-300">Public Key</label>
                    {config.ssh_public_key && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(config.ssh_public_key, 'pub')}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedKey === 'pub' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={config.ssh_public_key}
                    onChange={e => onChangeOci(prev => ({ ...prev, ssh_public_key: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-slate-300 font-mono focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..."
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-300">Private Key</label>
                    {sshPrivateKey && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(sshPrivateKey, 'priv')}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedKey === 'priv' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={sshPrivateKey}
                    onChange={e => onChangeSshKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-slate-300 font-mono focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
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
            <span>Back: Website Details</span>
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onNext}
              disabled={!isFormValid}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Next: Connect Domain (Cloudflare)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
