import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { syncNativeWindowMode, IslandWindowMode } from '../services/windowService';

/**
 * Durasi standby adaptif (dalam milidetik).
 * Island akan otomatis menyusut setelah durasi ini tanpa interaksi pengguna.
 */
export const STANDBY_DELAY_MS = 5000;

export function useIslandState(
  hasActiveMusic: boolean,
  autoStandby: boolean = true,
  standbyDelaySeconds: number = 5
) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  const standbyTimerRef = useRef<number | null>(null);

  const currentMode: IslandWindowMode = useMemo(() => {
    if (isExpanded) return 'expanded';
    if (hasActiveMusic) return 'compact';
    return 'idle';
  }, [isExpanded, hasActiveMusic]);

  const isFirstMount = useRef(true);
  const windowSyncTimerRef = useRef<number | null>(null);

  // Sinkronisasi ukuran tinggi jendela native Tauri adaptif:
  // Ketika membesar: buka jendela native seketika agar animasi CSS tidak terpotong.
  // Ketika menyusut: tunda pengecilan jendela native 420ms agar animasi CSS selesai dengan sangat mulus tanpa terpotong.
  useEffect(() => {
    if (windowSyncTimerRef.current !== null) {
      window.clearTimeout(windowSyncTimerRef.current);
      windowSyncTimerRef.current = null;
    }

    if (isFirstMount.current) {
      isFirstMount.current = false;
      syncNativeWindowMode(currentMode);
      return;
    }

    if (currentMode === 'expanded') {
      syncNativeWindowMode('expanded');
    } else {
      windowSyncTimerRef.current = window.setTimeout(() => {
        syncNativeWindowMode(currentMode);
        windowSyncTimerRef.current = null;
      }, 420);
    }

    return () => {
      if (windowSyncTimerRef.current !== null) {
        window.clearTimeout(windowSyncTimerRef.current);
      }
    };
  }, [currentMode]);

  const clearStandbyTimer = useCallback(() => {
    if (standbyTimerRef.current !== null) {
      window.clearTimeout(standbyTimerRef.current);
      standbyTimerRef.current = null;
    }
  }, []);

  const collapse = useCallback(() => {
    clearStandbyTimer();
    setIsExpanded(false);
  }, [clearStandbyTimer]);

  const resetStandbyTimer = useCallback(() => {
    clearStandbyTimer();
    // Jadwalkan auto-collapse setelah durasi inaktivitas jika mode expanded dan autoStandby aktif
    if (isExpanded && !isInteracting && autoStandby) {
      const delayMs = Math.max(1000, standbyDelaySeconds * 1000);
      standbyTimerRef.current = window.setTimeout(() => {
        collapse();
      }, delayMs);
    }
  }, [clearStandbyTimer, isExpanded, isInteracting, autoStandby, standbyDelaySeconds, collapse]);

  // Efek penjadwalan standby timer adaptif
  useEffect(() => {
    if (!isExpanded || !autoStandby) {
      clearStandbyTimer();
      return;
    }

    // Jika sedang interaksi (scrubbing/volume drag), tahan timer
    if (isInteracting) {
      clearStandbyTimer();
    } else {
      // Mulai hitung mundur inaktivitas
      resetStandbyTimer();
    }

    return () => {
      clearStandbyTimer();
    };
  }, [isExpanded, autoStandby, isInteracting, clearStandbyTimer, resetStandbyTimer]);

  const expand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleInteractionStart = useCallback(() => {
    setIsInteracting(true);
    clearStandbyTimer();
  }, [clearStandbyTimer]);

  const handleInteractionEnd = useCallback(() => {
    setIsInteracting(false);
  }, []);

  useEffect(() => {
    return () => {
      clearStandbyTimer();
      if (windowSyncTimerRef.current !== null) {
        window.clearTimeout(windowSyncTimerRef.current);
      }
    };
  }, [clearStandbyTimer]);

  return {
    isExpanded,
    currentMode,
    isHovered,
    isInteracting,
    expand,
    collapse,
    toggle,
    setIsHovered,
    resetStandbyTimer,
    handleInteractionStart,
    handleInteractionEnd,
  };
}

