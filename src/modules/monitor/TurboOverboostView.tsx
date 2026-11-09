import React, { useState } from 'react';
import { useSystemMonitor } from '../../hooks/useSystemMonitor';
import { formatMemory, getResourceLevel } from '../../types/monitor';
import { IslandSettings } from '../../types/settings';

interface TurboOverboostViewProps {
  settings: IslandSettings;
  onSwitchToMusic: () => void;
  onInteractionActivity?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export const TurboOverboostView: React.FC<TurboOverboostViewProps> = ({
  settings,
  onSwitchToMusic,
  onInteractionActivity,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'graphs'>('metrics');

  const { stats, history, loading, error, refreshNow } = useSystemMonitor(
    true,
    settings.monitorRefreshInterval || 2
  );

  const handleAction = () => {
    onInteractionActivity?.();
  };

  const cpuLevel = getResourceLevel(stats.cpu_usage_percent);
  const ramLevel = getResourceLevel(stats.ram_usage_percent);

  // Status sistem keseluruhan: ambil level tertinggi antara CPU dan RAM
  const overallLevel =
    cpuLevel === 'high' || ramLevel === 'high'
      ? 'high'
      : cpuLevel === 'elevated' || ramLevel === 'elevated'
      ? 'elevated'
      : 'normal';

  const statusLabels: Record<typeof overallLevel, { label: string; textClass: string }> = {
    normal: { label: 'Optimal', textClass: 'status-optimal' },
    elevated: { label: 'Elevated', textClass: 'status-elevated' },
    high: { label: 'Beban Tinggi', textClass: 'status-high' },
  };

  // Helper membuat jalur SVG untuk sparkline grafik
  const renderSparkline = (dataKey: 'cpu' | 'ram', strokeColor: string, fillColor: string) => {
    if (history.length < 2) {
      return (
        <div className="graph-empty-state">
          <span>Mengumpulkan sampel data performa ({history.length}/2)...</span>
        </div>
      );
    }

    const width = 186;
    const height = 48;
    const padding = 4;

    const points = history.map((pt, idx) => {
      const val = pt[dataKey];
      const x = padding + (idx / (history.length - 1)) * (width - padding * 2);
      const y = height - padding - (val / 100) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const areaD = `${pathD} L ${(width - padding).toFixed(1)},${(height - padding).toFixed(
      1
    )} L ${padding},${(height - padding).toFixed(1)} Z`;

    const lastVal = history[history.length - 1][dataKey];

    return (
      <div className="sparkline-box">
        <div className="sparkline-header">
          <span className="sparkline-title">{dataKey.toUpperCase()} Riwayat</span>
          <span className="sparkline-val" style={{ color: strokeColor }}>
            {lastVal}%
          </span>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="sparkline-svg"
          preserveAspectRatio="none"
        >
          <path d={areaD} fill={fillColor} />
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  };

  return (
    <div
      className="overboost-container"
      onClick={(e) => {
        e.stopPropagation();
        handleAction();
      }}
      onPointerDown={() => onInteractionStart?.()}
      onPointerUp={() => onInteractionEnd?.()}
    >
      {/* Header Bar */}
      <div className="overboost-header">
        <div className="overboost-title-group">
          <span className="overboost-bolt-icon">⚡</span>
          <span className="overboost-title">Turbo Overboost</span>
          <span className={`overboost-badge ${statusLabels[overallLevel].textClass}`}>
            {statusLabels[overallLevel].label}
          </span>
          <span className="overboost-interval-pill" title="Interval pembaruan sampling">
            {settings.monitorRefreshInterval}s
          </span>
        </div>

        {/* Tab switcher: Metrik vs Grafik */}
        <div className="overboost-tab-group">
          <button
            type="button"
            className={`overboost-tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => {
              handleAction();
              setActiveTab('metrics');
            }}
          >
            Metrik
          </button>
          <button
            type="button"
            className={`overboost-tab-btn ${activeTab === 'graphs' ? 'active' : ''}`}
            onClick={() => {
              handleAction();
              setActiveTab('graphs');
            }}
          >
            Grafik
          </button>
        </div>

        {/* Action buttons: Manual Refresh & Back to Music */}
        <div className="overboost-actions">
          <button
            type="button"
            className="overboost-icon-btn"
            onClick={() => {
              handleAction();
              refreshNow();
            }}
            title="Refresh sekarang"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </button>

          <button
            type="button"
            className="overboost-switch-btn"
            onClick={() => {
              handleAction();
              onSwitchToMusic();
            }}
            title="Kembali ke Pemutar Musik"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span>Musik</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      {loading && !stats.is_valid ? (
        <div className="overboost-loading-state">
          <div className="overboost-spinner" />
          <span>Mengakses sensor performa sistem Windows 11...</span>
        </div>
      ) : error ? (
        <div className="overboost-error-state">
          <span>⚠️ {error}</span>
        </div>
      ) : activeTab === 'metrics' ? (
        <div className="overboost-body-fade">
          {/* Dual Resource Cards Row */}
          <div className="metrics-grid">
            {/* CPU Card */}
            <div className={`metric-card ${cpuLevel}`}>
              <div className="card-top-row">
                <div className="card-label-block">
                  <span className="card-metric-name">CPU</span>
                  <span className="card-sub-info">{stats.logical_cores} Cores</span>
                </div>
                <div className="card-val-block">
                  <span className="card-percent">{Math.round(stats.cpu_usage_percent)}%</span>
                  <span className={`card-tag ${cpuLevel}`}>
                    {cpuLevel === 'high' ? 'High' : cpuLevel === 'elevated' ? 'Elevated' : 'Normal'}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="metric-progress-track">
                <div
                  className={`metric-progress-fill cpu-fill ${cpuLevel}`}
                  style={{ width: `${Math.min(100, Math.max(0, stats.cpu_usage_percent))}%` }}
                />
              </div>

              <div className="card-footer-row">
                <span className="proc-label">MusicIsland:</span>
                <span className="proc-val">
                  {stats.app_cpu_usage_percent > 0
                    ? `${stats.app_cpu_usage_percent.toFixed(1)}%`
                    : '< 0.1%'}
                </span>
              </div>
            </div>

            {/* RAM Card */}
            <div className={`metric-card ${ramLevel}`}>
              <div className="card-top-row">
                <div className="card-label-block">
                  <span className="card-metric-name">RAM FISIK</span>
                  <span className="card-sub-info">
                    {formatMemory(stats.ram_used_mb)} / {formatMemory(stats.ram_total_mb)}
                  </span>
                </div>
                <div className="card-val-block">
                  <span className="card-percent">{Math.round(stats.ram_usage_percent)}%</span>
                  <span className={`card-tag ${ramLevel}`}>
                    {ramLevel === 'high' ? 'High' : ramLevel === 'elevated' ? 'Elevated' : 'Normal'}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="metric-progress-track">
                <div
                  className={`metric-progress-fill ram-fill ${ramLevel}`}
                  style={{ width: `${Math.min(100, Math.max(0, stats.ram_usage_percent))}%` }}
                />
              </div>

              <div className="card-footer-row">
                <span className="proc-label">Tersedia: {formatMemory(stats.ram_available_mb)}</span>
                <span className="proc-val">App: {stats.app_ram_usage_mb.toFixed(0)} MB</span>
              </div>
            </div>
          </div>

          {/* System Overview Details Row */}
          <div className="system-overview-strip">
            <div className="sys-info-chip" title="Nama Host Perangkat Windows 11">
              <span className="sys-chip-icon">💻</span>
              <span className="sys-chip-text">{stats.device_name}</span>
            </div>
            <div className="sys-info-chip" title="Sistem Operasi">
              <span className="sys-chip-icon">🪟</span>
              <span className="sys-chip-text">{stats.os_name}</span>
            </div>
            <div className="sys-info-chip" title="Virtual Memory / Paging File Terpakai">
              <span className="sys-chip-icon">📄</span>
              <span className="sys-chip-text">
                V-RAM: {formatMemory(stats.virtual_ram_used_mb)} / {formatMemory(stats.virtual_ram_total_mb)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* GRAPHS VIEW */
        <div className="overboost-graphs-fade">
          <div className="graphs-grid">
            {renderSparkline('cpu', '#22d3ee', 'rgba(34, 211, 238, 0.12)')}
            {renderSparkline('ram', '#3b82f6', 'rgba(59, 130, 246, 0.12)')}
          </div>
          <div className="graphs-legend-row">
            <span className="legend-item">
              <span className="legend-dot cyan" /> CPU Terpakai (%)
            </span>
            <span className="legend-item">
              <span className="legend-dot blue" /> RAM Terpakai (%)
            </span>
            <span className="legend-note">
              Riwayat {history.length} titik sampling ({settings.monitorRefreshInterval}s)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
