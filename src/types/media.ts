export type MusicSource = 'spotify' | 'local';

export interface LocalTrack {
  id: string;
  name: string;
  title: string;
  artist: string;
  url: string;
  size: number;
}

export interface MediaState {
  available: boolean;
  title: string;
  artist: string;
  album: string;
  is_playing: boolean;
  position_ms: number;
  duration_ms: number;
  cover_data_url: string | null;
  source_app?: string;
}

export type MediaStatus = 'loading' | 'available' | 'unavailable' | 'error';

export const EMPTY_MEDIA_STATE: MediaState = {
  available: false,
  title: '',
  artist: '',
  album: '',
  is_playing: false,
  position_ms: 0,
  duration_ms: 0,
  cover_data_url: null,
  source_app: 'Spotify',
};

