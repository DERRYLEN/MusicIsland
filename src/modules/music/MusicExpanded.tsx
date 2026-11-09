import React, { useState, useRef, useCallback } from 'react';
import { MediaState, MusicSource } from '../../types/media';

interface MusicExpandedProps {
  mediaState: MediaState;
  currentPositionMs: number;
  volume: number;
  isMuted: boolean;
  isRepeat: boolean;
  isShuffle: boolean;
  musicSource?: MusicSource;
  localTracksCount?: number;
  currentTrackIndex?: number;
  onSelectSource?: (source: MusicSource) => void;
  onLoadLocalFiles?: (files: FileList | File[]) => void;
  onSwitchToExplorer?: () => void;
  onSwitchToSettings?: () => void;
  onSwitchToTerminal?: () => void;
  onSwitchToOverboost?: () => void;
  onCollapse: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
  onSetVolume: (vol: number) => void;
  onSeekPosition: (posMs: number) => void;
  onToggleMute: () => void;
  onOpenOutputSettings: () => void;
  onLaunchSpotify: () => void;
  onInteractionActivity?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const MusicExpanded: React.FC<MusicExpandedProps> = ({
  mediaState,
  currentPositionMs,
  volume,
  isMuted,
  isRepeat,
  isShuffle,
  musicSource = 'spotify',
  localTracksCount = 0,
  currentTrackIndex = 0,
  onSelectSource,
  onLoadLocalFiles,
  onSwitchToExplorer,
  onSwitchToSettings,
  onSwitchToTerminal,
  onSwitchToOverboost,
  onCollapse,
  onTogglePlay,
  onNext,
  onPrev,
  onToggleRepeat,
  onToggleShuffle,
  onSetVolume,
  onSeekPosition,
  onToggleMute,
  onOpenOutputSettings,
  onLaunchSpotify,
  onInteractionActivity,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPositionMs, setScrubPositionMs] = useState<number>(0);
  const [isVolumeDragging, setIsVolumeDragging] = useState<boolean>(false);

  const progressTrackRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasMedia = mediaState.available;
  const isPlaying = hasMedia && mediaState.is_playing;
  const isLocal = musicSource === 'local';

  const defaultTitle = isLocal ? 'Musik Lokal' : 'Spotify Standby';
  const defaultArtist = isLocal
    ? 'Buka Berkas untuk memutar audio'
    : 'Buka Spotify untuk memutar musik';

  const title = hasMedia ? mediaState.title : defaultTitle;
  const artist = hasMedia ? mediaState.artist : defaultArtist;

  const displayPositionMs = isScrubbing ? scrubPositionMs : currentPositionMs;
  const currentSeconds = Math.floor(displayPositionMs / 1000);
  const durationSeconds = Math.floor(mediaState.duration_ms / 1000);
  const progressPercent =
    durationSeconds > 0 ? Math.min(100, (currentSeconds / durationSeconds) * 100) : 0;
  const remainingSeconds =
    durationSeconds > currentSeconds ? durationSeconds - currentSeconds : 0;

  const currentDisplayVolume = isMuted ? 0 : volume;

  // --- Smooth Immediate Volume Drag ---
  const handleVolumePointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      onInteractionActivity?.();
      if (!volumeTrackRef.current) return;
      const rect = volumeTrackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      onSetVolume(percentage);
    },
    [onSetVolume, onInteractionActivity]
  );

  const handleVolumePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onInteractionStart?.();
    setIsVolumeDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handleVolumePointer(e);
  };

  const handleVolumePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVolumeDragging) return;
    handleVolumePointer(e);
  };

  const handleVolumePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isVolumeDragging) {
      setIsVolumeDragging(false);
      onInteractionEnd?.();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
    }
  };

  // --- Smooth Immediate Progress Scrubber ---
  const handleProgressPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      onInteractionActivity?.();
      if (!progressTrackRef.current || mediaState.duration_ms <= 0) return;
      const rect = progressTrackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const targetMs = Math.round(percentage * mediaState.duration_ms);
      setScrubPositionMs(targetMs);
      return targetMs;
    },
    [mediaState.duration_ms, onInteractionActivity]
  );

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!hasMedia || mediaState.duration_ms <= 0) return;
    onInteractionStart?.();
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const targetMs = handleProgressPointer(e);
    if (targetMs !== undefined) {
      onSeekPosition(targetMs);
    }
  };

  const handleProgressPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    handleProgressPointer(e);
  };

  const handleProgressPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      const targetMs = handleProgressPointer(e);
      if (targetMs !== undefined) {
        onSeekPosition(targetMs);
      }
      setIsScrubbing(false);
      onInteractionEnd?.();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInteractionActivity?.();
    if (isLocal && localTracksCount === 0) {
      onInteractionStart?.();
      fileInputRef.current?.click();
    } else if (!hasMedia && !isLocal) {
      onLaunchSpotify();
    } else {
      onTogglePlay();
    }
  };

  return (
    <div
      className="expanded-inner"
      onClick={(e) => {
        e.stopPropagation();
        onCollapse();
      }}
      role="region"
      title="Klik di mana saja untuk mengecilkan notch (atau tekan Esc)"
    >
      {/* Top row: Track Info & Unified Glass Header Dock */}
      <div className="expanded-top">
        <div className="expanded-meta">
          <div
            className={`expanded-cover ${!hasMedia ? 'idle' : ''} ${isLocal ? 'local-cover' : ''}`}
            aria-hidden="true"
          >
            {hasMedia && mediaState.cover_data_url ? (
              <img
                src={mediaState.cover_data_url}
                alt=""
                className="expanded-cover-img"
                loading="eager"
              />
            ) : (
              <div className="vinyl-cover-disc">
                <div className="vinyl-ring-groove" />
                <svg viewBox="0 0 24 24" className="expanded-fallback-icon">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
          </div>
          <div className="track-text">
            <span className="track-title" title={title}>{title}</span>
            <span className="track-artist" title={artist}>{artist}</span>
          </div>
        </div>

        <div className="expanded-header-right">
          {/* Animated Waveform Pill saat musik sedang aktif */}
          {hasMedia && (
            <div
              className={`expanded-wave-pill ${isLocal ? 'local-wave' : ''} ${!isPlaying ? 'paused' : ''}`}
              aria-hidden="true"
              title={isPlaying ? 'Musik sedang berputar' : 'Musik dijeda'}
            >
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
            </div>
          )}

          {/* Unified Glass Island Dock: File Explorer, Turbo Overboost, Terminal CLI, Settings */}
          <div className="island-header-dock" role="toolbar" aria-label="Navigasi Fitur MusicIsland">
            <button
              type="button"
              className="dock-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onInteractionActivity?.();
                onSwitchToExplorer?.();
              }}
              title="File Explorer (Jelajahi Berkas & Audio)"
              aria-label="Buka File Explorer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            <button
              type="button"
              className="dock-icon-btn overboost-btn"
              onClick={(e) => {
                e.stopPropagation();
                onInteractionActivity?.();
                onSwitchToOverboost?.();
              }}
              title="Turbo Overboost (Monitor CPU & RAM)"
              aria-label="Buka Turbo Overboost"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.9 17.55 11 21 11 21z" />
              </svg>
            </button>

            <button
              type="button"
              className="dock-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onInteractionActivity?.();
                onSwitchToTerminal?.();
              }}
              title="Terminal CLI (Windows CMD)"
              aria-label="Buka Terminal CLI"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </button>

            <button
              type="button"
              className="dock-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onInteractionActivity?.();
                onSwitchToSettings?.();
              }}
              title="Pengaturan MusicIsland"
              aria-label="Buka Pengaturan"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Middle row: Interactive Capsule Progress Bar & Time */}
      <div
        className="expanded-progress-section"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`progress-bar-container ${hasMedia ? 'interactive' : ''}`}
          ref={progressTrackRef}
          onPointerDown={handleProgressPointerDown}
          onPointerMove={handleProgressPointerMove}
          onPointerUp={handleProgressPointerUp}
          title={hasMedia ? 'Geser untuk melompati waktu lagu' : undefined}
        >
          <div className="progress-track">
            <div
              className={`progress-fill ${isLocal ? 'cyan-glow' : 'green-glow'} ${isScrubbing ? 'no-transition' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="progress-time">
          <span>{formatTime(currentSeconds)}</span>
          <span>{durationSeconds > 0 ? `-${formatTime(remainingSeconds)}` : '--:--'}</span>
        </div>
      </div>

      {/* Bottom row: Controls & App Source Selector */}
      <div
        className="expanded-controls-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Source Selector: Spotify vs Local Music */}
        <div className="source-pill-group">
          <button
            type="button"
            className={`source-tab-btn ${musicSource === 'spotify' ? 'active-spotify' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onInteractionActivity?.();
              onSelectSource?.('spotify');
            }}
            title="Pilih Sumber: Spotify"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.495 17.302c-.216.353-.674.466-1.027.25-2.812-1.718-6.352-2.107-10.523-1.155-.403.092-.806-.16-.898-.563-.092-.403.16-.806.563-.898 4.568-1.044 8.486-.596 11.635 1.339.353.216.466.674.25 1.027zm1.467-3.262c-.272.441-.853.582-1.294.31-3.22-1.979-8.128-2.55-11.936-1.393-.497.151-1.023-.133-1.174-.63-.151-.497.133-1.023.63-1.174 4.354-1.321 9.774-.683 13.464 1.583.441.272.582.853.31 1.294zm.126-3.41c-3.86-2.292-10.228-2.503-13.896-1.389-.59.18-1.218-.155-1.398-.745-.18-.59.155-1.218.745-1.398 4.218-1.28 11.246-1.034 15.688 1.602.531.315.706 1.004.391 1.535-.315.531-1.004.706-1.535.391z" />
            </svg>
            <span>Spotify</span>
          </button>

          <button
            type="button"
            className={`source-tab-btn ${musicSource === 'local' ? 'active-local' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onInteractionActivity?.();
              onSelectSource?.('local');
            }}
            title="Pilih Sumber: Musik Lokal"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span>Lokal</span>
          </button>

          {isLocal && (
            <button
              type="button"
              className="pick-files-btn"
              onClick={(e) => {
                e.stopPropagation();
                onInteractionStart?.();
                fileInputRef.current?.click();
              }}
              title="Pilih File Musik Laptop (.mp3, .wav, .ogg, .m4a, .flac)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              <span>{localTracksCount > 0 ? `${currentTrackIndex + 1}/${localTracksCount}` : 'Pilih'}</span>
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onLoadLocalFiles?.(e.target.files);
              }
              onInteractionEnd?.();
              e.target.value = '';
            }}
          />
        </div>

        {/* Center Playback Controls Group */}
        <div className="expanded-center-controls">
          {/* Shuffle */}
          <button
            type="button"
            className={`control-btn secondary-btn ${isShuffle ? 'active-green' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onInteractionActivity?.();
              onToggleShuffle();
            }}
            disabled={!hasMedia}
            title={isShuffle ? 'Acak Lagu: Aktif' : 'Acak Lagu: Nonaktif'}
            aria-label="Acak lagu"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </button>

          {/* Previous */}
          <button
            type="button"
            className="control-btn primary-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onInteractionActivity?.();
              onPrev();
            }}
            disabled={!hasMedia}
            title="Lagu Sebelumnya"
            aria-label="Lagu sebelumnya"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2.5v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play / Pause (Always Perfect Circle) */}
          <button
            type="button"
            className="control-btn play-pause-apple"
            onClick={handlePlayClick}
            title={isPlaying ? 'Jeda' : 'Putar'}
            aria-label={isPlaying ? 'Jeda musik' : 'Putar musik'}
          >
            {isPlaying ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ marginLeft: '2px' }}
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            type="button"
            className="control-btn primary-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onInteractionActivity?.();
              onNext();
            }}
            disabled={!hasMedia}
            title="Lagu Berikutnya"
            aria-label="Lagu berikutnya"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM15.5 6h2.5v12h-2.5z" />
            </svg>
          </button>

          {/* Repeat */}
          <button
            type="button"
            className={`control-btn secondary-btn ${isRepeat ? 'active-green' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onInteractionActivity?.();
              onToggleRepeat();
            }}
            disabled={!hasMedia}
            title={isRepeat ? 'Ulangi Lagu: Aktif' : 'Ulangi Lagu: Nonaktif'}
            aria-label="Ulangi lagu"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        </div>

        {/* Right Output & Volume Group */}
        <div className="expanded-right-controls">
          {/* Cast / Output Screen */}
          <button
            type="button"
            className="control-btn secondary-btn"
            onClick={(e) => {
              e.stopPropagation();
              onInteractionActivity?.();
              onOpenOutputSettings();
            }}
            title="Buka Pengaturan Output Audio & Cast (Windows 11)"
            aria-label="Pengaturan output audio"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v2h10v-2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
              <polygon points="12,12 8,16 16,16" />
            </svg>
          </button>

          {/* Volume & Mute Control with Smooth Drag */}
          <div className="volume-group" title={`Volume: ${Math.round(currentDisplayVolume * 100)}%`}>
            <button
              type="button"
              className="volume-speaker-btn"
              onClick={(e) => {
                e.stopPropagation();
                onInteractionActivity?.();
                onToggleMute();
              }}
              title={isMuted || volume === 0 ? 'Batal Bisukan Suara' : 'Bisukan Suara'}
              aria-label="Bisukan suara"
            >
              {isMuted || volume === 0 ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="volume-icon muted">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="volume-icon">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            <div
              className={`mini-volume-track ${isVolumeDragging ? 'active-dragging' : ''}`}
              ref={volumeTrackRef}
              onPointerDown={handleVolumePointerDown}
              onPointerMove={handleVolumePointerMove}
              onPointerUp={handleVolumePointerUp}
              role="slider"
              aria-valuenow={Math.round(currentDisplayVolume * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              title={`Volume: ${Math.round(currentDisplayVolume * 100)}% (Klik atau geser)`}
            >
              <div
                className={`mini-volume-fill ${isVolumeDragging ? 'no-transition' : ''}`}
                style={{ width: `${currentDisplayVolume * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

