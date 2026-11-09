async function getTauriInvoke() {
  try {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

export async function syncWindowPreferences(alwaysOnTop: boolean, yOffset: number): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('update_window_preferences', {
      alwaysOnTop,
      yOffset,
    });
  } catch (err) {
    console.warn('Gagal sinkronisasi window preferences:', err);
  }
}
