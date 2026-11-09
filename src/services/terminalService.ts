import { AppInfo, CmdResult } from '../types/terminal';

async function getTauriInvoke() {
  try {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

export async function fetchAppInfo(): Promise<AppInfo> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    return {
      name: 'MusicIsland',
      version: '0.1.0',
      uptime_seconds: Math.floor(performance.now() / 1000),
    };
  }

  try {
    return await invoke<AppInfo>('get_app_info');
  } catch {
    return {
      name: 'MusicIsland',
      version: '0.1.0',
      uptime_seconds: Math.floor(performance.now() / 1000),
    };
  }
}

export async function fetchTerminalCwd(): Promise<string> {
  const invoke = await getTauriInvoke();
  if (!invoke) return 'C:\\';

  try {
    return await invoke<string>('get_terminal_cwd');
  } catch {
    return 'C:\\';
  }
}

export async function runSystemCmd(command: string): Promise<CmdResult> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    return {
      stdout: '',
      stderr: 'Tauri native API tidak tersedia di browser.',
      exit_code: 1,
      cwd: 'C:\\',
    };
  }

  try {
    return await invoke<CmdResult>('execute_system_cmd', { command });
  } catch (err: any) {
    return {
      stdout: '',
      stderr: String(err?.message || err),
      exit_code: 1,
      cwd: 'C:\\',
    };
  }
}
