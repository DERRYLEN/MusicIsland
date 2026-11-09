import React from 'react';
import { MediaState, MediaStatus } from '../../types/media';
import { ClockState } from '../../hooks/useClock';

interface MusicCompactProps {
  mediaState: MediaState;
  status: MediaStatus;
  clock: ClockState;
}

export const MusicCompact: React.FC<MusicCompactProps> = ({ mediaState, status, clock }) => {
  const hasMedia = mediaState.available;
  const isPlaying = hasMedia && mediaState.is_playing;

  const title = hasMedia
    ? mediaState.title
    : status === 'loading'
    ? 'Memuat Media...'
    : 'Tidak Ada Media';

  return (
    <div
      className="compact-standby-container"
      title={hasMedia ? `${mediaState.title} - ${mediaState.artist} (${clock.time})` : title}
    >
      {/* 1. Digital Clock (Left) */}
      <span className="standby-time">{clock.time}</span>

      {/* Separator */}
      <span className="standby-divider">|</span>

      {/* 2. Track Name & Mini Cover (Center) */}
      <div className="compact-music-center">
        <div
          className={`compact-mini-cover ${!hasMedia ? 'idle' : ''} ${mediaState.source_app === 'Lokal' ? 'local-cover' : ''}`}
          aria-hidden="true"
        >
          {hasMedia && mediaState.cover_data_url ? (
            <img
              src={mediaState.cover_data_url}
              alt=""
              className="compact-cover-img"
              loading="eager"
            />
          ) : (
            <svg viewBox="0 0 24 24" className="compact-fallback-icon">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          )}
        </div>
        <span className="compact-music-title">
          {title}
        </span>
      </div>

      {/* Separator */}
      <span className="standby-divider">|</span>

      {/* 3. Hari + Ritme Musik - Live Animated Equalizer (Right) */}
      <div className="compact-music-rhythm" aria-hidden="true" title={`Hari: ${clock.dayName} · Ritme Musik`}>
        <span className="standby-day">{clock.dayName}</span>
        {hasMedia && (
          <div className={`wave-bars ${!isPlaying ? 'paused' : ''} ${mediaState.source_app === 'Lokal' ? 'local-wave' : ''}`}>
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
          </div>
        )}
      </div>
    </div>
  );
};
