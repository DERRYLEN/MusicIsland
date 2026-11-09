export interface AppInfo {
  name: string;
  version: string;
  uptime_seconds: number;
}

export interface CmdResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  cwd: string;
}

export type OutputType = 'info' | 'success' | 'warning' | 'error' | 'command';

export interface TerminalLog {
  id: string;
  text: string;
  type: OutputType;
  timestamp: string;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d} hari`);
  if (h > 0) parts.push(`${h} jam`);
  if (m > 0) parts.push(`${m} menit`);
  parts.push(`${s} detik`);

  return parts.join(' ');
}
