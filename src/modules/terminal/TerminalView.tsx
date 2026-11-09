import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TerminalLog } from '../../types/terminal';
import { executeCommand, CommandContext } from './commandParser';
import { fetchTerminalCwd } from '../../services/terminalService';

interface TerminalViewProps {
  context: CommandContext;
  onSwitchToMusic: () => void;
  onInteractionActivity?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  context,
  onSwitchToMusic,
  onInteractionActivity,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [logs, setLogs] = useState<TerminalLog[]>([
    {
      id: 'init-1',
      text: 'MusicIsland Windows Command Prompt Terminal v0.1.0',
      type: 'success',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
    {
      id: 'init-2',
      text: "Mendukung seluruh perintah CMD Windows & perintah internal. Ketik 'help'.",
      type: 'info',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputVal, setInputVal] = useState<string>('');
  const [currentCwd, setCurrentCwd] = useState<string>('C:\\');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ambil CWD awal sistem
  useEffect(() => {
    fetchTerminalCwd().then((dir) => {
      if (dir) setCurrentCwd(dir);
    });
  }, []);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-focus input saat terminal dimuat
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleExecute = useCallback(async () => {
    const raw = inputVal.trim();
    if (!raw) return;

    onInteractionActivity?.();

    const timestamp = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const commandLog: TerminalLog = {
      id: `cmd-${Date.now()}`,
      text: `${currentCwd}> ${raw}`,
      type: 'command',
      timestamp,
    };

    // Tambah ke riwayat perintah
    setHistory((prev) => [...prev, raw]);
    setHistoryIndex(-1);
    setInputVal('');

    const res = await executeCommand(raw, context);
    if (res.newCwd) {
      setCurrentCwd(res.newCwd);
    }

    if (res.shouldClear) {
      setLogs([]);
    } else {
      setLogs((prev) => [...prev, commandLog, ...res.logs]);
    }
  }, [inputVal, currentCwd, context, onInteractionActivity]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onInteractionActivity?.();

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputVal(history[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex < history.length) {
        setHistoryIndex(nextIndex);
        setInputVal(history[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  const shortCwd = currentCwd.split(/[\\/]/).filter(Boolean).pop() || currentCwd;

  return (
    <div
      className="terminal-container"
      onClick={(e) => {
        e.stopPropagation();
        inputRef.current?.focus();
      }}
      onPointerDown={() => onInteractionStart?.()}
      onPointerUp={() => onInteractionEnd?.()}
    >
      {/* Terminal Header */}
      <div className="terminal-header">
        <div className="terminal-title-group">
          <span className="terminal-prompt-dot" />
          <span className="terminal-header-title">MusicIsland Terminal</span>
          <span className="terminal-badge">Windows CMD</span>
        </div>

        <div className="terminal-actions">
          <button
            type="button"
            className="terminal-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              onInteractionActivity?.();
              setLogs([]);
            }}
            title="Bersihkan layar terminal (clear)"
          >
            Clear
          </button>

          <button
            type="button"
            className="terminal-switch-tab-btn"
            onClick={(e) => {
              e.stopPropagation();
              onInteractionActivity?.();
              onSwitchToMusic();
            }}
            title="Kembali ke Pemutar Musik"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span>Musik</span>
          </button>
        </div>
      </div>

      {/* Terminal Logs Output */}
      <div className="terminal-output-scroll" ref={outputRef}>
        {logs.map((log) => (
          <div key={log.id} className={`terminal-log-row ${log.type}`}>
            <span className="log-time">{log.timestamp}</span>
            <span className="log-text">{log.text}</span>
          </div>
        ))}
      </div>

      {/* Terminal Input Line */}
      <div className="terminal-input-row" onClick={(e) => e.stopPropagation()}>
        <span className="terminal-prompt-label" title={currentCwd}>
          {shortCwd} &gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => {
            onInteractionActivity?.();
            setInputVal(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => onInteractionStart?.()}
          onBlur={() => onInteractionEnd?.()}
          placeholder="Ketik perintah CMD (mis: 9router, dir, ipconfig)..."
          className="terminal-input"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="button"
          className="terminal-exec-btn"
          onClick={handleExecute}
          title="Eksekusi perintah (Enter)"
        >
          Kirim
        </button>
      </div>
    </div>
  );
};

