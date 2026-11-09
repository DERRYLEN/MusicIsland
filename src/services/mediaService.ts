import { MediaState, EMPTY_MEDIA_STATE } from '../types/media';

async function getTauriInvoke() {
  try {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

export async function fetchMediaState(): Promise<MediaState> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    return EMPTY_MEDIA_STATE;
  }

  try {
    const state = await invoke<MediaState>('get_media_state');
    return state;
  } catch (err) {
    console.error('Error fetching media state:', err);
    return EMPTY_MEDIA_STATE;
  }
}

export async function togglePlayPause(): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('media_toggle_play_pause');
  } catch (err) {
    console.error('Error toggling play/pause:', err);
  }
}

export async function skipNext(): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('media_next');
  } catch (err) {
    console.error('Error skipping next:', err);
  }
}

export async function skipPrevious(): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('media_prev');
  } catch (err) {
    console.error('Error skipping previous:', err);
  }
}

export async function setMediaRepeat(enable: boolean): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('media_set_repeat', { enable });
  } catch (err) {
    console.error('Error setting repeat:', err);
  }
}

export async function setMediaShuffle(enable: boolean): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('media_set_shuffle', { enable });
  } catch (err) {
    console.error('Error setting shuffle:', err);
  }
}

export async function fetchSystemVolume(): Promise<number> {
  const invoke = await getTauriInvoke();
  if (!invoke) return 0.7;

  try {
    return await invoke<number>('get_system_volume');
  } catch {
    return 0.7;
  }
}

export async function updateSystemVolume(level: number): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('set_system_volume', { level });
  } catch (err) {
    console.error('Error setting volume:', err);
  }
}

export async function toggleSystemMute(): Promise<boolean> {
  const invoke = await getTauriInvoke();
  if (!invoke) return false;

  try {
    return await invoke<boolean>('toggle_system_mute');
  } catch {
    return false;
  }
}

export async function openAudioOutputSettings(): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('open_output_settings');
  } catch (err) {
    console.error('Error opening output settings:', err);
  }
}

export async function seekPlaybackPosition(positionMs: number): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('media_seek_position', { positionMs: Math.round(positionMs) });
  } catch (err) {
    console.error('Error seeking position:', err);
  }
}

export async function launchMusicApp(appType: 'spotify' | 'youtube'): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke('launch_music_app', { appType });
  } catch (err) {
    console.error('Error launching music app:', err);
  }
}
