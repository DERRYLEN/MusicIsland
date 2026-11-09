import React from 'react';
import { IslandModuleContext } from '../../types/island';
import { useMediaSession } from '../../hooks/useMediaSession';
import { ClockState, useClock } from '../../hooks/useClock';
import { MusicCompact } from './MusicCompact';
import { MusicExpanded } from './MusicExpanded';

interface MusicModuleViewProps extends IslandModuleContext {
  clock?: ClockState;
}

export const MusicModuleView: React.FC<MusicModuleViewProps> = ({
  isExpanded,
  onCollapse,
  clock,
}) => {
  const systemClock = useClock();
  const activeClock = clock || systemClock;

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

  if (!isExpanded) {
    return <MusicCompact mediaState={mediaState} status={status} clock={activeClock} />;
  }

  return (
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
      onCollapse={onCollapse}
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
    />
  );
};
