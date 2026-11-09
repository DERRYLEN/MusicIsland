import { DirectoryListing } from '../types/explorer';

async function getTauriInvoke() {
  try {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

export async function fetchDirectory(targetPath?: string): Promise<DirectoryListing> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    throw new Error('Tauri API tidak tersedia di browser.');
  }

  return await invoke<DirectoryListing>('list_directory', {
    targetPath: targetPath || null,
  });
}

export async function openInDefaultApp(targetPath: string): Promise<void> {
  const invoke = await getTauriInvoke();
  if (!invoke) return;

  await invoke('open_in_system', { targetPath });
}

export async function loadAudioFileAsDataUrl(filePath: string): Promise<string> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    throw new Error('Tauri API tidak tersedia di browser.');
  }

  return await invoke<string>('read_audio_base64', { filePath });
}
