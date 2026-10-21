import React, { useState, useEffect } from 'react';
import type { GcpConfig, GeneratedKeyPair, GoogleAuthResult, GoogleProject } from '../types';
import {
  Server,
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
  LogOut,
  User,
  Globe,
  Settings,
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
  // Determine active mode: "oauth" (default & recommended), "service_account", or "existing"
  const [authMode, setAuthMode] = useState<'oauth' | 'service_account' | 'existing'>(
    config.auth_mode || (config.existing_vm_ip ? 'existing' : config.service_account_json_path ? 'service_account' : 'oauth')
  );

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [projects, setProjects] = useState<GoogleProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [showManualProjectId, setShowManualProjectId] = useState(false);

  const [showConsoleGuide, setShowConsoleGuide] = useState(false);
  const [showServiceAccountGuide, setShowServiceAccountGuide] = useState(false);
  const [showAdvancedSsh, setShowAdvancedSsh] = useState(false);
  const [showOAuthSettings, setShowOAuthSettings] = useState(false);
  const [customClientId, setCustomClientId] = useState(config.custom_oauth_client_id || '');
  const [customClientSecret, setCustomClientSecret] = useState(config.custom_oauth_client_secret || '');
  const [pastedJson, setPastedJson] = useState(config.service_account_json_content || '');

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

  const loadGoogleProjects = React.useCallback(
    async (token: string) => {
      try {
        setIsLoadingProjects(true);
        const projs = await invoke<GoogleProject[]>('list_google_projects', { accessToken: token });
        setProjects(projs);
        if (projs.length > 0 && !config.project_id) {
          onChangeGcp(prev => ({ ...prev, project_id: projs[0].project_id }));
        }
      } catch (err) {
        onLog(`[GCP Notice] Could not list projects automatically: ${err}. You can enter Project ID manually.`);
        setShowManualProjectId(true);
      } finally {
        setIsLoadingProjects(false);
      }
    },
    [config.project_id, onChangeGcp, onLog]
  );

  // Auto-fetch Google Cloud projects if user already has an active token
  useEffect(() => {
    let isMounted = true;
    if (config.oauth_access_token) {
      invoke<GoogleProject[]>('list_google_projects', { accessToken: config.oauth_access_token })
        .then(projs => {
          if (isMounted && projs && projs.length > 0) {
            setProjects(projs);
          }
        })
        .catch(() => {
          if (isMounted) {
            setShowManualProjectId(true);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [config.oauth_access_token]);

  // Google OAuth Login
  const handleGoogleSignIn = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      onLog('[Google OAuth] Opening default browser for Google Cloud authorization...');

      const authResult = await invoke<GoogleAuthResult>('start_google_oauth', {
        customClientId: customClientId.trim() || null,
        customClientSecret: customClientSecret.trim() || null,
      });

      onChangeGcp(prev => ({
        ...prev,
        auth_mode: 'oauth',
        oauth_access_token: authResult.access_token,
        oauth_refresh_token: authResult.refresh_token || prev.oauth_refresh_token,
        oauth_user_email: authResult.user_email,
        oauth_user_name: authResult.user_name || prev.oauth_user_name,
        oauth_user_picture: authResult.user_picture || prev.oauth_user_picture,
        custom_oauth_client_id: customClientId.trim() || undefined,
        custom_oauth_client_secret: customClientSecret.trim() || undefined,
      }));

      onLog(`[Google Cloud Connected] Signed in as ${authResult.user_email}`);
      await loadGoogleProjects(authResult.access_token);
    } catch (err) {
      const errorMsg = String(err);
      setAuthError(errorMsg);
      onLog(`[Google OAuth Failed] ${errorMsg}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDisconnectGoogle = () => {
    onChangeGcp(prev => ({
      ...prev,
      oauth_access_token: undefined,
      oauth_refresh_token: undefined,
      oauth_user_email: undefined,
      oauth_user_name: undefined,
      oauth_user_picture: undefined,
    }));
    setProjects([]);
    onLog('[Google OAuth] Disconnected from Google account.');
  };

  const handleBrowseServiceAccount = async () => {
    try {
      setIsSelectingFile(true);
      const selected = await invoke<string | null>('select_service_account_file');
      if (selected) {
        onChangeGcp(prev => ({
          ...prev,
          service_account_json_path: selected,
          auth_mode: 'service_account',
        }));
        onLog(`[GCP Key Selected] Service account JSON: ${selected}`);
      }
    } catch (err) {
      onLog(`[GCP Key Error] Failed to select file: ${err}`);
    } finally {
      setIsSelectingFile(false);
    }
  };

  const handlePasteServiceAccountJson = (text: string) => {
    setPastedJson(text);
    onChangeGcp(prev => ({
      ...prev,
      service_account_json_content: text.trim() ? text : undefined,
      auth_mode: 'service_account',
    }));

    // Auto-extract project_id if valid JSON
    try {
      const parsed = JSON.parse(text);
      if (parsed.project_id) {
        onChangeGcp(prev => ({ ...prev, project_id: parsed.project_id }));
        onLog(`[GCP Key Auto-Detected] Project ID: ${parsed.project_id}`);
      }
    } catch {
      // not full json yet
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

  // Form validity check based on active mode
  const isFormValid =
    authMode === 'oauth'
      ? Boolean(config.oauth_access_token && config.project_id && config.project_id.trim().length > 0)
      : authMode === 'service_account'
      ? Boolean(
          (config.service_account_json_path || config.service_account_json_content) &&
            config.project_id &&
            config.project_id.trim().length > 0
        )
      : Boolean(config.existing_vm_ip && config.existing_vm_ip.trim().length > 6);

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

      {/* 3 Mode Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tab 1: Sign in with Google (OAuth) */}
        <button
          type="button"
          onClick={() => {
            setAuthMode('oauth');
            onChangeGcp(prev => ({ ...prev, auth_mode: 'oauth', existing_vm_ip: undefined }));
          }}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
            authMode === 'oauth'
              ? 'bg-surface-lighter/90 border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10'
              : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Recommended • 1-Click</span>
            </span>
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-1 shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
          </div>
          <div className="text-sm font-bold text-white">Sign In with Google</div>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
            Grant access in browser. CloudPress creates the VM and opens firewalls completely hands-off.
          </p>
        </button>

        {/* Tab 2: Service Account JSON */}
        <button
          type="button"
          onClick={() => {
            setAuthMode('service_account');
            onChangeGcp(prev => ({ ...prev, auth_mode: 'service_account', existing_vm_ip: undefined }));
          }}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
            authMode === 'service_account'
              ? 'bg-surface-lighter/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10'
              : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              Service Key
            </span>
            <Shield className={`w-5 h-5 ${authMode === 'service_account' ? 'text-indigo-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-sm font-bold text-white">Service Account JSON</div>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
            Provide a Google Cloud Service Account JSON key file or paste JSON text directly.
          </p>
        </button>

        {/* Tab 3: Connect Existing VM */}
        <button
          type="button"
          onClick={() => {
            setAuthMode('existing');
            onChangeGcp(prev => ({
              ...prev,
              auth_mode: 'existing',
              existing_vm_ip: prev.existing_vm_ip || '',
            }));
          }}
          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
            authMode === 'existing'
              ? 'bg-surface-lighter/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/10'
              : 'bg-surface/60 border-surface-border hover:bg-surface-lighter/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Manual IP
            </span>
            <Server className={`w-5 h-5 ${authMode === 'existing' ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-sm font-bold text-white">Connect Existing VM</div>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
            Already have an active Google Cloud instance? Just paste its External IPv4 address.
          </p>
        </button>
      </div>

      {/* Main Configuration Card */}
      <div className="bg-surface/80 border border-surface-border rounded-2xl p-6 md:p-8 space-y-6 backdrop-blur-sm shadow-xl">
        {/* Specification Summary Badge */}
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
                Machine: <strong>e2-micro (2 vCPUs burstable, 1 GB RAM + 2 GB CloudPress Swap)</strong> &bull; Disk: <strong>30 GB standard persistent disk</strong>
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-400 sm:text-right shrink-0">
            <span className="text-slate-200 font-mono">Ports 80, 443, 22, 25, 587, 993 auto-opened</span>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MODE 1: SIGN IN WITH GOOGLE (OAUTH 2.0) */}
        {/* ------------------------------------------------------------- */}
        {authMode === 'oauth' && (
          <div className="space-y-6">
            {!config.oauth_access_token ? (
              /* Signed Out State */
              <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-950/30 to-surface-lighter/60 border border-blue-500/30 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-white flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>

                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-lg font-bold text-white">Give Access via Google Sign-In</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Click below to authorize CloudPress in your browser. CloudPress will automatically create your Always Free e2-micro instance, attach security keys, open ports, and handle all deployment steps for you.
                  </p>
                </div>

                <div className="pt-2 flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isAuthenticating}
                    className="px-6 py-3.5 rounded-xl font-bold text-sm text-slate-900 bg-white hover:bg-slate-100 shadow-xl shadow-blue-500/10 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isAuthenticating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Waiting for Browser Authorization...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Sign In with Google</span>
                      </>
                    )}
                  </button>

                  {isAuthenticating && (
                    <p className="text-[11px] text-cyan-300 animate-pulse">
                      A browser window has opened. Please log in with your Google Account and click "Allow".
                    </p>
                  )}
                </div>

                {authError && (
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs text-left max-w-lg mx-auto flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Optional Custom OAuth Client Toggle */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowOAuthSettings(!showOAuthSettings)}
                    className="text-[11px] text-slate-400 hover:text-slate-300 inline-flex items-center gap-1 transition-colors"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Custom Google OAuth Client ID (Optional)</span>
                    {showOAuthSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showOAuthSettings && (
                    <div className="mt-3 p-4 rounded-xl bg-surface border border-surface-border text-left max-w-lg mx-auto space-y-3 animate-in fade-in duration-200">
                      <p className="text-[11px] text-slate-400">
                        By default, CloudPress uses the official Google Cloud desktop credentials. If you prefer to use your own OAuth Client ID from Google Cloud Console, enter it here:
                      </p>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-300">OAuth Client ID</label>
                        <input
                          type="text"
                          placeholder="e.g. 123456789-xyz.apps.googleusercontent.com"
                          value={customClientId}
                          onChange={e => setCustomClientId(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-surface-lighter border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-blue-500 select-text"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-300">OAuth Client Secret (Required if custom Client ID)</label>
                        <input
                          type="password"
                          placeholder="Enter client secret if using your own Client ID"
                          value={customClientSecret}
                          onChange={e => setCustomClientSecret(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-surface-lighter border border-surface-border rounded-lg text-white font-mono focus:outline-none focus:border-blue-500 select-text"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Signed In State */
              <div className="space-y-5">
                {/* User Connection Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-surface-lighter/60 to-surface border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {config.oauth_user_picture ? (
                      <img
                        src={config.oauth_user_picture}
                        alt="Profile"
                        className="w-10 h-10 rounded-full border border-blue-400/40 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{config.oauth_user_name || 'Google Cloud Account'}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Connected</span>
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 font-mono mt-0.5">
                        {config.oauth_user_email}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-surface hover:bg-surface-border border border-surface-border flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-400" />
                    <span>Switch Account / Sign Out</span>
                  </button>
                </div>

                {/* Project and Region Pickers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Google Cloud Project Selection */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        <span>Google Cloud Project</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowManualProjectId(!showManualProjectId)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {showManualProjectId ? 'Select from list' : 'Type manually'}
                      </button>
                    </div>

                    {showManualProjectId || projects.length === 0 ? (
                      <input
                        type="text"
                        placeholder="e.g. my-gcp-project-12345"
                        value={config.project_id}
                        onChange={e => onChangeGcp(prev => ({ ...prev, project_id: e.target.value.trim() }))}
                        className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-blue-500 transition-all select-text"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={config.project_id}
                          onChange={e => onChangeGcp(prev => ({ ...prev, project_id: e.target.value }))}
                          disabled={isLoadingProjects}
                          className="w-full px-3.5 py-2.5 text-xs bg-surface-lighter border border-surface-border rounded-xl text-white font-mono focus:outline-none focus:border-blue-500 transition-all cursor-pointer truncate pr-8"
                        >
                          {projects.map(p => (
                            <option key={p.project_id} value={p.project_id}>
                              {p.name} ({p.project_id})
                            </option>
                          ))}
                        </select>
                        {isLoadingProjects && (
                          <div className="absolute right-3 top-3">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400">
                      The project where your Always Free e2-micro instance will be created.
                    </p>
                  </div>

                  {/* Free Region Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
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
                      Eligible for Google Cloud Always Free tier ($0.00/month).
                    </p>
                  </div>

                  {/* Datacenter Zone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Datacenter Zone</label>
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
                  </div>

                  {/* Automated Process Summary */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Automated Pipeline</label>
                    <div className="px-3.5 py-2.5 text-xs bg-surface-lighter/60 border border-surface-border/60 rounded-xl text-slate-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>VM, 30GB disk, and ports 80, 443, 22, 25, 587, 993 auto-provisioned</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 2: SERVICE ACCOUNT JSON KEY */}
        {/* ------------------------------------------------------------- */}
        {authMode === 'service_account' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Google Cloud Automated Service Account Key
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select an Always Free region and upload or paste your Service Account JSON key.
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
              </div>

              {/* Project ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Google Cloud Project ID</label>
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
                <label className="text-xs font-semibold text-slate-300">Service Account Key (.json file)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Click Browse to select your service account JSON..."
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

            {/* Alternative: Paste JSON Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Or Paste Service Account JSON Content directly:</label>
              <textarea
                rows={3}
                placeholder='Paste the contents of your Google Cloud service account JSON file here: {"type": "service_account", ...}'
                value={pastedJson}
                onChange={e => handlePasteServiceAccountJson(e.target.value)}
                className="w-full p-2.5 text-[11px] bg-surface-lighter border border-surface-border rounded-xl text-slate-200 font-mono focus:outline-none focus:border-blue-500 select-text"
              />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 3: CONNECT EXISTING VM (EXTERNAL IP) */}
        {/* ------------------------------------------------------------- */}
        {authMode === 'existing' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  Connect to Your Google Cloud e2-micro VM
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter the External IP of your Google Cloud instance. CloudPress will configure Docker, WordPress, and Email on it.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowConsoleGuide(!showConsoleGuide)}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-medium transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{showConsoleGuide ? 'Hide 1-Minute Guide' : 'Show 1-Minute Guide'}</span>
                {showConsoleGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showConsoleGuide && (
              <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-slate-300 space-y-3.5 animate-in fade-in duration-200">
                <div className="font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    How to create your Free e2-micro VM in Google Cloud in 1 minute:
                  </span>
                  <a
                    href="https://console.cloud.google.com/compute/instancesAdd"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 font-semibold text-[11px] transition-colors"
                  >
                    <span>Open Google Cloud Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed">
                  <li>Click the button above to open <strong>Create an instance</strong> in Google Cloud Console.</li>
                  <li><strong>Region:</strong> Select any of the 3 Always Free regions: <strong>us-central1, us-west1, or us-east1</strong>.</li>
                  <li><strong>Machine configuration:</strong> Choose Series <strong>E2</strong> &rarr; Machine type <strong>e2-micro (2 vCPU, 1 GB memory)</strong>.</li>
                  <li><strong>Boot disk:</strong> Ubuntu 24.04 LTS (x86/64), Standard persistent disk, 30 GB.</li>
                  <li><strong>Firewall:</strong> Allow HTTP &amp; HTTPS traffic.</li>
                  <li><strong>SSH Key:</strong> In Advanced options &rarr; Security &rarr; Add SSH Key, paste the Public Key generated below.</li>
                  <li>Click <strong>Create</strong>, copy the External IP, and paste it below.</li>
                </ol>
              </div>
            )}

            {/* External IP Input */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-semibold text-slate-300">Google Cloud VM External IPv4 Address</label>
                <input
                  type="text"
                  placeholder="e.g. 34.68.120.45"
                  value={config.existing_vm_ip || ''}
                  onChange={e => onChangeGcp(prev => ({ ...prev, existing_vm_ip: e.target.value.trim() }))}
                  className="w-full px-4 py-3 text-sm bg-surface-lighter border border-surface-border rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all select-text"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleTestSsh}
                  disabled={isTestingSsh || !config.existing_vm_ip}
                  className="w-full py-3 px-4 text-xs font-semibold bg-surface-lighter hover:bg-surface-border border border-surface-border text-slate-200 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Terminal className="w-4 h-4 text-emerald-400" />
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
        )}

        {/* ------------------------------------------------------------- */}
        {/* Security Key (SSH) Section (Shared across all modes) */}
        {/* ------------------------------------------------------------- */}
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
                  {authMode === 'oauth'
                    ? 'Automatically attached to your new Google Cloud VM during automated provisioning.'
                    : 'CloudPress uses this high-security Ed25519 key to connect securely to your Google Cloud VM.'}
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
                  Public Key (auto-injected into VM):
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
          className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
        >
          <span>Continue: Domain &amp; Security</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
