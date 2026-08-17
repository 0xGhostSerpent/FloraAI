import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  Key,
  LogIn,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Sun,
  Trash2,
  Upload,
  UserCheck,
  UserCircle2,
  UserPlus,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { FloraUser } from '../firebase';
import {
  AI_PROVIDERS,
  supportsVision,
  providerInfo,
  type AiProvider,
  type ConnectionResult,
} from '../services/ai';
import type { StorageBackend } from '../types/flora';
import ErrorCard from '../components/ErrorCard';

const THEMES = [
  {
    id: 'theme-minimalist',
    name: 'Emerald Botanical',
    subtitle: 'Crisp Natural Editorial (Light)',
    desc: 'Pure clean whites with vivid forest emerald and botanical typography.',
    palette: ['#FFFFFF', '#F4F7F5', '#059669', '#0F172A'],
    icon: Sun,
  },
  {
    id: 'theme-cyber',
    name: 'Midnight Forest',
    subtitle: 'Deep Slate & Luminescent Jade (Dark)',
    desc: 'Deep slate darkness with luminescent jade mint and crisp slate contrast.',
    palette: ['#090D0B', '#131A16', '#10B981', '#F8FAFC'],
    icon: Moon,
  },
  {
    id: 'theme-gamified',
    name: 'Nordic Terracotta',
    subtitle: 'Warm Clay & Earthen Amber (Warm)',
    desc: 'Scandinavian earthy minimalism with terracotta clay and amber warmth.',
    palette: ['#C2410C', '#D97706', '#FAF6F0', '#1C1917'],
    icon: Palette,
  },
];

type Props = {
  apiKey: string;
  aiModel: string;
  aiProvider: AiProvider;
  aiBaseUrl: string;
  availableModels: string[];
  isLoadingModels: boolean;
  modelError: string | null;
  appTheme: string;
  keyStoreError: string | null;
  keyIsSaved: boolean;
  savedProviders: AiProvider[];
  storageBackend: StorageBackend;
  connectionResult: ConnectionResult | null;
  isTestingConnection: boolean;
  isOnline: boolean;
  currentUser: FloraUser | null;
  authConfigured: boolean;
  authError: string | null;
  isSigningIn: boolean;
  driveSyncing?: boolean;
  lastDriveSync?: number | null;
  driveSyncError?: string | null;
  onSyncDrive?: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onEmailSignIn: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string) => Promise<void>;
  onInstantSignIn: () => Promise<void>;
  onSaveGoogleClientId: (clientId: string) => Promise<void>;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onChangeApiKey: (value: string) => void;
  onSaveApiKey: () => void;
  onChangeAiModel: (value: string) => void;
  onChangeAiProvider: (value: AiProvider) => void;
  onChangeAiBaseUrl: (value: string) => void;
  onRefreshModels: () => void;
  onTestConnection: () => void;
  onChangeTheme: (theme: string) => void;
  onReset: () => void;
};

export default function SettingsScreen({
  apiKey,
  aiModel,
  aiProvider,
  aiBaseUrl,
  availableModels,
  isLoadingModels,
  modelError,
  appTheme,
  keyStoreError,
  keyIsSaved,
  savedProviders,
  storageBackend,
  connectionResult,
  isTestingConnection,
  isOnline,
  currentUser,
  authConfigured,
  authError,
  isSigningIn,
  driveSyncing = false,
  lastDriveSync = null,
  driveSyncError = null,
  onSyncDrive,
  onSignIn,
  onSignOut,
  onEmailSignIn,
  onEmailSignUp,
  onInstantSignIn,
  onSaveGoogleClientId,
  onExportBackup,
  onImportBackup,
  onChangeApiKey,
  onSaveApiKey,
  onChangeAiModel,
  onChangeAiProvider,
  onChangeAiBaseUrl,
  onRefreshModels,
  onTestConnection,
  onChangeTheme,
  onReset,
}: Props) {
  const provider = providerInfo(aiProvider);
  const modelLacksVision = Boolean(aiModel) && !supportsVision(aiModel, aiProvider);

  // Email login state
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [authMode, setAuthMode] = useState<'instant' | 'email' | 'google'>('instant');
  const [googleClientIdInput, setGoogleClientIdInput] = useState('');
  const [isSavingClientId, setIsSavingClientId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSyncTime = (timestamp?: number | null) => {
    if (!timestamp) return 'Never synced';
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-5 pb-24 space-y-6 pt-2"
    >
      {/* 1. Theme Engine */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2">
          <Palette size={14} /> Application Aesthetics &amp; Themes
        </h3>
        <div className="space-y-2.5">
          {THEMES.map((theme) => {
            const isSelected = appTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => onChangeTheme(theme.id)}
                className={`w-full text-left p-4 rounded-[var(--radius-dynamic)] dynamic-border transition-all flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-bg-card border-2 border-[var(--color-accent)] dynamic-shadow ring-2 ring-[var(--color-accent)]/20'
                    : 'bg-bg-card opacity-80 hover:opacity-100 hover:brightness-105'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? 'bg-[var(--color-accent)] text-bg-main shadow-md'
                          : 'bg-bg-main text-text-muted dynamic-border'
                      }`}
                    >
                      <theme.icon size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-text-main leading-tight">{theme.name}</h4>
                      <p className="text-[11px] text-text-muted">{theme.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {theme.palette.map((color, idx) => (
                        <span
                          key={idx}
                          className="w-4 h-4 rounded-full border border-black/20 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    {isSelected && (
                      <CheckCircle2 size={18} className="text-[var(--color-accent)] shrink-0 ml-1" />
                    )}
                  </div>
                </div>

                <p className="text-xs text-text-muted leading-relaxed pl-12">{theme.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Cloud Account & Garden Sync */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2">
          <UserCircle2 size={14} /> Cloud Account &amp; Data Sync
        </h3>
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 space-y-4 shadow-sm">
          {currentUser ? (
            <>
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="w-11 h-11 rounded-full dynamic-border shadow-sm" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center font-bold">
                    {currentUser.isAnonymous ? '⚡' : currentUser.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-main truncate">
                    {currentUser.isAnonymous ? 'Instant Cloud Profile' : currentUser.displayName || currentUser.email || 'Flora User'}
                  </p>
                  <p className="text-xs text-text-muted truncate font-medium">
                    {currentUser.isAnonymous ? `Cloud ID: ${currentUser.uid.slice(0, 10)}…` : currentUser.email}
                  </p>
                </div>
              </div>

              {/* Cloud Sync Active Box */}
              <div className="bg-bg-main dynamic-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud size={17} className="text-[var(--color-accent)]" />
                    <span className="text-xs font-bold text-text-main">Cloud Garden Sync</span>
                  </div>
                  <span className="text-[10px] font-bold text-green-500 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    Active &amp; Synced
                  </span>
                </div>

                <p className="text-[11px] text-text-muted leading-relaxed">
                  Your garden plants, daily check-in photos, care streaks, and botanical chats are backed up safely to the cloud.
                </p>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-text-muted">
                    Last sync: <span className="text-text-main font-semibold">{formatSyncTime(lastDriveSync)}</span>
                  </span>
                  <button
                    onClick={onSyncDrive}
                    disabled={driveSyncing}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--color-accent)] text-bg-main font-bold text-[11px] hover:brightness-110 shadow-sm active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={driveSyncing ? 'animate-spin' : ''} />
                    {driveSyncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                </div>

                {driveSyncError && (
                  <p className="text-[11px] text-red-500 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 leading-tight">
                    {driveSyncError}
                  </p>
                )}
              </div>

              {/* Backup Export / Import */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="p-2.5 rounded-xl bg-bg-main dynamic-border hover:brightness-105 text-xs font-bold text-text-main flex items-center justify-center gap-1.5 transition-all"
                >
                  <Download size={14} className="text-[var(--color-accent)]" /> Export (.json)
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-bg-main dynamic-border hover:brightness-105 text-xs font-bold text-text-main flex items-center justify-center gap-1.5 transition-all"
                >
                  <Upload size={14} className="text-[var(--color-accent)]" /> Import Backup
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <button
                onClick={onSignOut}
                className="w-full bg-bg-main text-text-muted border border-text-muted/20 py-2.5 rounded-xl font-bold text-xs hover:text-red-500 hover:border-red-500/30 transition-colors"
              >
                Sign out of Cloud Account
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-text-muted leading-relaxed font-medium">
                Connect a cloud account to automatically backup and sync your entire plant collection and chats across your devices.
              </p>

              {/* Switcher */}
              <div className="grid grid-cols-3 p-1 bg-bg-main rounded-xl border border-text-muted/15 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAuthMode('instant')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    authMode === 'instant'
                      ? 'bg-[var(--color-accent)] text-bg-main shadow-sm'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <Zap size={13} /> Instant
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('google')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    authMode === 'google'
                      ? 'bg-[var(--color-accent)] text-bg-main shadow-sm'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('email')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    authMode === 'email'
                      ? 'bg-[var(--color-accent)] text-bg-main shadow-sm'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <UserPlus size={13} /> Email
                </button>
              </div>

              {authMode === 'instant' ? (
                <div className="space-y-3">
                  <div className="bg-bg-main dynamic-border rounded-xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-text-main flex items-center gap-1.5">
                      <Zap size={15} className="text-[var(--color-accent)]" /> Instant Cloud Profile
                    </p>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Sync all your plants and chats to the cloud immediately with one click. No password or registration needed!
                    </p>
                  </div>

                  <button
                    onClick={() => void onInstantSignIn()}
                    disabled={isSigningIn}
                    className="w-full bg-[var(--color-accent)] text-bg-main py-3.5 rounded-xl font-bold text-sm hover:brightness-110 shadow-md transition-all disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Zap size={16} />
                    {isSigningIn ? 'Connecting to Cloud…' : 'Start Instant Cloud Account'}
                  </button>
                </div>
              ) : authMode === 'google' ? (
                <div className="space-y-3">
                  <div className="bg-bg-main dynamic-border rounded-xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-text-main flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" width="15" height="15"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Google Account
                    </p>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Sign in with your Google account to sync your plant collection to Google Drive. A secure in-app window will open for authentication.
                    </p>
                  </div>

                  {!authConfigured ? (
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-text-main">Google OAuth Client ID</label>
                        <input
                          type="text"
                          value={googleClientIdInput}
                          onChange={(e) => setGoogleClientIdInput(e.target.value)}
                          placeholder="123456789.apps.googleusercontent.com"
                          className="w-full bg-bg-main border border-text-muted/20 rounded-lg px-3 py-2.5 text-xs text-text-main font-mono focus:outline-none focus:border-[var(--color-accent)]"
                        />
                      </div>
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        Create a Desktop OAuth Client ID at{' '}
                        <button
                          type="button"
                          onClick={() => void window.flora.openExternal('https://console.cloud.google.com/apis/credentials')}
                          className="text-[var(--color-accent)] hover:underline font-semibold"
                        >
                          Google Cloud Console → Credentials
                        </button>
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsSavingClientId(true);
                          await onSaveGoogleClientId(googleClientIdInput.trim());
                          setGoogleClientIdInput('');
                          setIsSavingClientId(false);
                        }}
                        disabled={!googleClientIdInput.trim().includes('.apps.googleusercontent.com') || isSavingClientId}
                        className="w-full bg-[var(--color-accent)] text-bg-main py-3 rounded-xl font-bold text-xs hover:brightness-110 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        <Save size={14} />
                        {isSavingClientId ? 'Saving…' : 'Save Client ID & Enable Google Sign-In'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent)] font-semibold">
                        <CheckCircle2 size={12} /> Google OAuth configured
                      </div>
                      <button
                        onClick={onSignIn}
                        disabled={isSigningIn}
                        className="w-full bg-white text-[#3c4043] border border-[#dadce0] py-3.5 rounded-xl font-semibold text-sm hover:bg-[#f8f9fa] shadow-sm transition-all disabled:opacity-40 flex items-center justify-center gap-3 active:scale-95"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        {isSigningIn ? 'Signing in with Google…' : 'Sign in with Google'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1 text-xs">
                    <label className="text-[11px] font-bold text-text-main">Email Address</label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="w-full bg-bg-main border border-text-muted/20 rounded-lg px-3 py-2.5 text-xs text-text-main focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="text-[11px] font-bold text-text-main">Password</label>
                    <input
                      type="password"
                      value={passInput}
                      onChange={(e) => setPassInput(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full bg-bg-main border border-text-muted/20 rounded-lg px-3 py-2.5 text-xs text-text-main focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void onEmailSignIn(emailInput, passInput)}
                      disabled={isSigningIn || !emailInput.trim() || !passInput.trim()}
                      className="py-3 rounded-xl bg-[var(--color-accent)] text-bg-main font-bold text-xs hover:brightness-110 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <LogIn size={14} /> Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => void onEmailSignUp(emailInput, passInput)}
                      disabled={isSigningIn || !emailInput.trim() || !passInput.trim()}
                      className="py-3 rounded-xl bg-bg-main border border-[var(--color-accent)]/30 text-text-main font-bold text-xs hover:bg-bg-card active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <UserPlus size={14} className="text-[var(--color-accent)]" /> Create Account
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Backup Options */}
              <div className="pt-2 border-t border-text-muted/10 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="p-2.5 rounded-xl bg-bg-main dynamic-border hover:brightness-105 text-xs font-bold text-text-muted hover:text-text-main flex items-center justify-center gap-1.5 transition-all"
                >
                  <Download size={13} /> Export (.json)
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-bg-main dynamic-border hover:brightness-105 text-xs font-bold text-text-muted hover:text-text-main flex items-center justify-center gap-1.5 transition-all"
                >
                  <Upload size={13} /> Import Backup
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}
          {authError && <ErrorCard message={authError} onRetry={() => {}} />}
        </div>
      </div>

      {/* 3. AI Provider & Models */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2">
          <Key size={14} /> AI Intelligence Provider
        </h3>
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 space-y-4 shadow-sm">
          <p className="text-xs text-text-muted leading-relaxed font-medium">
            Flora AI automatically auto-detects keys for Google Gemini, Groq, OpenAI, and OpenRouter.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {AI_PROVIDERS.map((candidate) => {
              const isActive = candidate.id === aiProvider;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => onChangeAiProvider(candidate.id)}
                  className={`p-3 rounded-xl dynamic-border text-left transition-all flex flex-col gap-1 ${
                    isActive
                      ? 'bg-bg-main border-2 border-[var(--color-accent)] shadow-sm'
                      : 'bg-bg-main/60 hover:bg-bg-main opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-text-main">{candidate.name}</span>
                    {savedProviders.includes(candidate.id) && (
                      <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" title="Key saved" />
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted truncate">{candidate.preferredModels[0] || 'Default'}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-main flex items-center justify-between">
              <span>{provider.name} API Key</span>
              {provider.keyUrl && (
                <button
                  type="button"
                  onClick={() => void window.flora.openExternal(provider.keyUrl!)}
                  className="text-[11px] text-[var(--color-accent)] font-semibold flex items-center gap-1 hover:underline"
                >
                  Get Key <ExternalLink size={10} />
                </button>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => onChangeApiKey(e.target.value)}
                placeholder="Enter API Key"
                className="flex-1 bg-bg-main border border-text-muted/20 rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:border-[var(--color-accent)] font-mono"
              />
              <button
                type="button"
                onClick={onSaveApiKey}
                disabled={!apiKey.trim()}
                className="px-4 bg-[var(--color-accent)] text-bg-main rounded-xl font-bold text-xs hover:brightness-110 shadow-sm active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                <Save size={14} /> Save
              </button>
            </div>
            {keyIsSaved && (
              <p className="text-[11px] text-[var(--color-accent)] font-semibold flex items-center gap-1 pt-1">
                <CheckCircle2 size={12} /> Key saved securely in OS Keychain ({storageBackend})
              </p>
            )}
            {keyStoreError && <p className="text-[11px] text-red-500">{keyStoreError}</p>}
          </div>

          {aiProvider === 'custom' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-main">Custom Endpoint URL</label>
              <input
                type="text"
                value={aiBaseUrl}
                onChange={(e) => onChangeAiBaseUrl(e.target.value)}
                placeholder="https://your-custom-llm.com/v1"
                className="w-full bg-bg-main border border-text-muted/20 rounded-xl px-3.5 py-2.5 text-xs text-text-main font-mono focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          )}

          {/* Model selector */}
          <div className="space-y-2 pt-2 border-t border-text-muted/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-main">Vision &amp; Identification Model</label>
              <button
                type="button"
                onClick={onRefreshModels}
                disabled={isLoadingModels || !apiKey.trim()}
                className="text-[11px] text-text-muted hover:text-text-main flex items-center gap-1 font-semibold disabled:opacity-40"
              >
                <RefreshCw size={11} className={isLoadingModels ? 'animate-spin' : ''} /> Refresh Models
              </button>
            </div>

            {availableModels.length > 0 ? (
              <select
                value={aiModel}
                onChange={(e) => onChangeAiModel(e.target.value)}
                className="w-full bg-bg-main border border-text-muted/20 rounded-xl px-3 py-2.5 text-xs text-text-main font-mono focus:outline-none focus:border-[var(--color-accent)]"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={aiModel}
                onChange={(e) => onChangeAiModel(e.target.value)}
                placeholder={provider.preferredModels[0] || 'Default Model'}
                className="w-full bg-bg-main border border-text-muted/20 rounded-xl px-3.5 py-2.5 text-xs text-text-main font-mono focus:outline-none focus:border-[var(--color-accent)]"
              />
            )}

            {modelLacksVision && (
              <p className="text-[11px] text-amber-500 leading-tight">
                ⚠️ Selected model might not support vision/photos. Pick a vision-capable model if scans fail.
              </p>
            )}
            {modelError && <p className="text-[11px] text-red-500">{modelError}</p>}
          </div>

          <button
            type="button"
            onClick={onTestConnection}
            disabled={isTestingConnection || !apiKey.trim() || !isOnline}
            className="w-full bg-bg-main dynamic-border py-3 rounded-xl font-bold text-xs text-text-main hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <RefreshCw size={13} className={isTestingConnection ? 'animate-spin' : ''} />
            {isTestingConnection ? 'Testing Connection…' : 'Test AI Connection'}
          </button>

          {connectionResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                connectionResult.ok
                  ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                  : 'bg-red-500/10 text-red-600 border border-red-500/20'
              }`}
            >
              {connectionResult.ok ? (
                <>
                  <CheckCircle2 size={15} />
                  <span>
                    Connection verified ({connectionResult.models} models available, {connectionResult.elapsedMs}ms)
                  </span>
                </>
              ) : (
                <span>{connectionResult.message || 'Connection failed'}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Danger Zone */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
          <Trash2 size={14} /> Data Reset
        </h3>
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 space-y-3">
          <p className="text-xs text-text-muted leading-relaxed">
            Wipe all local plant records, chat histories, streaks, and stored keys from this computer.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 py-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={14} /> Reset Flora AI Local Data
          </button>
        </div>
      </div>
    </motion.div>
  );
}
