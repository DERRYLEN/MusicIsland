import React, { useEffect, useCallback, useState } from 'react';
import { useClock } from '../hooks/useClock';
import { useMediaSession } from '../hooks/useMediaSession';
import { useIslandState } from '../hooks/useIslandState';
import { useSettings } from '../hooks/useSettings';
import { MusicCompact } from '../modules/music/MusicCompact';
import { MusicExpanded } from '../modules/music/MusicExpanded';
import { FileExplorerView } from '../modules/explorer/FileExplorerView';
import { SettingsView } from '../modules/settings/SettingsView';
import { TerminalView } from '../modules/terminal/TerminalView';
import { TurboOverboostView } from '../modules/monitor/TurboOverboostView';
import './DynamicIsland.css';

export const DynamicIsland: React.FC = () => {
  const clock = useClock();
  const { settings, updateSetting, resetToDefaults } = useSettings();
  const [activeModule, setActiveModule] = useState<'music' | 'explorer' | 'settings' | 'terminal' | 'overboost'>('music');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const {
    mediaState,
    status,
    currentPositionMs,
    volume,
    isMuted,
    isRepeat,
    isShuffle,
    musicSource,
    setMusicSource,
    localTracks,
    currentTrackIndex,
    loadLocalFiles,
    playAudioFromExplorer,
    handleTogglePlay,
    handleNext,
    handlePrev,
    handleToggleRepeat,
    handleToggleShuffle,
    handleSetVolume,
    handleSeekPosition,
    handleToggleMute,
    handleOpenOutputSettings,
    handleLaunchMusicApp,
  } = useMediaSession();

  // Active music determines whether island is in music mode or idle clock bar mode
  const hasActiveMusic = mediaState.available && mediaState.is_playing;
  const {
    isExpanded,
    currentMode,
    expand,
    collapse,
    setIsHovered,
    resetStandbyTimer,
    handleInteractionStart,
    handleInteractionEnd,
  } = useIslandState(hasActiveMusic, settings.autoStandby, settings.standbyDelaySeconds);

  // Drag & drop berkas langsung ke Dynamic Island
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
    resetStandbyTimer();
  }, [resetStandbyTimer]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    resetStandbyTimer();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadLocalFiles(e.dataTransfer.files);
      expand();
      setActiveModule('music');
    }
  }, [loadLocalFiles, expand, resetStandbyTimer]);

  // Reset panel modul kembali ke pemutar musik saat island menyusut
  useEffect(() => {
    if (!isExpanded) {
      const timer = setTimeout(() => {
        setActiveModule('music');
      }, 420);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // Global keyboard shortcuts (Escape to close) & Auto-pause on unload
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        e.preventDefault();
        e.stopPropagation();
        collapse();
      } else if (isExpanded) {
        resetStandbyTimer();
      }
    };

    const handleBeforeUnload = () => {
      try {
        // @ts-ignore
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('media_pause_sync');
        });
      } catch {}
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isExpanded, collapse, resetStandbyTimer]);

  const handleIslandClick = useCallback(() => {
    if (!isExpanded) {
      expand();
    }
  }, [isExpanded, expand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (!isExpanded) {
          e.preventDefault();
          expand();
        }
      }
    },
    [isExpanded, expand]
  );

  return (
    <div className="island-wrapper">
      <div
        className={`dynamic-island ${currentMode} ${isDraggingOver ? 'drag-over' : ''}`}
        onClick={!isExpanded ? handleIslandClick : undefined}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerMove={resetStandbyTimer}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role={isExpanded ? 'region' : 'button'}
        tabIndex={0}
        aria-label={
          isExpanded
            ? 'MusicIsland Control Panel'
            : currentMode === 'idle'
            ? `Laptop Clock: ${clock.fullTime}`
            : 'MusicIsland Player Notch'
        }
        aria-expanded={isExpanded}
      >
        {isDraggingOver ? (
          /* DRAG & DROP OVERLAY */
          <div className="island-drop-overlay">
            <span className="drop-icon">📥</span>
            <span className="drop-text">Lepaskan berkas lagu di sini untuk memutar</span>
          </div>
        ) : isExpanded ? (
          activeModule === 'overboost' ? (
            /* TURBO OVERBOOST SYSTEM MONITOR PANEL */
            <TurboOverboostView
              settings={settings}
              onSwitchToMusic={() => setActiveModule('music')}
              onInteractionActivity={resetStandbyTimer}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
            />
          ) : activeModule === 'terminal' ? (
            /* TERMINAL CLI PANEL */
            <TerminalView
              context={{
                mediaState,
                musicSource,
                currentMode,
                settings,
                localTracksCount: localTracks.length,
              }}
              onSwitchToMusic={() => setActiveModule('music')}
              onInteractionActivity={resetStandbyTimer}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
            />
          ) : activeModule === 'settings' ? (
            /* SETTINGS PANEL */
            <SettingsView
              settings={settings}
              onUpdateSetting={updateSetting}
              onResetSettings={resetToDefaults}
              onSwitchToMusic={() => setActiveModule('music')}
              onInteractionActivity={resetStandbyTimer}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
            />
          ) : activeModule === 'explorer' ? (
            /* FILE EXPLORER PANEL */
            <FileExplorerView
              onCollapse={collapse}
              onSwitchToMusic={() => setActiveModule('music')}
              onSwitchToSettings={() => setActiveModule('settings')}
              onPlayAudioFile={(name, dataUrl) => {
                playAudioFromExplorer(name, dataUrl);
                setActiveModule('music');
              }}
              onInteractionActivity={resetStandbyTimer}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
            />
          ) : (
            /* EXPANDED MUSIC PLAYER PANEL */
            <MusicExpanded
              mediaState={mediaState}
              currentPositionMs={currentPositionMs}
              volume={volume}
              isMuted={isMuted}
              isRepeat={isRepeat}
              isShuffle={isShuffle}
              musicSource={musicSource}
              localTracksCount={localTracks.length}
              currentTrackIndex={currentTrackIndex}
              onSelectSource={setMusicSource}
              onLoadLocalFiles={loadLocalFiles}
              onSwitchToExplorer={() => setActiveModule('explorer')}
              onSwitchToSettings={() => setActiveModule('settings')}
              onSwitchToTerminal={() => setActiveModule('terminal')}
              onSwitchToOverboost={() => setActiveModule('overboost')}
              onCollapse={collapse}
              onTogglePlay={handleTogglePlay}
              onNext={handleNext}
              onPrev={handlePrev}
              onToggleRepeat={handleToggleRepeat}
              onToggleShuffle={handleToggleShuffle}
              onSetVolume={handleSetVolume}
              onSeekPosition={handleSeekPosition}
              onToggleMute={handleToggleMute}
              onOpenOutputSettings={handleOpenOutputSettings}
              onLaunchSpotify={() => handleLaunchMusicApp('spotify')}
              onInteractionActivity={resetStandbyTimer}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
            />
          )
        ) : currentMode === 'compact' ? (
          /* COMPACT MUSIC MODE: Dynamic Island notch with adapted clock & music */
          <MusicCompact mediaState={mediaState} status={status} clock={clock} />
        ) : (
          /* IDLE STANDBY NOTCH (Image #27) */
          <div className="idle-standby-container" title={`Waktu Laptop: ${clock.fullTime} · ${clock.dayName}`}>
            <span className="standby-time">{clock.time}</span>
            <span className="standby-divider">|</span>
            <div className="standby-status">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="standby-moon-icon"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span className="standby-status-text">Standby</span>
            </div>
            <span className="standby-divider">|</span>
            <span className="standby-day">{clock.dayName}</span>
          </div>
        )}
      </div>
    </div>
  );
};
