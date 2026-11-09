import { TerminalLog, formatUptime } from '../../types/terminal';
import { MediaState, MusicSource } from '../../types/media';
import { IslandSettings } from '../../types/settings';
import { fetchAppInfo, runSystemCmd } from '../../services/terminalService';
import { fetchSystemStats } from '../../services/monitorService';
import { formatMemory } from '../../types/monitor';
import { IslandWindowMode } from '../../services/windowService';

export interface CommandContext {
  mediaState: MediaState;
  musicSource: MusicSource;
  currentMode: IslandWindowMode;
  settings: IslandSettings;
  localTracksCount: number;
}

export async function executeCommand(
  rawInput: string,
  context: CommandContext
): Promise<{ logs: TerminalLog[]; shouldClear?: boolean; newCwd?: string }> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { logs: [] };
  }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  const timestamp = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const makeLog = (text: string, type: TerminalLog['type'] = 'info'): TerminalLog => ({
    id: `${Date.now()}-${Math.random()}`,
    text,
    type,
    timestamp,
  });

  switch (cmd) {
    case 'help':
      return {
        logs: [
          makeLog('=== MusicIsland CLI & Windows CMD Terminal ===', 'info'),
          makeLog('Perintah Internal MusicIsland:', 'info'),
          makeLog('  music      - Informasi detail lagu yang sedang berputar', 'info'),
          makeLog('  status     - Status mode Dynamic Island & player', 'info'),
          makeLog('  perf       - Metrik performa sistem (Turbo Overboost)', 'info'),
          makeLog('  settings   - Ringkasan konfigurasi pengaturan aktif', 'info'),
          makeLog('  files      - Status modul File Explorer', 'info'),
          makeLog('  uptime     - Durasi waktu aktif aplikasi', 'info'),
          makeLog('  version    - Versi resmi MusicIsland', 'info'),
          makeLog('  clear      - Membersihkan layar terminal', 'info'),
          makeLog('  help       - Menampilkan bantuan perintah', 'info'),
          makeLog('', 'info'),
          makeLog('Perintah Sistem Windows CMD / CLI:', 'success'),
          makeLog('  Mendukung semua perintah Command Prompt Windows:', 'info'),
          makeLog('  9router, dir, cd, ipconfig, ping, git, npm, node, tasklist, dll.', 'info'),
        ],
      };

    case 'clear':
      return { logs: [], shouldClear: true };

    case 'version': {
      const info = await fetchAppInfo();
      return {
        logs: [
          makeLog(`${info.name} v${info.version} (Tauri 2 + React + Rust)`, 'success'),
          makeLog('Build target: Windows 11 Desktop (x86_64-pc-windows-msvc)', 'info'),
        ],
      };
    }

    case 'uptime': {
      const info = await fetchAppInfo();
      return {
        logs: [
          makeLog(`Waktu aktif aplikasi (Uptime): ${formatUptime(info.uptime_seconds)}`, 'info'),
        ],
      };
    }

    case 'status': {
      const info = await fetchAppInfo();
      return {
        logs: [
          makeLog(`=== Status Aplikasi ${info.name} ===`, 'info'),
          makeLog(`• Versi Aplikasi : v${info.version}`, 'info'),
          makeLog(`• Mode Island    : ${context.currentMode.toUpperCase()}`, 'info'),
          makeLog(`• Sumber Media   : ${context.musicSource === 'spotify' ? 'Spotify GSMTC' : 'Pemutar Musik Lokal'}`, 'info'),
          makeLog(`• Pemutaran      : ${context.mediaState.is_playing ? 'Sedang Memutar (Playing)' : 'Jeda / Idle'}`, 'info'),
          makeLog(`• Standby Mode   : ${context.settings.autoStandby ? `Aktif (${context.settings.standbyDelaySeconds}s delay)` : 'Nonaktif'}`, 'info'),
          makeLog(`• Antrean Lokal  : ${context.localTracksCount} berkas termuat`, 'info'),
        ],
      };
    }

    case 'music': {
      const ms = context.mediaState;
      if (!ms.available) {
        return {
          logs: [
            makeLog('Tidak ada media yang sedang aktif.', 'warning'),
            makeLog('Buka Spotify atau pilih berkas lagu lokal untuk memutar.', 'info'),
          ],
        };
      }
      const curSec = Math.floor(ms.position_ms / 1000);
      const durSec = Math.floor(ms.duration_ms / 1000);
      const formatMin = (s: number) => `${Math.floor(s / 60)}:${s % 60 < 10 ? '0' : ''}${s % 60}`;
      return {
        logs: [
          makeLog(`=== Informasi Musik (${context.musicSource.toUpperCase()}) ===`, 'success'),
          makeLog(`• Judul Lagu : ${ms.title || '(Tanpa Judul)'}`, 'info'),
          makeLog(`• Artis      : ${ms.artist || '(Artis Tidak Diketahui)'}`, 'info'),
          makeLog(`• Status     : ${ms.is_playing ? 'Memutar ▶' : 'Jeda ⏸'}`, 'info'),
          makeLog(`• Posisi     : ${formatMin(curSec)} / ${durSec > 0 ? formatMin(durSec) : '--:--'}`, 'info'),
          makeLog(`• Sumber     : ${ms.source_app || context.musicSource}`, 'info'),
        ],
      };
    }

    case 'settings': {
      const s = context.settings;
      return {
        logs: [
          makeLog('=== Ringkasan Pengaturan MusicIsland ===', 'info'),
          makeLog(`• Warna Aksen    : ${s.accentColor.toUpperCase()}`, 'info'),
          makeLog(`• Standby Auto   : ${s.autoStandby ? 'Aktif' : 'Nonaktif'}`, 'info'),
          makeLog(`• Jeda Standby   : ${s.standbyDelaySeconds} detik`, 'info'),
          makeLog(`• Kecepatan Anim : ${s.animationSpeed}`, 'info'),
          makeLog(`• Always on Top  : ${s.alwaysOnTop ? 'Aktif' : 'Nonaktif'}`, 'info'),
          makeLog(`• Jarak Atas (Y) : ${s.yOffset}px`, 'info'),
        ],
      };
    }

    case 'files': {
      return {
        logs: [
          makeLog('=== Modul File Explorer ===', 'info'),
          makeLog('• Status Modul    : Siap (Ready)', 'success'),
          makeLog('• Izin Akses      : Read-only sandboxed metadata (Least Privilege)', 'info'),
          makeLog('• Format Audio    : .mp3, .wav, .ogg, .m4a, .flac, .aac', 'info'),
          makeLog(`• Antrean Lokal   : ${context.localTracksCount} berkas termuat`, 'info'),
        ],
      };
    }

    case 'perf':
    case 'overboost': {
      const stats = await fetchSystemStats();
      return {
        logs: [
          makeLog('=== Turbo Overboost Performance Monitor ===', 'success'),
          makeLog(`• CPU Usage    : ${Math.round(stats.cpu_usage_percent)}% (${stats.logical_cores} Cores)`, 'info'),
          makeLog(`• RAM Fisik    : ${formatMemory(stats.ram_used_mb)} / ${formatMemory(stats.ram_total_mb)} (${Math.round(stats.ram_usage_percent)}%)`, 'info'),
          makeLog(`• RAM Tersedia : ${formatMemory(stats.ram_available_mb)}`, 'info'),
          makeLog(`• Pagefile     : ${formatMemory(stats.virtual_ram_used_mb)} / ${formatMemory(stats.virtual_ram_total_mb)}`, 'info'),
          makeLog(`• App Process  : ${stats.app_ram_usage_mb.toFixed(0)} MB RAM · ${stats.app_cpu_usage_percent.toFixed(1)}% CPU`, 'info'),
          makeLog(`• Device & OS  : ${stats.device_name} · ${stats.os_name}`, 'info'),
        ],
      };
    }

    default: {
      // Eksekusi semua perintah CMD sistem Windows asli (9router, dir, cd, ipconfig, dll)
      const res = await runSystemCmd(trimmed);
      const outputLogs: TerminalLog[] = [];

      if (res.stdout) {
        outputLogs.push(makeLog(res.stdout.trimEnd(), 'info'));
      }
      if (res.stderr) {
        outputLogs.push(makeLog(res.stderr.trimEnd(), 'error'));
      }
      if (!res.stdout && !res.stderr && res.exit_code === 0) {
        outputLogs.push(makeLog('(Perintah selesai)', 'success'));
      }

      return {
        logs: outputLogs,
        newCwd: res.cwd,
      };
    }
  }
}
