export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_ms: number;
  extension: string | null;
}

export interface DirectoryListing {
  current_path: string;
  parent_path: string | null;
  items: FileItem[];
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatModifiedDate(ms: number): string {
  if (ms === 0) return '';
  const d = new Date(ms);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
