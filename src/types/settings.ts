export type AccentColor = 'cyan' | 'blue' | 'green' | 'purple';

export interface AccentOption {
  id: AccentColor;
  name: string;
  hex: string;
  glow: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: 'cyan', name: 'Cyan Neon', hex: '#22d3ee', glow: 'rgba(34, 211, 238, 0.45)' },
  { id: 'blue', name: 'Sapphire Blue', hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.45)' },
  { id: 'green', name: 'Emerald Green', hex: '#22c55e', glow: 'rgba(34, 197, 94, 0.45)' },
  { id: 'purple', name: 'Neon Violet', hex: '#a855f7', glow: 'rgba(168, 85, 247, 0.45)' },
];

export type AnimationSpeed = 'smooth' | 'normal' | 'fast' | 'none';

export interface IslandSettings {
  accentColor: AccentColor;
  autoStandby: boolean;
  standbyDelaySeconds: number; // 3, 5, 10, 15, 30
  animationSpeed: AnimationSpeed;
  alwaysOnTop: boolean;
  yOffset: number; // 0 s/d 24px, default 8
  monitorRefreshInterval: 1 | 2 | 5; // 1, 2, 5 detik
}

export const DEFAULT_SETTINGS: IslandSettings = {
  accentColor: 'cyan',
  autoStandby: true,
  standbyDelaySeconds: 5,
  animationSpeed: 'smooth',
  alwaysOnTop: false,
  yOffset: 8,
  monitorRefreshInterval: 2,
};

const STORAGE_KEY = 'music_island_preferences_v1';

export function loadSettingsFromStorage(): IslandSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw);
    const validAccent = ACCENT_OPTIONS.some((o) => o.id === parsed.accentColor)
      ? parsed.accentColor
      : DEFAULT_SETTINGS.accentColor;

    const validDelay = [3, 5, 10, 15, 30].includes(Number(parsed.standbyDelaySeconds))
      ? Number(parsed.standbyDelaySeconds)
      : DEFAULT_SETTINGS.standbyDelaySeconds;

    const validSpeed = ['smooth', 'normal', 'fast', 'none'].includes(parsed.animationSpeed)
      ? parsed.animationSpeed
      : DEFAULT_SETTINGS.animationSpeed;

    const validYOffset = typeof parsed.yOffset === 'number'
      ? Math.max(0, Math.min(24, parsed.yOffset))
      : DEFAULT_SETTINGS.yOffset;

    const validRefreshInterval = [1, 2, 5].includes(Number(parsed.monitorRefreshInterval))
      ? (Number(parsed.monitorRefreshInterval) as 1 | 2 | 5)
      : DEFAULT_SETTINGS.monitorRefreshInterval;

    return {
      accentColor: validAccent,
      autoStandby: typeof parsed.autoStandby === 'boolean' ? parsed.autoStandby : DEFAULT_SETTINGS.autoStandby,
      standbyDelaySeconds: validDelay,
      animationSpeed: validSpeed,
      alwaysOnTop: typeof parsed.alwaysOnTop === 'boolean' ? parsed.alwaysOnTop : DEFAULT_SETTINGS.alwaysOnTop,
      yOffset: validYOffset,
      monitorRefreshInterval: validRefreshInterval,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettingsToStorage(settings: IslandSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Gagal menyimpan preferensi ke localStorage:', err);
  }
}
