# Arsitektur Modular MusicIsland

Dokumen ini menjelaskan struktur arsitektur project MusicIsland dan panduan menambahkan modul fitur baru (misal: Timer, System Monitor, Pomodoro) di masa mendatang.

---

## 1. Pembagian Tanggung Jawab (Separation of Concerns)

```
src/
├── types/                      # Kontrak TypeScript (Data Types & Interfaces)
│   ├── island.ts               # Interface IslandModule & ModuleContext
│   └── media.ts                # Tipe data Spotify & Windows Media Session
│
├── services/                   # Lapisan Komunikasi Eksternal / Native IPC
│   ├── windowService.ts        # Sinkronisasi ukuran & posisi window native Tauri (idle/compact/expanded)
│   └── mediaService.ts         # Pemanggilan IPC command Rust GSMTC
│
├── hooks/                      # State Management & Business Logic (React Hooks)
│   ├── useClock.ts             # Jam laptop real-time terintegrasi
│   ├── useIslandState.ts       # State morphing notch (idle/compact/expanded)
│   └── useMediaSession.ts      # Polling adaptif, optimistic updates, track time
│
├── modules/                    # Modul-modul Fitur Terisolasi
│   ├── music/                  # Pemutar musik (Spotify GSMTC & audio lokal)
│   ├── explorer/               # File Explorer & picker audio
│   ├── settings/               # Kustomisasi aksen, animasi, standby, monitor sampling
│   ├── terminal/               # Terminal CLI & eksekusi Windows CMD
│   └── monitor/                # Turbo Overboost (Windows 11 CPU, RAM, & Process Monitor)
│
├── components/                 # UI Shell / Kontainer Bersama
│   ├── DynamicIsland.tsx       # Kontainer bentuk pill Dynamic Island
│   └── DynamicIsland.css       # Animasi transisi fluid bezier Apple & styling top bar
│
└── App.tsx / main.tsx          # Root mounting aplikasi desktop
```

### Mode Tampilan Jendela (Window Modes)
1. **Mode 1: Idle (Standby Top Bar)**:
   - Terjadi saat musik tidak berputar / Spotify tidak aktif.
   - Jendela menjadi garis horizontal ramping di puncak layar (`440x28px`).
   - Di tengahnya menampilkan jam digital yang sinkron dengan laptop/Windows beserta hari dan tanggal.
2. **Mode 2: Compact (Music Playing)**:
   - Terjadi secara otomatis saat musik mulai berputar di Spotify.
   - Bertransformasi menjadi Dynamic Island notch hitam Apple (`240x38px`).
   - Jam beradaptasi mengecil di samping kanan, berdampingan dengan equalizer bar hijau dan judul lagu.
3. **Mode 3: Expanded (Music Player)**:
   - Terjadi saat notch diklik.
   - Menampilkan kontrol playback lengkap, timeline, dan cover album besar (`380x178px`).


---

## 2. Cara Menambahkan Modul Baru (Contoh: Modul Timer)

Untuk menambahkan modul baru di masa depan tanpa mengubah arsitektur inti:

### Langkah A: Buat folder modul di `src/modules/<nama-modul>/`
Misalnya `src/modules/timer/`:

1. **`TimerCompact.tsx`**:
   Komponen ringkas saat notch berukuran kecil:
   ```tsx
   import React from 'react';

   export const TimerCompact: React.FC<{ timeLeft: string }> = ({ timeLeft }) => (
     <div className="compact-left">
       <span style={{ fontSize: '12px', fontWeight: 600 }}>⏱️ {timeLeft}</span>
     </div>
   );
   ```

2. **`TimerExpanded.tsx`**:
   Komponen kontrol saat notch diperluas:
   ```tsx
   import React from 'react';

   export const TimerExpanded: React.FC<{ onCollapse: () => void }> = ({ onCollapse }) => (
     <div className="island-content-fade">
       <button onClick={onCollapse}>Tutup</button>
       {/* Kontrol start/pause timer */}
     </div>
   );
   ```

3. **`TimerModule.tsx`**:
   Menghubungkan state timer ke view:
   ```tsx
   import React from 'react';
   import { IslandModuleContext } from '../../types/island';
   import { TimerCompact } from './TimerCompact';
   import { TimerExpanded } from './TimerExpanded';

   export const TimerModuleView: React.FC<IslandModuleContext> = ({ isExpanded, onCollapse }) => {
     // Gunakan hook timer tersendiri
     return isExpanded ? <TimerExpanded onCollapse={onCollapse} /> : <TimerCompact timeLeft="14:59" />;
   };
   ```

### Langkah B: Daftarkan ke DynamicIsland Shell
Di `src/components/DynamicIsland.tsx`, ganti atau tambahkan selector modul aktif:
```tsx
const [activeModule, setActiveModule] = useState<'music' | 'timer'>('music');
```
Saat event notifikasi atau timer berbunyi, switch modul aktif secara dinamis.
