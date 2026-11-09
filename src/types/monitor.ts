export interface SystemStats {
  cpu_usage_percent: number;
  logical_cores: number;
  ram_total_mb: number;
  ram_used_mb: number;
  ram_available_mb: number;
  ram_usage_percent: number;
  virtual_ram_total_mb: number;
  virtual_ram_used_mb: number;
  virtual_ram_available_mb: number;
  app_ram_usage_mb: number;
  app_cpu_usage_percent: number;
  device_name: string;
  os_name: string;
  is_valid: boolean;
}

export type ResourceLevel = 'normal' | 'elevated' | 'high';

export interface PerformanceHistoryPoint {
  time: string;
  cpu: number;
  ram: number;
}

export function getResourceLevel(percent: number): ResourceLevel {
  if (percent >= 85) return 'high';
  if (percent >= 60) return 'elevated';
  return 'normal';
}

export function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

export const EMPTY_SYSTEM_STATS: SystemStats = {
  cpu_usage_percent: 0,
  logical_cores: 1,
  ram_total_mb: 0,
  ram_used_mb: 0,
  ram_available_mb: 0,
  ram_usage_percent: 0,
  virtual_ram_total_mb: 0,
  virtual_ram_used_mb: 0,
  virtual_ram_available_mb: 0,
  app_ram_usage_mb: 0,
  app_cpu_usage_percent: 0,
  device_name: 'Windows 11 PC',
  os_name: 'Windows 11',
  is_valid: false,
};
