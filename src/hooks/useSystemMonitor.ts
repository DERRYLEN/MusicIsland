import { useState, useEffect, useRef, useCallback } from 'react';
import { SystemStats, EMPTY_SYSTEM_STATS, PerformanceHistoryPoint } from '../types/monitor';
import { fetchSystemStats } from '../services/monitorService';

const MAX_HISTORY_POINTS = 16;

export function useSystemMonitor(isActive: boolean, refreshIntervalSeconds: number = 2) {
  const [stats, setStats] = useState<SystemStats>(EMPTY_SYSTEM_STATS);
  const [history, setHistory] = useState<PerformanceHistoryPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef<boolean>(false);

  const sample = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const data = await fetchSystemStats();
      setStats(data);
      setError(null);

      const timeLabel = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setHistory((prev) => {
        const point: PerformanceHistoryPoint = {
          time: timeLabel,
          cpu: Math.round(data.cpu_usage_percent),
          ram: Math.round(data.ram_usage_percent),
        };
        const next = [...prev, point];
        if (next.length > MAX_HISTORY_POINTS) {
          return next.slice(next.length - MAX_HISTORY_POINTS);
        }
        return next;
      });
    } catch (err: any) {
      setError(err?.message || 'Gagal mengambil data sistem');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    // Ambil sampel pertama seketika
    sample();

    const intervalMs = Math.max(1000, refreshIntervalSeconds * 1000);
    const timer = setInterval(sample, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [isActive, refreshIntervalSeconds, sample]);

  return {
    stats,
    history,
    loading,
    error,
    refreshNow: sample,
  };
}
