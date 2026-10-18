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
  ArrowDownToLine,
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

  const handleCopyLogs = () => {
    const raw = logs.map(l => `[${l.timestamp}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLogLineStyle = (text: string) => {
    if (text.includes('[ERROR') || text.includes('ERR]') || text.includes('FAILED') || text.includes('Error')) {
      return 'text-rose-400 bg-rose-950/20';
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
    <aside aria-label="Live Terminal Logs" className={`fixed bottom-0 left-0 right-0 z-50 bg-[#0c101a] border-t border-surface-border transition-all duration-300 shadow-2xl flex flex-col ${
      !isOpen ? 'h-10' : isExpanded ? 'h-[75vh]' : 'h-64 sm:h-80'
    }`}>
      {/* Terminal Titlebar */}
      <div
        className="h-10 px-4 bg-surface/90 border-b border-surface-border flex items-center justify-between cursor-pointer select-none"
        onClick={onToggleOpen}
      >
        <div className="flex items-center gap-2.5">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-mono flex items-center gap-2">
            Live Deployment Terminal
            <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded font-sans font-normal">
              {logs.length} events
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {isOpen && (
            <>
              {/* Search Filter */}
              <div className="relative hidden sm:block">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-36 px-2 pl-6 py-1 text-[11px] bg-surface-lighter border border-surface-border rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Auto Scroll Toggle */}
              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1.5 rounded text-xs transition-colors ${
                  autoScroll
                    ? 'text-cyan-400 bg-cyan-500/10'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>

              {/* Copy Logs */}
              <button
                type="button"
                onClick={handleCopyLogs}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-surface-lighter rounded transition-colors"
                title="Copy all logs to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Clear Logs */}
              <button
                type="button"
                onClick={onClearLogs}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-surface-lighter rounded transition-colors"
                title="Clear console output"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Expand Height */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-surface-lighter rounded transition-colors hidden sm:block"
                title={isExpanded ? 'Restore height' : 'Expand full height'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleOpen}
            className="p-1.5 text-slate-400 hover:text-white rounded"
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terminal Output Body */}
      {isOpen && (
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed selection:bg-indigo-500/30 selection:text-white space-y-0.5"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-500 italic py-8 text-center select-none">
              Console idle. Logs will stream here during provisioning, SSH execution, and DNS synchronization.
            </div>
          ) : (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className={`py-0.5 px-1.5 rounded flex items-start gap-2.5 font-mono ${getLogLineStyle(
                  log.text
                )}`}
              >
                <span className="text-slate-600 select-none text-[10px] shrink-0">
                  {log.timestamp}
                </span>
                <span className="break-all whitespace-pre-wrap">{log.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
