import React, { useState, useEffect, useRef } from 'react';
import type { LogMessage } from '../types';

import {
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  Search,
  Check,
  ChevronsDown,
  Download,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface TerminalProps {
  logs: LogMessage[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onClearLogs: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({
  logs,
  isOpen,
  onToggleOpen,
  onClearLogs,
}) => {
  const [filterText, setFilterText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log =>
    log.text.toLowerCase().includes(filterText.toLowerCase())
  );

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;

  const handleCopyLogs = () => {
    const raw = logs.map(l => `[${l.timestamp}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    if (logs.length === 0) return;
    const content = logs.map(l => `[${l.timestamp}] ${l.text}`).join('\r\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    a.href = url;
    a.download = `cloudpress-deployment-logs-${timestampStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogLineStyle = (text: string) => {
    if (text.includes('[ERROR') || text.includes('ERR]') || text.includes('FAILED') || text.includes('Error')) {
      return 'text-rose-400 bg-rose-950/20';
    }
    if (text.includes('[GCP]') || text.includes('Google Cloud')) {
      return 'text-amber-300 font-semibold';
    }
    if (text.includes('[OCI]') || text.includes('Oracle')) {
      return 'text-amber-300';
    }
    if (text.includes('[Cloudflare]') || text.includes('DNS')) {
      return 'text-cyan-400';
    }
    if (text.includes('[SSH]') || text.includes('[SFTP')) {
      return 'text-indigo-300';
    }
    if (text.includes('[REMOTE]') || text.includes('[BOOTSTRAP]')) {
      return 'text-emerald-300';
    }
    if (text.includes('SUCCESS') || text.includes('SUCCESSFULLY') || text.includes('🎉') || text.includes('Ready')) {
      return 'text-emerald-400 font-semibold';
    }
    if (text.startsWith('===')) {
      return 'text-slate-500 font-bold';
    }
    return 'text-slate-300';
  };

  return (
    <aside
      aria-label="Deployment Activity Logs"
      className={`fixed bottom-0 left-0 right-0 z-50 bg-[#0b0e17] border-t border-surface-border transition-all duration-300 shadow-2xl flex flex-col ${
        !isOpen ? 'h-11' : isExpanded ? 'h-[75vh]' : 'h-64 sm:h-72'
      }`}
    >
      {/* Titlebar / Status Strip */}
      <div
        className="h-11 px-4 bg-surface/95 border-b border-surface-border flex items-center justify-between cursor-pointer select-none hover:bg-surface transition-colors"
        onClick={onToggleOpen}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <TerminalIcon className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-mono">
              Live Activity
            </span>
          </div>

          {/* Minimized ticker showing latest event */}
          {!isOpen && latestLog && (
            <div className="text-xs text-slate-400 truncate flex items-center gap-2 font-mono">
              <span className="text-slate-600 hidden sm:inline">[{latestLog.timestamp}]</span>
              <span className="truncate">{latestLog.text}</span>
            </div>
          )}

          {isOpen && (
            <span className="text-[10px] text-slate-400 bg-surface-lighter px-2 py-0.5 rounded-full font-sans font-medium">
              {logs.length} logged events
            </span>
          )}
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {isOpen && (
            <>
              {/* Search Filter */}
              <div className="relative hidden sm:block">
                <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-40 px-2 pl-7 py-1 text-[11px] bg-surface-lighter border border-surface-border rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono select-text"
                />
              </div>

              {/* Auto Scroll Toggle */}
              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  autoScroll
                    ? 'text-cyan-400 bg-cyan-500/10'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title={autoScroll ? 'Auto-scroll ON (click to pause)' : 'Auto-scroll OFF (click to resume)'}
              >
                <ChevronsDown className="w-3.5 h-3.5" />
              </button>

              {/* Download Logs */}
              <button
                type="button"
                onClick={handleDownloadLogs}
                disabled={logs.length === 0}
                className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-surface-lighter rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Download logs (.txt file)"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {/* Copy Logs */}
              <button
                type="button"
                onClick={handleCopyLogs}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-surface-lighter rounded-lg transition-colors"
                title="Copy all logs to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Clear Logs */}
              <button
                type="button"
                onClick={onClearLogs}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-surface-lighter rounded-lg transition-colors"
                title="Clear console output"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Expand Height */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-surface-lighter rounded-lg transition-colors hidden sm:block"
                title={isExpanded ? 'Restore height' : 'Expand full height'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleOpen}
            className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-surface-lighter hover:bg-surface-border rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <span className="hidden sm:inline">{isOpen ? 'Minimize' : 'View Logs'}</span>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Output Body */}
      {isOpen && (
        <div
          ref={scrollContainerRef}
          tabIndex={0}
          className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed select-text cursor-text selection:bg-indigo-600 selection:text-white space-y-0.5 outline-none"
          style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-500 italic py-8 text-center select-none">
              Console idle. Status messages will stream here in real time during deployment.
            </div>
          ) : (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className={`py-0.5 px-2 rounded flex items-start gap-2.5 font-mono select-text cursor-text ${getLogLineStyle(
                  log.text
                )}`}
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
              >
                <span
                  className="text-slate-500 font-mono text-[10px] shrink-0 select-text"
                  style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                >
                  [{log.timestamp}]
                </span>
                <span
                  className="break-all whitespace-pre-wrap select-text flex-1 cursor-text"
                  style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                >
                  {log.text}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
