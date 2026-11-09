import { useState, useEffect, useCallback } from 'react';
import {
  IslandSettings,
  DEFAULT_SETTINGS,
  ACCENT_OPTIONS,
  loadSettingsFromStorage,
  saveSettingsToStorage,
} from '../types/settings';
import { syncWindowPreferences } from '../services/settingsService';

export function useSettings() {
  const [settings, setSettings] = useState<IslandSettings>(loadSettingsFromStorage);

  // Terapkan CSS Variables ke document root
  const applyCssVariables = useCallback((current: IslandSettings) => {
    const accent = ACCENT_OPTIONS.find((a) => a.id === current.accentColor) || ACCENT_OPTIONS[0];

    document.documentElement.style.setProperty('--accent-color', accent.hex);
    document.documentElement.style.setProperty('--accent-glow', accent.glow);

    let duration = '0.44s';
    if (current.animationSpeed === 'normal') duration = '0.3s';
    else if (current.animationSpeed === 'fast') duration = '0.18s';
    else if (current.animationSpeed === 'none') duration = '0.001s';

    document.documentElement.style.setProperty('--anim-speed', duration);
  }, []);

  // Sinkronisasi awal dan setiap kali settings berubah
  useEffect(() => {
    applyCssVariables(settings);
    saveSettingsToStorage(settings);
    syncWindowPreferences(settings.alwaysOnTop, settings.yOffset);
  }, [settings, applyCssVariables]);

  const updateSetting = useCallback(<K extends keyof IslandSettings>(key: K, value: IslandSettings[K]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSetting,
    resetToDefaults,
  };
}
