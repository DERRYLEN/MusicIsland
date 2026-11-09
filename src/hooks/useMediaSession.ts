import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MediaState, MediaStatus, EMPTY_MEDIA_STATE, MusicSource, LocalTrack } from '../types/media';
import {
  fetchMediaState,
  togglePlayPause,
  skipNext,
  skipPrevious,
  setMediaRepeat,
  setMediaShuffle,
  fetchSystemVolume,
  updateSystemVolume,
  toggleSystemMute,
  openAudioOutputSettings,
  launchMusicApp,
  seekPlaybackPosition,
} from '../services/mediaService';

function parseTrackName(filename: string): { title: string; artist: string } {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  if (withoutExt.includes(' - ')) {
    const parts = withoutExt.split(' - ');
    const artist = parts[0].trim();
    const title = parts.slice(1).join(' - ').trim();
    return { title, artist };
  }
  return { title: withoutExt, artist: 'Musik Lokal' };
}

export function useMediaSession() {
  const [spotifyMediaState, setSpotifyMediaState] = useState<MediaState>(EMPTY_MEDIA_STATE);
  const [status, setStatus] = useState<MediaStatus>('loading');
  const [spotifyCurrentPositionMs, setSpotifyCurrentPositionMs] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.72);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<'spotify' | 'youtube'>('spotify');

  // Sumber musik aktif: 'spotify' atau 'local'
  const [musicSource, setMusicSource] = useState<MusicSource>('spotify');

  // State pemutar musik lokal
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isLocalPlaying, setIsLocalPlaying] = useState<boolean>(false);
  const [localPositionMs, setLocalPositionMs] = useState<number>(0);
  const [localDurationMs, setLocalDurationMs] = useState<number>(0);

  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const localTracksRef = useRef<LocalTrack[]>([]);
  const timeoutRefs = useRef<number[]>([]);

  const clearPendingTimeouts = useCallback(() => {
    timeoutRefs.current.forEach((id) => clearTimeout(id));
    timeoutRefs.current = [];
  }, []);

  // Inisialisasi Audio Element untuk Musik Lokal
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    localAudioRef.current = audio;

    const onTimeUpdate = () => {
      setLocalPositionMs(audio.currentTime * 1000);
    };

    const onLoadedMetadata = () => {
      const duration = (audio.duration && !isNaN(audio.duration)) ? audio.duration * 1000 : 0;
      setLocalDurationMs(duration);
    };

    const onPlay = () => setIsLocalPlaying(true);
    const onPause = () => setIsLocalPlaying(false);

    const onEnded = () => {
      // Putar lagu berikutnya dalam playlist jika ada
      const currentList = localTracksRef.current;
      if (currentList.length > 0) {
        setCurrentTrackIndex((prev) => {
          const next = prev + 1;
          return next < currentList.length ? next : 0;
        });
      }
    };

    const onError = () => {
      console.warn('Gagal memutar audio lokal.');
      setIsLocalPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.src = '';
      localTracksRef.current.forEach((t) => URL.revokeObjectURL(t.url));
    };
  }, []);

  // Fetch initial volume on mount
  useEffect(() => {
    fetchSystemVolume().then((vol) => {
      setVolume(vol);
      if (localAudioRef.current) {
        localAudioRef.current.volume = vol;
      }
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const state = await fetchMediaState();
      setSpotifyMediaState((prev) => {
        if (
          prev.available === state.available &&
          prev.title === state.title &&
          prev.artist === state.artist &&
          prev.is_playing === state.is_playing &&
          prev.duration_ms === state.duration_ms &&
          prev.cover_data_url === state.cover_data_url &&
          prev.source_app === state.source_app
        ) {
          return prev;
        }
        return state;
      });

      setSpotifyCurrentPositionMs(state.position_ms);
      setStatus(state.available ? 'available' : 'unavailable');
    } catch {
      setStatus('error');
    }
  }, []);

  // Adaptive polling untuk Spotify: 1000ms saat playing, 2000ms saat idle
  useEffect(() => {
    refresh();

    const intervalTime = spotifyMediaState.is_playing ? 1000 : 2000;
    const interval = setInterval(refresh, intervalTime);

    return () => {
      clearInterval(interval);
      clearPendingTimeouts();
    };
  }, [refresh, spotifyMediaState.is_playing, clearPendingTimeouts]);

  const scheduleRefresh = useCallback(
    (delayMs: number) => {
      const id = window.setTimeout(() => {
        refresh();
      }, delayMs);
      timeoutRefs.current.push(id);
    },
    [refresh]
  );

  // Perpindahan lagu di playlist musik lokal
  useEffect(() => {
    const audio = localAudioRef.current;
    const track = localTracks[currentTrackIndex];
    if (!audio || !track) return;

    audio.src = track.url;
    audio.currentTime = 0;
    setLocalPositionMs(0);

    if (isLocalPlaying && musicSource === 'local') {
      audio.play().catch(() => setIsLocalPlaying(false));
    }
  }, [currentTrackIndex, localTracks]);

  // Pemilihan file lokal melalui FileList / Array of Files
  const loadLocalFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => {
        const name = f.name.toLowerCase();
        return (
          f.type.startsWith('audio/') ||
          name.endsWith('.mp3') ||
          name.endsWith('.wav') ||
          name.endsWith('.ogg') ||
          name.endsWith('.m4a') ||
          name.endsWith('.flac') ||
          name.endsWith('.aac')
        );
      });

      if (fileArray.length === 0) return;

      // Bersihkan object URL lama
      localTracksRef.current.forEach((t) => URL.revokeObjectURL(t.url));

      const newTracks: LocalTrack[] = fileArray.map((file, idx) => {
        const { title, artist } = parseTrackName(file.name);
        return {
          id: `${Date.now()}-${idx}-${file.name}`,
          name: file.name,
          title,
          artist,
          url: URL.createObjectURL(file),
          size: file.size,
        };
      });

      localTracksRef.current = newTracks;
      setLocalTracks(newTracks);
      setCurrentTrackIndex(0);
      setMusicSource('local');

      // Jeda Spotify bila sedang berputar agar tidak terjadi audio ganda
      if (spotifyMediaState.is_playing) {
        togglePlayPause();
      }

      const audio = localAudioRef.current;
      if (audio && newTracks.length > 0) {
        audio.src = newTracks[0].url;
        audio.volume = volume;
        audio.play().then(() => {
          setIsLocalPlaying(true);
        }).catch((err) => {
          console.warn('Audio play error:', err);
          setIsLocalPlaying(false);
        });
      }
    },
    [spotifyMediaState.is_playing, volume]
  );

  // Putar file audio langsung dari File Explorer
  const playAudioFromExplorer = useCallback(
    (name: string, dataUrl: string) => {
      const { title, artist } = parseTrackName(name);
      const track: LocalTrack = {
        id: `explorer-${Date.now()}-${name}`,
        name,
        title,
        artist,
        url: dataUrl,
        size: 0,
      };

      localTracksRef.current = [track];
      setLocalTracks([track]);
      setCurrentTrackIndex(0);
      setMusicSource('local');

      if (spotifyMediaState.is_playing) {
        togglePlayPause();
      }

      const audio = localAudioRef.current;
      if (audio) {
        audio.src = dataUrl;
        audio.volume = volume;
        audio.play().then(() => {
          setIsLocalPlaying(true);
        }).catch((err) => {
          console.warn('Audio play error:', err);
          setIsLocalPlaying(false);
        });
      }
    },
    [spotifyMediaState.is_playing, volume]
  );

  // Beralih sumber musik (Spotify <-> Lokal)
  const setSource = useCallback(
    (source: MusicSource) => {
      if (source === musicSource) return;

      if (source === 'local') {
        // Hentikan Spotify jika sedang aktif
        if (spotifyMediaState.is_playing) {
          togglePlayPause();
        }
      } else {
        // Hentikan Musik Lokal jika sedang aktif
        if (localAudioRef.current && !localAudioRef.current.paused) {
          localAudioRef.current.pause();
        }
        setIsLocalPlaying(false);
      }
      setMusicSource(source);
    },
    [musicSource, spotifyMediaState.is_playing]
  );

  // Play / Pause terpadu
  const handleTogglePlay = useCallback(async () => {
    if (musicSource === 'local') {
      const audio = localAudioRef.current;
      if (!audio || localTracks.length === 0) return;

      if (audio.paused) {
        // Jeda Spotify bila sedang memutar
        if (spotifyMediaState.is_playing) {
          await togglePlayPause();
        }
        audio.play().then(() => {
          setIsLocalPlaying(true);
        }).catch(() => {
          setIsLocalPlaying(false);
        });
      } else {
        audio.pause();
        setIsLocalPlaying(false);
      }
    } else {
      // Jika memutar Spotify, pastikan audio lokal dijeda
      if (localAudioRef.current && !localAudioRef.current.paused) {
        localAudioRef.current.pause();
        setIsLocalPlaying(false);
      }
      setSpotifyMediaState((prev) => ({ ...prev, is_playing: !prev.is_playing }));
      await togglePlayPause();
      scheduleRefresh(250);
    }
  }, [musicSource, localTracks.length, spotifyMediaState.is_playing, scheduleRefresh]);

  // Next terpadu
  const handleNext = useCallback(async () => {
    if (musicSource === 'local') {
      if (localTracks.length === 0) return;
      setCurrentTrackIndex((prev) => (prev + 1 < localTracks.length ? prev + 1 : 0));
    } else {
      await skipNext();
      scheduleRefresh(350);
    }
  }, [musicSource, localTracks.length, scheduleRefresh]);

  // Prev terpadu
  const handlePrev = useCallback(async () => {
    if (musicSource === 'local') {
      if (localTracks.length === 0) return;
      const audio = localAudioRef.current;
      // Jika sudah berjalan lebih dari 3 detik, ulang lagu dari awal
      if (audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        setLocalPositionMs(0);
        return;
      }
      setCurrentTrackIndex((prev) => (prev - 1 >= 0 ? prev - 1 : localTracks.length - 1));
    } else {
      await skipPrevious();
      scheduleRefresh(350);
    }
  }, [musicSource, localTracks.length, scheduleRefresh]);

  const handleToggleRepeat = useCallback(async () => {
    setIsRepeat((prev) => {
      const next = !prev;
      if (musicSource === 'spotify') {
        setMediaRepeat(next);
      }
      if (localAudioRef.current) {
        localAudioRef.current.loop = next;
      }
      return next;
    });
  }, [musicSource]);

  const handleToggleShuffle = useCallback(async () => {
    setIsShuffle((prev) => {
      const next = !prev;
      if (musicSource === 'spotify') {
        setMediaShuffle(next);
      }
      return next;
    });
  }, [musicSource]);

  const handleSetVolume = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (clamped > 0) setIsMuted(false);

    if (localAudioRef.current) {
      localAudioRef.current.volume = clamped;
    }
    // Update master system volume Windows 11
    updateSystemVolume(clamped);
  }, []);

  const handleSeekPosition = useCallback(
    (newPositionMs: number) => {
      if (musicSource === 'local') {
        const audio = localAudioRef.current;
        if (audio && localDurationMs > 0) {
          audio.currentTime = newPositionMs / 1000;
          setLocalPositionMs(newPositionMs);
        }
      } else {
        setSpotifyCurrentPositionMs(newPositionMs);
        seekPlaybackPosition(newPositionMs);
        scheduleRefresh(250);
      }
    },
    [musicSource, localDurationMs, scheduleRefresh]
  );

  const handleToggleMute = useCallback(async () => {
    const nextMute = await toggleSystemMute();
    setIsMuted(nextMute);
    if (localAudioRef.current) {
      localAudioRef.current.muted = nextMute;
    }
  }, []);

  const handleOpenOutputSettings = useCallback(async () => {
    await openAudioOutputSettings();
  }, []);

  const handleLaunchMusicApp = useCallback(
    async (appType?: 'spotify' | 'youtube') => {
      const target = appType || selectedProvider;
      await launchMusicApp(target);
      scheduleRefresh(1800);
    },
    [selectedProvider, scheduleRefresh]
  );

  // State media terpadu untuk tampilan Compact dan Expanded
  const mediaState: MediaState = useMemo(() => {
    if (musicSource === 'local') {
      const currentTrack = localTracks[currentTrackIndex];
      const hasTracks = localTracks.length > 0;
      return {
        available: hasTracks,
        title: currentTrack ? currentTrack.title : 'Pilih File Musik',
        artist: currentTrack ? currentTrack.artist : 'Format: MP3, WAV, OGG, M4A, FLAC',
        album: 'Musik Lokal',
        is_playing: isLocalPlaying,
        position_ms: localPositionMs,
        duration_ms: localDurationMs,
        cover_data_url: null,
        source_app: 'Lokal',
      };
    }
    return spotifyMediaState;
  }, [
    musicSource,
    localTracks,
    currentTrackIndex,
    isLocalPlaying,
    localPositionMs,
    localDurationMs,
    spotifyMediaState,
  ]);

  const currentPositionMs = musicSource === 'local' ? localPositionMs : spotifyCurrentPositionMs;

  return {
    mediaState,
    status,
    currentPositionMs,
    volume,
    isMuted,
    isRepeat,
    isShuffle,
    selectedProvider,
    setSelectedProvider,
    musicSource,
    setMusicSource: setSource,
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
    refresh,
  };
}

