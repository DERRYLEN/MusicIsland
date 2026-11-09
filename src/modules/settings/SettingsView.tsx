import React, { useState } from 'react';
import {
  IslandSettings,
  ACCENT_OPTIONS,
  AccentColor,
  AnimationSpeed,
} from '../../types/settings';

interface SettingsViewProps {
  settings: IslandSettings;
  onUpdateSetting: <K extends keyof IslandSettings>(key: K, value: IslandSettings[K]) => void;
  onResetSettings: () => void;
  onSwitchToMusic: () => void;
  onInteractionActivity?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSetting,
  onResetSettings,
  onSwitchToMusic,
  onInteractionActivity,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [activeCategory, setActiveCategory] = useState<'appearance' | 'standby' | 'window' | 'monitor'>('appearance');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const handleAction = () => {
    onInteractionActivity?.();
  };

  return (
    <div
      className="settings-container"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={() => onInteractionStart?.()}
      onPointerUp={() => onInteractionEnd?.()}
    >
      {/* Settings Header */}
      <div className="settings-header">
        <div className="settings-title-group">
          <span className="settings-header-icon">⚙️</span>
          <span className="settings-header-title">Pengaturan</span>
        </div>

        {/* Category Tab Buttons */}
        <div className="settings-nav-tabs">
          <button
            type="button"
            className={`settings-tab-btn ${activeCategory === 'appearance' ? 'active' : ''}`}
            onClick={() => {
              handleAction();
              setActiveCategory('appearance');
            }}
          >
            Tampilan
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeCategory === 'standby' ? 'active' : ''}`}
            onClick={() => {
              handleAction();
              setActiveCategory('standby');
            }}
          >
            Standby
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeCategory === 'window' ? 'active' : ''}`}
            onClick={() => {
              handleAction();
              setActiveCategory('window');
            }}
          >
            Jendela
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeCategory === 'monitor' ? 'active' : ''}`}
            onClick={() => {
              handleAction();
              setActiveCategory('monitor');
            }}
          >
            Monitor
          </button>
        </div>

        <button
          type="button"
          className="settings-close-tab-btn"
          onClick={() => {
            handleAction();
            onSwitchToMusic();
          }}
          title="Kembali ke Pemutar Musik"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <span>Musik</span>
        </button>
      </div>

      {/* Settings Body Area */}
      <div className="settings-body-scroll">
        {activeCategory === 'appearance' && (
          <div className="settings-section-fade">
            {/* Accent Color */}
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Warna Aksen</span>
                <span className="settings-desc">Warna aksen neon & efek cahaya MusicIsland</span>
              </div>
              <div className="accent-color-chips">
                {ACCENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`accent-chip ${settings.accentColor === opt.id ? 'active' : ''}`}
                    onClick={() => {
                      handleAction();
                      onUpdateSetting('accentColor', opt.id as AccentColor);
                    }}
                    title={opt.name}
                    style={{ '--chip-color': opt.hex } as React.CSSProperties}
                  >
                    <span className="accent-dot" style={{ backgroundColor: opt.hex }} />
                    <span className="accent-name">{opt.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Animation Speed */}
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Animasi Perpindahan</span>
                <span className="settings-desc">Kecepatan morphing notch & transisi panel</span>
              </div>
              <div className="segmented-chips">
                {(['smooth', 'normal', 'fast', 'none'] as AnimationSpeed[]).map((spd) => {
                  const labels: Record<AnimationSpeed, string> = {
                    smooth: 'Halus',
                    normal: 'Normal',
                    fast: 'Cepat',
                    none: 'Mati',
                  };
                  return (
                    <button
                      key={spd}
                      type="button"
                      className={`seg-chip ${settings.animationSpeed === spd ? 'active' : ''}`}
                      onClick={() => {
                        handleAction();
                        onUpdateSetting('animationSpeed', spd);
                      }}
                    >
                      {labels[spd]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeCategory === 'standby' && (
          <div className="settings-section-fade">
            {/* Auto Standby Toggle */}
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Standby Otomatis</span>
                <span className="settings-desc">Menyusutkan notch saat tidak ada interaksi</span>
              </div>
              <label className="switch-toggle" title="Aktifkan / Matikan Auto Standby">
                <input
                  type="checkbox"
                  checked={settings.autoStandby}
                  onChange={(e) => {
                    handleAction();
                    onUpdateSetting('autoStandby', e.target.checked);
                  }}
                />
                <span className="slider-round" />
              </label>
            </div>

            {/* Standby Delay */}
            <div className={`settings-row ${!settings.autoStandby ? 'disabled-dim' : ''}`}>
              <div className="settings-label-col">
                <span className="settings-label">Jeda Waktu Standby</span>
                <span className="settings-desc">Durasi inaktivitas sebelum island menyusut</span>
              </div>
              <div className="segmented-chips">
                {[3, 5, 10, 15, 30].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    disabled={!settings.autoStandby}
                    className={`seg-chip ${settings.standbyDelaySeconds === sec ? 'active' : ''}`}
                    onClick={() => {
                      handleAction();
                      onUpdateSetting('standbyDelaySeconds', sec);
                    }}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeCategory === 'window' && (
          <div className="settings-section-fade">
            {/* Always on Top */}
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Melayang di Atas (Always on Top)</span>
                <span className="settings-desc">Tetap berada di depan jendela aplikasi lain</span>
              </div>
              <label className="switch-toggle" title="Aktifkan / Matikan Always on Top">
                <input
                  type="checkbox"
                  checked={settings.alwaysOnTop}
                  onChange={(e) => {
                    handleAction();
                    onUpdateSetting('alwaysOnTop', e.target.checked);
                  }}
                />
                <span className="slider-round" />
              </label>
            </div>

            {/* Y Offset */}
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Jarak dari Atas Layar</span>
                <span className="settings-desc">Posisi vertikal notch dari puncak monitor ({settings.yOffset}px)</span>
              </div>
              <div className="slider-range-box">
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="2"
                  value={settings.yOffset}
                  onChange={(e) => {
                    handleAction();
                    onUpdateSetting('yOffset', Number(e.target.value));
                  }}
                  className="range-slider"
                />
                <span className="range-val">{settings.yOffset}px</span>
              </div>
            </div>
          </div>
        )}

        {activeCategory === 'monitor' && (
          <div className="settings-section-fade">
            {/* Monitor Refresh Interval */}
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Interval Sampling Performa</span>
                <span className="settings-desc">Kecepatan pembaruan data CPU & RAM Turbo Overboost</span>
              </div>
              <div className="segmented-chips">
                {([1, 2, 5] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`seg-chip ${settings.monitorRefreshInterval === sec ? 'active' : ''}`}
                    onClick={() => {
                      handleAction();
                      onUpdateSetting('monitorRefreshInterval', sec);
                    }}
                  >
                    {sec} detik
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Footer: Reset to Default */}
      <div className="settings-footer">
        {showResetConfirm ? (
          <div className="reset-confirm-bar">
            <span className="confirm-text">Kembalikan ke setelan pabrik?</span>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn danger"
                onClick={() => {
                  handleAction();
                  onResetSettings();
                  setShowResetConfirm(false);
                }}
              >
                Ya, Reset
              </button>
              <button
                type="button"
                className="confirm-btn cancel"
                onClick={() => {
                  handleAction();
                  setShowResetConfirm(false);
                }}
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="reset-defaults-btn"
            onClick={() => {
              handleAction();
              setShowResetConfirm(true);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Reset ke Setelan Default</span>
          </button>
        )}
      </div>
    </div>
  );
};
