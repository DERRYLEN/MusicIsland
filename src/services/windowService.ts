/**
 * Window Service
 * Handles native Tauri window sizing and positioning commands.
 */
export type IslandWindowMode = 'idle' | 'compact' | 'expanded';

export async function syncNativeWindowMode(mode: IslandWindowMode): Promise<void> {
  try {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_island_state', { mode });
  } catch {
    // Graceful fallback when running in a standard web browser
  }
}
