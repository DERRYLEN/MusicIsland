import { SystemStats, EMPTY_SYSTEM_STATS } from '../types/monitor';

async function getTauriInvoke() {
  try {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

export async function fetchSystemStats(): Promise<SystemStats> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    return EMPTY_SYSTEM_STATS;
  }

  try {
    return await invoke<SystemStats>('get_system_stats');
  } catch (err) {
    console.warn('Gagal memanggil get_system_stats:', err);
    return EMPTY_SYSTEM_STATS;
  }
}
