import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Volume2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { openExternalUrl, playSuccessChime } from '../utils';

export interface CompletionNotificationData {
  title: string;
  message: string;
  domain: string;
  timestamp: string;
}

interface NotificationToastProps {
  notification: CompletionNotificationData | null;
  onClose: () => void;
  autoCloseDuration?: number; // ms, default 15000
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  autoCloseDuration = 15000,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) return;

    setProgress(100);
    const intervalTime = 100;
    const step = (intervalTime / autoCloseDuration) * 100;

    const timer = setInterval(() => {
      if (!isPaused) {
        setProgress(prev => {
          if (prev <= step) {
            clearInterval(timer);
            onClose();
            return 0;
          }
          return prev - step;
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [notification, isPaused, autoCloseDuration, onClose]);

  if (!notification) return null;

  const siteUrl = `https://${notification.domain}`;
  const adminUrl = `https://${notification.domain}/wp-admin`;

  return (
    <aside
      aria-label="Deployment status notification"
      className="fixed top-5 right-5 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl bg-[#0b1120]/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl shadow-emerald-950/60 text-slate-100 p-4 sm:p-5 space-y-3.5 ring-1 ring-emerald-500/20">
        {/* Glow effect in background */}
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Header with Icon, Title, and Close */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/30 shrink-0">
              <div className="w-full h-full bg-[#0b1120] rounded-[11px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  {notification.title}
                </h4>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {notification.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 relative z-10">
          <button
            type="button"
            onClick={() => openExternalUrl(siteUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Visit Website</span>
          </button>

          <button
            type="button"
            onClick={() => openExternalUrl(adminUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all active:scale-95"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>WP Admin</span>
          </button>

          <button
            type="button"
            onClick={() => playSuccessChime()}
            className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 rounded-xl transition-colors ml-auto"
            title="Replay success chime"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar Timer */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/60">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </aside>
  );
};
