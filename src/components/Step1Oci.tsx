import React, { useState } from 'react';
import type { OciConfig, GeneratedKeyPair } from '../types';
import {
  Key,
  Shield,
  RefreshCw,
  Cpu,
  Layers,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Copy,
  Info
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Step1Props {
  config: OciConfig;
  sshPrivateKey: string;
  onChangeOci: (updater: (prev: OciConfig) => OciConfig) => void;
  onChangeSshKey: (key: string) => void;
  onLog: (msg: string) => void;
}

export const Step1Oci: React.FC<Step1Props> = ({
  config,
  sshPrivateKey,
  onChangeOci,
  onChangeSshKey,
  onLog,
}) => {
  const [useExistingVm, setUseExistingVm] = useState(Boolean(config.existing_vm_ip));
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isTestingSsh, setIsTestingSsh] = useState(false);
  const [sshTestStatus, setSshTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleGenerateKey = async () => {
    try {
      setIsGeneratingKey(true);
      const res = await invoke<GeneratedKeyPair>('generate_ssh_key');
      onChangeOci(prev => ({ ...prev, ssh_public_key: res.public_key }));
      onChangeSshKey(res.private_key);
      onLog('[SSH Keygen] Generated new high-security Ed25519 keypair.');
    } catch (err) {
      alert(`Error generating SSH key: ${err}`);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleTestSsh = async () => {
    const ip = config.existing_vm_ip?.trim();
    if (!ip) {
      setSshTestStatus({ success: false, message: 'Please enter a valid IP address first.' });
      return;
    }
    if (!sshPrivateKey.trim()) {
      setSshTestStatus({ success: false, message: 'Please provide an SSH private key first.' });
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
      onLog(`[SSH Test] ${res}`);
    } catch (err) {
      setSshTestStatus({ success: false, message: String(err) });
      onLog(`[SSH Test Failed] ${err}`);
    } finally {
      setIsTestingSsh(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Mode Toggle */}
      <div className="bg-surface-lighter/50 border border-surface-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Compute Instance Deployment Mode
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select whether you want CloudPress to automatically provision a new Ampere A1 instance or configure an existing VM.
            </p>
          </div>

          <div className="flex items-center p-1 bg-surface rounded-lg border border-surface-border self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setUseExistingVm(false);
                onChangeOci(prev => ({ ...prev, existing_vm_ip: undefined }));
              }}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                !useExistingVm
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Provision New OCI VM
            </button>
            <button
              type="button"
              onClick={() => {
                setUseExistingVm(true);
                onChangeOci(prev => ({ ...prev, existing_vm_ip: prev.existing_vm_ip || '' }));
              }}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                useExistingVm
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Use Existing VM IP
            </button>
          </div>
        </div>

        {useExistingVm ? (
          <div className="mt-5 pt-4 border-t border-surface-border/60">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Arm64 VM Public IPv4 Address</span>
                  <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Ubuntu 24.04/22.04 LTS</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 129.152.12.34"
                  value={config.existing_vm_ip || ''}
                  onChange={e => onChangeOci(prev => ({ ...prev, existing_vm_ip: e.target.value }))}
                  className="w-full px-3.5 py-2 text-sm bg-surface border border-surface-border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleTestSsh}
                  disabled={isTestingSsh || !config.existing_vm_ip}
                  className="w-full py-2 px-3 text-xs font-medium bg-surface-lighter hover:bg-surface-border border border-surface-border text-slate-200 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  {isTestingSsh ? 'Testing Connection...' : 'Test SSH Port 22'}
                </button>
              </div>
            </div>

            {sshTestStatus && (
              <div
                className={`mt-3 p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  sshTestStatus.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {sshTestStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{sshTestStatus.message}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* OCI Credentials Form (if Provisioning mode) */}
      {!useExistingVm && (
        <div className="bg-surface-lighter/30 border border-surface-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-surface-border pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              Oracle Cloud Always Free API Credentials
            </h3>
            <span className="text-xs text-slate-400">Found in OCI Console &gt; User Settings &gt; API Keys</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Tenancy OCID</label>
              <input
                type="text"
                placeholder="ocid1.tenancy.oc1..aaaaaaa..."
                value={config.tenancy_ocid}
                onChange={e => onChangeOci(prev => ({ ...prev, tenancy_ocid: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">User OCID</label>
              <input
                type="text"
                placeholder="ocid1.user.oc1..aaaaaaa..."
                value={config.user_ocid}
                onChange={e => onChangeOci(prev => ({ ...prev, user_ocid: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Compartment OCID</label>
              <input
                type="text"
                placeholder="ocid1.compartment.oc1.. (or same as tenancy)"
                value={config.compartment_ocid}
                onChange={e => onChangeOci(prev => ({ ...prev, compartment_ocid: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Region Identifier</label>
              <input
                type="text"
                placeholder="e.g. eu-milan-1, us-ashburn-1, eu-frankfurt-1"
                value={config.region}
                onChange={e => onChangeOci(prev => ({ ...prev, region: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">API Key Fingerprint</label>
              <input
                type="text"
                placeholder="20:3b:97:13:..."
                value={config.fingerprint}
                onChange={e => onChangeOci(prev => ({ ...prev, fingerprint: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">OCI API Private Key File Path</label>
              <input
                type="text"
                placeholder="C:\Users\You\.oci\oci_api_key.pem"
                value={config.private_key_path}
                onChange={e => onChangeOci(prev => ({ ...prev, private_key_path: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Compute Shape & Auto-Retry Feature */}
          <div className="pt-3 border-t border-surface-border/60 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="p-3 bg-surface rounded-lg border border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {config.shape} ({config.ocpus} OCPUs, {config.memory_in_gbs} GB RAM)
                  </div>
                  <div className="text-[11px] text-slate-400">Always Free Tier Cap (Ampere Arm64 Architecture)</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                $0.00 / mo
              </span>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-surface-border flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                  Auto-Retry on "Out of Capacity"
                </div>
                <div className="text-[11px] text-slate-400">
                  Loops every 60s until Oracle allocates instance
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.auto_retry_out_of_capacity}
                  onChange={e => onChangeOci(prev => ({ ...prev, auto_retry_out_of_capacity: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SSH Keypair Management Section */}
      <div className="bg-surface-lighter/30 border border-surface-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              SSH Authentication Keypair (Ed25519)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Used by CloudPress to execute bootstrap commands and manage container configs remotely.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateKey}
            disabled={isGeneratingKey}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin' : ''}`} />
            <span>Generate New Ed25519 Key</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Public Key (OpenSSH)</label>
              {config.ssh_public_key && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(config.ssh_public_key, 'pub')}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey === 'pub' ? 'Copied!' : 'Copy Public Key'}
                </button>
              )}
            </div>
            <textarea
              rows={3}
              placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... (paste or auto-generate)"
              value={config.ssh_public_key}
              onChange={e => onChangeOci(prev => ({ ...prev, ssh_public_key: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Private Key (OpenSSH PEM)</label>
              {sshPrivateKey && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(sshPrivateKey, 'priv')}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey === 'priv' ? 'Copied!' : 'Copy Private Key'}
                </button>
              )}
            </div>
            <textarea
              rows={3}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              value={sshPrivateKey}
              onChange={e => onChangeSshKey(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-surface border border-surface-border rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface/50 border border-surface-border/50 text-[11px] text-slate-400 flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            {useExistingVm
              ? 'Make sure the public key above has been added to ~/.ssh/authorized_keys on your Arm64 instance so CloudPress can connect as ubuntu.'
              : 'When creating the instance, CloudPress injects this SSH public key into Oracle Cloud instance metadata automatically.'}
          </span>
        </div>
      </div>
    </div>
  );
};
