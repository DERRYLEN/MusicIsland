import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileItem, DirectoryListing, formatFileSize, formatModifiedDate } from '../../types/explorer';
import { fetchDirectory, openInDefaultApp, loadAudioFileAsDataUrl } from '../../services/explorerService';

interface FileExplorerViewProps {
  onCollapse: () => void;
  onSwitchToMusic?: () => void;
  onSwitchToSettings?: () => void;
  onPlayAudioFile?: (filename: string, dataUrl: string) => void;
  onInteractionActivity?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico']);
const CODE_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'json', 'rs', 'html', 'css', 'toml', 'yaml', 'yml']);
const DOC_EXTENSIONS = new Set(['pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz']);

function getFileIcon(item: FileItem) {
  if (item.is_dir) {
    return '📁';
  }
  const ext = item.extension?.toLowerCase() || '';
  if (AUDIO_EXTENSIONS.has(ext)) return '🎵';
  if (IMAGE_EXTENSIONS.has(ext)) return '🖼️';
  if (CODE_EXTENSIONS.has(ext)) return '💻';
  if (DOC_EXTENSIONS.has(ext)) return '📄';
  if (ARCHIVE_EXTENSIONS.has(ext)) return '📦';
  return '📎';
}

export const FileExplorerView: React.FC<FileExplorerViewProps> = ({
  onSwitchToMusic,
  onSwitchToSettings,
  onPlayAudioFile,
  onInteractionActivity,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [playingFilePath, setPlayingFilePath] = useState<string | null>(null);

  const listContainerRef = useRef<HTMLDivElement>(null);

  const loadPath = useCallback(
    async (path?: string, isBackNavigation = false) => {
      setLoading(true);
      setErrorMsg(null);
      onInteractionActivity?.();

      try {
        const listing: DirectoryListing = await fetchDirectory(path);
        if (!isBackNavigation && currentPath && currentPath !== listing.current_path) {
          setHistory((prev) => [...prev, currentPath]);
        }
        setCurrentPath(listing.current_path);
        setParentPath(listing.parent_path);
        setItems(listing.items);
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = 0;
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Gagal mengakses direktori.');
      } finally {
        setLoading(false);
      }
    },
    [currentPath, onInteractionActivity]
  );

  useEffect(() => {
    loadPath();
  }, []);

  const handleGoBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, h.length - 1));
    loadPath(prev, true);
  };

  const handleGoUp = () => {
    if (!parentPath) return;
    loadPath(parentPath);
  };

  const handleRefresh = () => {
    loadPath(currentPath, true);
  };

  const handleItemClick = async (item: FileItem) => {
    onInteractionActivity?.();
    if (item.is_dir) {
      loadPath(item.path);
      return;
    }

    const ext = item.extension?.toLowerCase() || '';
    if (AUDIO_EXTENSIONS.has(ext)) {
      try {
        setPlayingFilePath(item.path);
        const dataUrl = await loadAudioFileAsDataUrl(item.path);
        onPlayAudioFile?.(item.name, dataUrl);
      } catch (err) {
        console.error('Gagal memutar file audio:', err);
      } finally {
        setPlayingFilePath(null);
      }
    } else {
      // Buka dengan aplikasi default Windows 11
      openInDefaultApp(item.path);
    }
  };

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInteractionActivity?.();
    if (!currentPath) return;

    navigator.clipboard.writeText(currentPath).then(() => {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1500);
    });
  };

  // Breadcrumb ringkas: ambil nama folder saat ini
  const folderName = currentPath.split(/[\\/]/).filter(Boolean).pop() || currentPath;

  return (
    <div
      className="explorer-container"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={() => onInteractionStart?.()}
      onPointerUp={() => onInteractionEnd?.()}
    >
      {/* Explorer Header */}
      <div className="explorer-header">
        <div className="explorer-nav-buttons">
          <button
            type="button"
            className="explorer-nav-btn"
            onClick={handleGoBack}
            disabled={history.length === 0}
            title="Kembali ke folder sebelumnya"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            type="button"
            className="explorer-nav-btn"
            onClick={handleGoUp}
            disabled={!parentPath}
            title="Naik satu tingkat (folder induk)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          <button
            type="button"
            className="explorer-nav-btn"
            onClick={handleRefresh}
            title="Segarkan daftar file"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>

        {/* Current Path Bar with Copy Button */}
        <div className="explorer-path-pill" title={currentPath}>
          <span className="explorer-folder-name">📁 {folderName}</span>
          <button
            type="button"
            className="explorer-copy-btn"
            onClick={handleCopyPath}
            title="Salin path folder"
          >
            {copiedPath ? (
              <span className="copied-text">Disalin!</span>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        <button
          type="button"
          className="explorer-open-system-btn"
          onClick={() => currentPath && openInDefaultApp(currentPath)}
          title="Buka folder ini di Windows File Explorer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>

        <button
          type="button"
          className="explorer-switch-tab-btn"
          onClick={() => {
            onInteractionActivity?.();
            onSwitchToMusic?.();
          }}
          title="Kembali ke Pemutar Musik"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <span>Musik</span>
        </button>

        <button
          type="button"
          className="explorer-open-system-btn"
          onClick={() => {
            onInteractionActivity?.();
            onSwitchToSettings?.();
          }}
          title="Buka Pengaturan"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Explorer List Area */}
      <div className="explorer-list-container" ref={listContainerRef}>
        {loading ? (
          <div className="explorer-empty-state">
            <div className="explorer-spinner" />
            <span>Membaca berkas...</span>
          </div>
        ) : errorMsg ? (
          <div className="explorer-empty-state error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="error-text">{errorMsg}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="explorer-empty-state">
            <span style={{ fontSize: '18px' }}>📂</span>
            <span>Folder ini kosong</span>
          </div>
        ) : (
          <div className="explorer-items-list">
            {items.map((item) => {
              const isAudio = !item.is_dir && AUDIO_EXTENSIONS.has(item.extension?.toLowerCase() || '');
              const isThisPlaying = playingFilePath === item.path;

              return (
                <div
                  key={item.path}
                  className={`explorer-item-row ${item.is_dir ? 'folder' : 'file'} ${isAudio ? 'audio' : ''}`}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.path);
                    e.dataTransfer.setData('application/json', JSON.stringify(item));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => handleItemClick(item)}
                  title={`${item.name} (${item.is_dir ? 'Folder' : formatFileSize(item.size)}) - Tarik atau klik berkas`}
                >
                  <span className="item-icon">{getFileIcon(item)}</span>
                  <div className="item-meta">
                    <span className="item-name">{item.name}</span>
                    <span className="item-sub">
                      {item.is_dir ? 'Folder' : `${formatFileSize(item.size)} · ${formatModifiedDate(item.modified_ms)}`}
                    </span>
                  </div>

                  {isAudio && (
                    <div className="item-action-badge">
                      {isThisPlaying ? (
                        <div className="explorer-mini-spinner" />
                      ) : (
                        <span className="play-badge">▶ Putar</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
