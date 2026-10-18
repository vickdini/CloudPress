import React, { useState } from 'react';
import type { GcpConfig, GeneratedKeyPair } from '../types';
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
  Check,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Step2ServerProps {
  config: GcpConfig;
  sshPrivateKey: string;
  onChangeGcp: (updater: (prev: GcpConfig) => GcpConfig) => void;
  onChangeSshKey: (key: string) => void;
  onNext: () => void;
  onBack: () => void;
  onLog: (msg: string) => void;
}

export const Step2Server: React.FC<Step2ServerProps> = ({
  config,
  sshPrivateKey,
  onChangeGcp,
  onChangeSshKey,
  onNext,
  onBack,
  onLog,
}) => {
  const [useExistingVm, setUseExistingVm] = useState(!config.service_account_json_path);
  const [showConsoleGuide, setShowConsoleGuide] = useState(true);
  const [showServiceAccountGuide, setShowServiceAccountGuide] = useState(false);
  const [showAdvancedSsh, setShowAdvancedSsh] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isTestingSsh, setIsTestingSsh] = useState(false);
  const [sshTestStatus, setSshTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSelectingFile, setIsSelectingFile] = useState(false);

  // Region and Zone mappings for Always Free US regions
  const freeZones: Record<string, string[]> = {
    'us-central1': ['us-central1-a', 'us-central1-b', 'us-central1-c', 'us-central1-f'],
    'us-west1': ['us-west1-a', 'us-west1-b', 'us-west1-c'],
    'us-east1': ['us-east1-b', 'us-east1-c', 'us-east1-d'],
  };

  const handleRegionChange = (newRegion: 'us-central1' | 'us-west1' | 'us-east1') => {
    const defaultZone = freeZones[newRegion]?.[0] || `${newRegion}-a`;
    onChangeGcp(prev => ({
      ...prev,
      region: newRegion,
      zone: defaultZone,
    }));
  };

  const handleBrowseServiceAccount = async () => {
    try {
      setIsSelectingFile(true);
      const selected = await invoke<string | null>('select_service_account_file');
      if (selected) {
        onChangeGcp(prev => ({ ...prev, service_account_json_path: selected }));
        onLog(`[GCP Key Selected] Service account JSON: ${selected}`);
      }
    } catch (err) {
      onLog(`[GCP Key Error] Failed to select file: ${err}`);
    } finally {
      setIsSelectingFile(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      setIsGeneratingKey(true);
      const keys = await invoke<GeneratedKeyPair>('generate_ssh_key');
      onChangeGcp(prev => ({ ...prev, ssh_public_key: keys.public_key }));
      onChangeSshKey(keys.private_key);
      onLog('[Security Key] Generated fresh Ed25519 digital key with Google Cloud ubuntu username.');
    } catch (err) {
      alert(`Failed to generate SSH key: ${err}`);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleTestSsh = async () => {
    const targetIp = config.existing_vm_ip?.trim();
    if (!targetIp) {
      alert('Please enter an External IP address first.');
      return;
    }

    if (!sshPrivateKey) {
      alert('No SSH private key found. Click "Generate Key" first.');
      return;
    }

    try {
      setIsTestingSsh(true);
      setSshTestStatus(null);
      onLog(`[SSH Test] Testing secure connection to ${targetIp}:22 as user 'ubuntu'...`);

      const res = await invoke<string>('test_ssh_connection', {
        host: targetIp,
        username: 'ubuntu',
        privateKey: sshPrivateKey,
      });

      setSshTestStatus({ success: true, message: res });
      onLog(`[SSH Test SUCCESS] ${res}`);
    } catch (err) {
      const errorMsg = String(err);
      setSshTestStatus({ success: false, message: errorMsg });
      onLog(`[SSH Test FAILED] ${errorMsg}`);
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
    : Boolean(config.project_id.trim() && config.service_account_json_path.trim());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Intro Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950/40 via-surface to-surface-lighter/50 border border-blue-500/20 p-6 md:p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold mb-3">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span>Step 2 of 5: Free Cloud Server</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Google Cloud Compute Engine (Always Free)
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Google Cloud provides 1 non-preemptible <strong>e2-micro VM instance per month</strong> (2 vCPUs burstable, 1 GB memory, 30 GB standard persistent disk, 1 GB/mo outbound bandwidth) in US regions: <strong>us-central1 (Iowa), us-west1 (Oregon), or us-east1 (South Carolina)</strong>.
            </p>
          </div>

          <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center shrink-0">
            <div className="text-xs uppercase font-semibold tracking-wider">Google Cloud Free Tier</div>
            <div className="text-xl font-bold text-white">$0.00 / month</div>
            <div className="text-[11px] text-emerald-400">Always Free Eligible</div>
          </div>
        </div>
      </div>

      {/* Mode Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => {
            setUseExistingVm(true);
            onChangeGcp(prev => ({ ...prev, existing_vm_ip: prev.existing_vm_ip || '' }));
          }}
          className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden ${
            useExistingVm
              ? 'bg-surface-lighter/80 border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10'
              : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
              Recommended &bull; Fast Launch
            </span>
            <Server className={`w-5 h-5 ${useExistingVm ? 'text-blue-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-base font-bold text-white">Connect Google Cloud VM (External IP)</div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Create an Always Free <code className="text-blue-300 font-mono">e2-micro</code> in Google Cloud Console in 1 minute with 0 API credentials needed, then enter its External IP.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setUseExistingVm(false);
            onChangeGcp(prev => ({ ...prev, existing_vm_ip: undefined }));
          }}
          className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden ${
            !useExistingVm
              ? 'bg-surface-lighter/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10'
              : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              Automated API
            </span>
            <Layers className={`w-5 h-5 ${!useExistingVm ? 'text-indigo-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-base font-bold text-white">Automate via Service Account</div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Provide a Google Cloud Service Account JSON key or use local <code className="text-indigo-300 font-mono">gcloud</code> CLI to provision the VM automatically.
          </p>
        </button>
      </div>

      {/* Main Configuration Card */}
      <div className="bg-surface/80 border border-surface-border rounded-2xl p-6 md:p-8 space-y-6 backdrop-blur-sm shadow-xl">
        {/* Server Spec Summary Badge */}
        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Google Cloud Compute Engine</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                  Always Free Eligible ($0.00/mo)
                </span>
              </div>
              <div className="text-xs text-blue-300 font-medium mt-0.5">
                Machine: <strong>e2-micro (2 vCPUs burstable, 1 GB RAM + 3 GB CloudPress Swap)</strong> &bull; Disk: <strong>30 GB standard persistent disk</strong>
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-400 sm:text-right shrink-0">
            <span className="text-slate-200 font-mono">us-central1 / west1 / east1</span>
          </div>
        </div>

        {useExistingVm ? (
          /* Connect Existing VM Option */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  Connect to Your Google Cloud e2-micro VM
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter the External IP of your Google Cloud instance. CloudPress will configure Docker, WordPress, and Email on it.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowConsoleGuide(!showConsoleGuide)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{showConsoleGuide ? 'Hide 1-Minute Guide' : 'Show 1-Minute Guide'}</span>
                {showConsoleGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Visual 1-Minute Google Cloud Console Guide */}
            {showConsoleGuide && (
              <div className="p-5 rounded-xl bg-blue-950/20 border border-blue-500/30 text-xs text-slate-300 space-y-3.5 animate-in fade-in duration-200">
                <div className="font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    How to create your Free e2-micro VM in Google Cloud in 1 minute:
                  </span>
                  <a
                    href="https://console.cloud.google.com/compute/instancesAdd"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 font-semibold text-[11px] transition-colors"
                  >
                    <span>Open Google Cloud Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed">
                  <li>
                    Click the blue button above to open <strong>Create an instance</strong> in Google Cloud Console.
                  </li>
                  <li>
                    <strong>Name:</strong> Leave default or set to <code className="text-blue-300 font-mono">cloudpress-vm</code>.
                  </li>
                  <li>
                    <strong>Region:</strong> Select any of the 3 Always Free regions:
                    <span className="ml-1 text-white font-medium">us-central1 (Iowa)</span>,
                    <span className="ml-1 text-white font-medium">us-west1 (Oregon)</span>, or
                    <span className="ml-1 text-white font-medium">us-east1 (South Carolina)</span>.
                  </li>
                  <li>
                    <strong>Machine configuration:</strong> Choose Series <strong className="text-white">E2</strong> &rarr; Machine type <strong className="text-blue-300 font-mono">e2-micro (2 vCPU, 1 GB memory)</strong>.
                  </li>
                  <li>
                    <strong>Boot disk:</strong> Click <em>Change</em> &rarr; Operating system: <strong className="text-white">Ubuntu</strong> &rarr; Version: <strong className="text-white">Ubuntu 24.04 LTS (x86/64)</strong> &rarr; Boot disk type: <strong className="text-white">Standard persistent disk</strong> &rarr; Size: <strong className="text-emerald-400">30 GB</strong>. Click <em>Select</em>.
                  </li>
                  <li>
                    <strong>Firewall:</strong> Under Firewall, check both <strong className="text-white">Allow HTTP traffic</strong> and <strong className="text-white">Allow HTTPS traffic</strong>.
                  </li>
                  <li>
                    <strong>SSH Key:</strong> Expand <em>Advanced options</em> &rarr; <em>Security</em> &rarr; <em>Manage access</em> &rarr; click <strong>Add item</strong> under SSH Keys. Click the <strong>Copy Public Key</strong> button below and paste it into the box.
                  </li>
                  <li>
                    Click <strong className="text-emerald-400 font-bold">Create</strong>! When the VM starts, copy its <strong>External IP</strong> and paste it into the box below.
                  </li>
                </ol>
              </div>
            )}

            {/* External IP Input */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Google Cloud VM External IPv4 Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 34.68.120.45"
                  value={config.existing_vm_ip || ''}
                  onChange={e => onChangeGcp(prev => ({ ...prev, existing_vm_ip: e.target.value.trim() }))}
                  className="w-full px-4 py-3 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all select-text"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleTestSsh}
                  disabled={isTestingSsh || !config.existing_vm_ip}
                  className="w-full py-3 px-4 text-xs font-semibold bg-surface-lighter hover:bg-surface-border border border-surface-border text-slate-200 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Terminal className="w-4 h-4 text-blue-400" />
                  {isTestingSsh ? 'Testing Connection...' : 'Test Connection'}
                </button>
              </div>
            </div>

            {sshTestStatus && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                  sshTestStatus.success
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
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
          /* Automated Service Account Form */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Google Cloud Automated API Provisioning
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select an Always Free US region and upload your Google Cloud Service Account JSON key.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowServiceAccountGuide(!showServiceAccountGuide)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-medium transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{showServiceAccountGuide ? 'Hide Guide' : 'How to get Service Account JSON?'}</span>
                {showServiceAccountGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showServiceAccountGuide && (
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-xs text-slate-300 space-y-2.5 animate-in fade-in duration-200">
                <div className="font-bold text-white">How to create a Service Account JSON Key:</div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>In Google Cloud Console, open <strong>IAM &amp; Admin &rarr; Service Accounts</strong>.</li>
                  <li>Click <strong>Create Service Account</strong>, name it <code className="text-indigo-300">cloudpress-deployer</code>.</li>
                  <li>Grant it the role: <strong className="text-white">Compute Admin</strong>.</li>
                  <li>Click on the created service account &rarr; <strong>Keys</strong> tab &rarr; <strong>Add Key</strong> &rarr; <strong>Create new key (JSON)</strong>.</li>
                  <li>Save the JSON key file on your computer and browse for it below!</li>
                </ol>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Free Region Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span>Always Free US Region</span>
                </label>
                <select
                  value={config.region}
                  onChange={e => handleRegionChange(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="us-central1">us-central1 (Iowa, USA) - Recommended</option>
                  <option value="us-west1">us-west1 (Oregon, USA)</option>
                  <option value="us-east1">us-east1 (South Carolina, USA)</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  Google Cloud Always Free e2-micro is eligible in these 3 US regions.
                </p>
              </div>

              {/* Zone Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Zone</label>
                <select
                  value={config.zone}
                  onChange={e => onChangeGcp(prev => ({ ...prev, zone: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  {(freeZones[config.region] || []).map(z => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Datacenter zone within the selected region.
                </p>
              </div>

              {/* Project ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Google Cloud Project ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. my-cloud-project-12345"
                  value={config.project_id}
                  onChange={e => onChangeGcp(prev => ({ ...prev, project_id: e.target.value.trim() }))}
                  className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-blue-500 transition-all select-text"
                />
              </div>

              {/* Service Account JSON File Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Service Account Key (.json)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Click Browse to select your service account JSON key..."
                    value={config.service_account_json_path}
                    readOnly
                    className="flex-1 px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-slate-200 font-mono truncate focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseServiceAccount}
                    disabled={isSelectingFile}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/50 shadow-sm flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
                  >
                    <FolderOpen className="w-4 h-4 text-blue-200" />
                    <span>{isSelectingFile ? 'Browsing...' : 'Browse...'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Key (SSH) Section */}
        <div className="border-t border-surface-border/60 pt-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>Server Security Digital Key (SSH)</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {config.ssh_public_key ? 'Key Secured (user: ubuntu)' : 'Ready to Generate'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  CloudPress uses this high-security Ed25519 key to connect securely to your Google Cloud VM.
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
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin text-blue-400' : ''}`} />
                <span>{config.ssh_public_key ? 'Regenerate Key' : 'Generate Key'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdvancedSsh(!showAdvancedSsh)}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 transition-colors"
              >
                {showAdvancedSsh ? 'Hide Key' : 'View Key'}
              </button>
            </div>
          </div>

          {/* Copyable Public Key Banner */}
          {config.ssh_public_key && (
            <div className="p-3.5 rounded-xl bg-surface-lighter border border-surface-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="overflow-hidden flex-1">
                <div className="text-[11px] font-semibold text-slate-300 mb-1">
                  Public Key to Paste in Google Cloud Console:
                </div>
                <div className="font-mono text-xs text-slate-400 truncate select-text">
                  {config.ssh_public_key}
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(config.ssh_public_key, 'pubkey')}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
              >
                {copiedKey === 'pubkey' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'pubkey' ? 'Copied Public Key!' : 'Copy Public Key'}</span>
              </button>
            </div>
          )}

          {showAdvancedSsh && (
            <div className="mt-3 p-4 rounded-xl bg-surface-lighter/50 border border-surface-border space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">Public Key</label>
                  <textarea
                    rows={3}
                    readOnly
                    value={config.ssh_public_key}
                    className="w-full p-2.5 text-[10px] bg-surface border border-surface-border rounded-lg text-slate-300 font-mono select-text"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">Private Key (Ed25519)</label>
                  <textarea
                    rows={3}
                    readOnly
                    value={sshPrivateKey}
                    className="w-full p-2.5 text-[10px] bg-surface border border-surface-border rounded-lg text-slate-300 font-mono select-text"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-surface border border-surface-border hover:bg-surface-lighter transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back: Website Config</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!isFormValid}
          className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          <span>Continue: Domain &amp; Security</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
