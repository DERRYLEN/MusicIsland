use std::sync::Mutex;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[derive(serde::Serialize, Clone, Debug)]
pub struct MediaState {
    pub available: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub is_playing: bool,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub cover_data_url: Option<String>,
    pub source_app: String,
}

impl MediaState {
    pub fn empty() -> Self {
        Self {
            available: false,
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            is_playing: false,
            position_ms: 0,
            duration_ms: 0,
            cover_data_url: None,
            source_app: "Spotify".to_string(),
        }
    }
}

static CACHED_MEDIA_STATE: Mutex<Option<MediaState>> = Mutex::new(None);
static APP_START_TIME: Mutex<Option<std::time::Instant>> = Mutex::new(None);

#[derive(serde::Serialize, Clone, Debug)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub uptime_seconds: u64,
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    let uptime = APP_START_TIME
        .lock()
        .ok()
        .and_then(|t| t.as_ref().map(|start| start.elapsed().as_secs()))
        .unwrap_or(0);

    AppInfo {
        name: "MusicIsland".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
    }
}

#[cfg(windows)]
mod media {
    use super::{MediaState, CACHED_MEDIA_STATE};
    use base64::engine::general_purpose::STANDARD as BASE64;
    use base64::Engine;
    use std::sync::Mutex;
    use std::time::Duration;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession,
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };
    use windows::Storage::Streams::DataReader;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    static COVER_CACHE: Mutex<Option<(String, String, Option<String>)>> = Mutex::new(None);

    pub fn start_media_worker() {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let mut cached_manager: Option<GlobalSystemMediaTransportControlsSessionManager> = None;

        loop {
            if cached_manager.is_none() {
                if let Ok(op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                    if let Ok(m) = op.get() {
                        cached_manager = Some(m);
                    }
                }
            }

            let state = if let Some(ref manager) = cached_manager {
                get_spotify_media_state(manager)
            } else {
                MediaState::empty()
            };

            // Invalidate stale manager if session disappeared
            if !state.available {
                cached_manager = None;
            }

            let sleep_ms = if !state.available {
                1500 // Idle: Spotify closed or no session
            } else if state.is_playing {
                600 // Active playback: high responsiveness
            } else {
                1200 // Paused: moderate polling
            };

            {
                if let Ok(mut lock) = CACHED_MEDIA_STATE.lock() {
                    *lock = Some(state);
                }
            }
            std::thread::sleep(Duration::from_millis(sleep_ms));
        }

        #[allow(unreachable_code)]
        unsafe {
            CoUninitialize();
        }
    }

    fn detect_app_name(id_lower: &str) -> String {
        if id_lower.contains("spotify") {
            "Spotify".to_string()
        } else if id_lower.contains("youtube") {
            "YouTube Music".to_string()
        } else if id_lower.contains("apple") {
            "Apple Music".to_string()
        } else if id_lower.contains("tidal") {
            "Tidal".to_string()
        } else if id_lower.contains("chrome") || id_lower.contains("msedge") || id_lower.contains("firefox") {
            "Browser Music".to_string()
        } else {
            "Spotify".to_string()
        }
    }

    pub fn find_media_session(
        manager: &GlobalSystemMediaTransportControlsSessionManager,
    ) -> Option<(GlobalSystemMediaTransportControlsSession, String)> {
        // Priority 1: Current active/focused session
        if let Ok(curr) = manager.GetCurrentSession() {
            if let Ok(app_id) = curr.SourceAppUserModelId() {
                let id_lower = app_id.to_string().to_lowercase();
                if id_lower.contains("spotify") || id_lower.contains("music") || id_lower.contains("youtube") {
                    return Some((curr, detect_app_name(&id_lower)));
                }
            }
        }
        // Priority 2: Iterate sessions
        if let Ok(sessions) = manager.GetSessions() {
            for session in sessions {
                if let Ok(app_id) = session.SourceAppUserModelId() {
                    let id_lower = app_id.to_string().to_lowercase();
                    if id_lower.contains("spotify") {
                        return Some((session, "Spotify".to_string()));
                    } else if id_lower.contains("youtube") || id_lower.contains("music") {
                        return Some((session, detect_app_name(&id_lower)));
                    }
                }
            }
        }
        None
    }

    pub fn get_spotify_media_state(
        manager: &GlobalSystemMediaTransportControlsSessionManager,
    ) -> MediaState {
        let (session, source_app) = match find_media_session(manager) {
            Some(s) => s,
            None => return MediaState::empty(),
        };

        let (title, artist, album, thumbnail_ref) = if let Ok(props_op) = session.TryGetMediaPropertiesAsync() {
            if let Ok(props) = props_op.get() {
                let t = props.Title().map(|s| s.to_string()).unwrap_or_default();
                let a = props.Artist().map(|s| s.to_string()).unwrap_or_default();
                let al = props.AlbumTitle().map(|s| s.to_string()).unwrap_or_default();
                let thumb = props.Thumbnail().ok();
                (t, a, al, thumb)
            } else {
                return MediaState::empty();
            }
        } else {
            return MediaState::empty();
        };

        if title.is_empty() && artist.is_empty() {
            return MediaState::empty();
        }

        let cover_data_url = {
            let mut cache = COVER_CACHE.lock().unwrap();
            if let Some((cached_title, cached_artist, cached_cover)) = cache.as_ref() {
                if cached_title == &title && cached_artist == &artist && cached_cover.is_some() {
                    cached_cover.clone()
                } else {
                    let new_cover = extract_thumbnail(thumbnail_ref);
                    if new_cover.is_some() {
                        *cache = Some((title.clone(), artist.clone(), new_cover.clone()));
                    }
                    new_cover
                }
            } else {
                let new_cover = extract_thumbnail(thumbnail_ref);
                if new_cover.is_some() {
                    *cache = Some((title.clone(), artist.clone(), new_cover.clone()));
                }
                new_cover
            }
        };

        let is_playing = if let Ok(info) = session.GetPlaybackInfo() {
            if let Ok(status) = info.PlaybackStatus() {
                status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
            } else {
                false
            }
        } else {
            false
        };

        let (position_ms, duration_ms) = if let Ok(timeline) = session.GetTimelineProperties() {
            let pos = timeline.Position().map(|t| (t.Duration / 10_000) as u64).unwrap_or(0);
            let end = timeline.EndTime().map(|t| (t.Duration / 10_000) as u64).unwrap_or(0);
            (pos, end)
        } else {
            (0, 0)
        };

        MediaState {
            available: true,
            title,
            artist,
            album,
            is_playing,
            position_ms,
            duration_ms,
            cover_data_url,
            source_app,
        }
    }

    fn extract_thumbnail(
        thumb_ref: Option<windows::Storage::Streams::IRandomAccessStreamReference>,
    ) -> Option<String> {
        let thumb_ref = thumb_ref?;
        let stream = thumb_ref.OpenReadAsync().ok()?.get().ok()?;
        let size = stream.Size().ok()? as usize;
        if size == 0 || size > 15_000_000 {
            return None;
        }

        let reader = DataReader::CreateDataReader(&stream).ok()?;
        reader.LoadAsync(size as u32).ok()?.get().ok()?;
        let mut buf = vec![0u8; size];
        reader.ReadBytes(&mut buf).ok()?;

        let b64 = BASE64.encode(&buf);
        Some(format!("data:image/jpeg;base64,{}", b64))
    }

    pub fn toggle_play_pause() {
        std::thread::spawn(|| {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                if let Ok(manager) = manager_op.get() {
                    if let Some((session, _)) = find_media_session(&manager) {
                        let _ = session.TryTogglePlayPauseAsync();
                    }
                }
            }
        });
    }

    pub fn skip_next() {
        std::thread::spawn(|| {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                if let Ok(manager) = manager_op.get() {
                    if let Some((session, _)) = find_media_session(&manager) {
                        let _ = session.TrySkipNextAsync();
                    }
                }
            }
        });
    }

    pub fn skip_previous() {
        std::thread::spawn(|| {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                if let Ok(manager) = manager_op.get() {
                    if let Some((session, _)) = find_media_session(&manager) {
                        let _ = session.TrySkipPreviousAsync();
                    }
                }
            }
        });
    }

    pub fn set_repeat(enable: bool) {
        std::thread::spawn(move || {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                if let Ok(manager) = manager_op.get() {
                    if let Some((session, _)) = find_media_session(&manager) {
                        let mode = if enable {
                            windows::Media::MediaPlaybackAutoRepeatMode::Track
                        } else {
                            windows::Media::MediaPlaybackAutoRepeatMode::None
                        };
                        let _ = session.TryChangeAutoRepeatModeAsync(mode);
                    }
                }
            }
        });
    }

    pub fn set_shuffle(enable: bool) {
        std::thread::spawn(move || {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                if let Ok(manager) = manager_op.get() {
                    if let Some((session, _)) = find_media_session(&manager) {
                        let _ = session.TryChangeShuffleActiveAsync(enable);
                    }
                }
            }
        });
    }

    pub fn pause_playback_sync() {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
        if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
            if let Ok(manager) = manager_op.get() {
                if let Some((session, _)) = find_media_session(&manager) {
                    let _ = session.TryPauseAsync();
                }
            }
        }
    }

    pub fn get_master_volume() -> f32 {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: Result<IMMDeviceEnumerator, _> =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);
            if let Ok(enumerator) = enumerator {
                if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                    if let Ok(endpoint_volume) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) {
                        return endpoint_volume.GetMasterVolumeLevelScalar().unwrap_or(0.7);
                    }
                }
            }
            0.7
        }
    }

    pub fn set_master_volume(level: f32) {
        std::thread::spawn(move || {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                let enumerator: Result<IMMDeviceEnumerator, _> =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);
                if let Ok(enumerator) = enumerator {
                    if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                        if let Ok(endpoint_volume) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) {
                            let clamped = level.clamp(0.0, 1.0);
                            let _ = endpoint_volume.SetMasterVolumeLevelScalar(clamped, std::ptr::null());
                        }
                    }
                }
            }
        });
    }

    pub fn seek_playback_position(position_ms: u64) {
        std::thread::spawn(move || {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                if let Ok(manager) = manager_op.get() {
                    if let Some((session, _)) = find_media_session(&manager) {
                        let requested_hns = (position_ms as i64) * 10_000;
                        let _ = session.TryChangePlaybackPositionAsync(requested_hns);
                    }
                }
            }
        });
    }

    pub fn toggle_master_mute() -> bool {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: Result<IMMDeviceEnumerator, _> =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);
            if let Ok(enumerator) = enumerator {
                if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                    if let Ok(endpoint_volume) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) {
                        let is_muted = endpoint_volume.GetMute().map(|b| b.as_bool()).unwrap_or(false);
                        let next_mute = !is_muted;
                        let _ = endpoint_volume.SetMute(next_mute, std::ptr::null());
                        return next_mute;
                    }
                }
            }
            false
        }
    }

    pub fn open_output_device_settings() {
        let _ = std::process::Command::new("explorer")
            .arg("ms-settings:sound")
            .spawn();
    }
}

#[tauri::command]
fn get_media_state() -> MediaState {
    if let Ok(lock) = CACHED_MEDIA_STATE.lock() {
        lock.clone().unwrap_or_else(MediaState::empty)
    } else {
        MediaState::empty()
    }
}

#[tauri::command]
fn media_toggle_play_pause() -> Result<(), String> {
    #[cfg(windows)]
    {
        media::toggle_play_pause();
    }
    Ok(())
}

#[tauri::command]
fn media_next() -> Result<(), String> {
    #[cfg(windows)]
    {
        media::skip_next();
    }
    Ok(())
}

#[tauri::command]
fn media_prev() -> Result<(), String> {
    #[cfg(windows)]
    {
        media::skip_previous();
    }
    Ok(())
}

#[tauri::command]
fn media_set_repeat(enable: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        media::set_repeat(enable);
    }
    Ok(())
}

#[tauri::command]
fn media_set_shuffle(enable: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        media::set_shuffle(enable);
    }
    Ok(())
}

#[tauri::command]
fn get_system_volume() -> f32 {
    #[cfg(windows)]
    {
        media::get_master_volume()
    }
    #[cfg(not(windows))]
    {
        0.7
    }
}

#[tauri::command]
fn set_system_volume(level: f32) -> Result<(), String> {
    #[cfg(windows)]
    {
        media::set_master_volume(level);
    }
    Ok(())
}

#[tauri::command]
fn toggle_system_mute() -> Result<bool, String> {
    #[cfg(windows)]
    {
        Ok(media::toggle_master_mute())
    }
    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

#[tauri::command]
fn open_output_settings() -> Result<(), String> {
    #[cfg(windows)]
    {
        media::open_output_device_settings();
    }
    Ok(())
}

#[tauri::command]
fn media_seek_position(position_ms: u64) -> Result<(), String> {
    #[cfg(windows)]
    {
        media::seek_playback_position(position_ms);
    }
    Ok(())
}

#[tauri::command]
fn media_pause_sync() -> Result<(), String> {
    #[cfg(windows)]
    {
        media::pause_playback_sync();
    }
    Ok(())
}

#[cfg(windows)]
unsafe extern "system" fn console_ctrl_handler(_ctrl_type: u32) -> windows::Win32::Foundation::BOOL {
    media::pause_playback_sync();
    windows::Win32::Foundation::BOOL(0)
}

fn find_browser_app_exe() -> Option<std::path::PathBuf> {
    let candidates = [
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    for p in candidates {
        let path = std::path::PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }
    None
}

fn find_spotify_exe() -> Option<std::path::PathBuf> {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let store_path = std::path::PathBuf::from(&local_app_data)
            .join("Microsoft")
            .join("WindowsApps")
            .join("SpotifyAB.SpotifyMusic_zpdnekdrzrea0")
            .join("Spotify.exe");
        if store_path.exists() {
            return Some(store_path);
        }

        let store_app = std::path::PathBuf::from(&local_app_data)
            .join("Microsoft")
            .join("WindowsApps")
            .join("Spotify.exe");
        if store_app.exists() {
            return Some(store_app);
        }
    }

    if let Ok(app_data) = std::env::var("APPDATA") {
        let standard_path = std::path::PathBuf::from(&app_data)
            .join("Spotify")
            .join("Spotify.exe");
        if standard_path.exists() {
            return Some(standard_path);
        }
    }
    None
}

#[tauri::command]
fn launch_music_app(app_type: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::thread::spawn(move || {
            if app_type == "spotify" {
                let has_session = if let Ok(lock) = CACHED_MEDIA_STATE.lock() {
                    lock.as_ref().map(|s| s.available).unwrap_or(false)
                } else {
                    false
                };

                if !has_session {
                    if let Some(exe_path) = find_spotify_exe() {
                        let _ = std::process::Command::new(exe_path)
                            .arg("--minimized")
                            .spawn();
                    } else {
                        let _ = std::process::Command::new("cmd")
                            .args(["/c", "start", "/min", "", "spotify:"])
                            .spawn();
                    }
                }

                // Active window suppression watchdog for 3.5 seconds:
                // Scans by process ID (Spotify.exe) and window title to guarantee Spotify never stays on screen
                let start = std::time::Instant::now();
                while start.elapsed() < std::time::Duration::from_millis(3500) {
                    unsafe {
                        use windows::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM};
                        use windows::Win32::System::Threading::{
                            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
                            PROCESS_QUERY_LIMITED_INFORMATION,
                        };
                        use windows::Win32::UI::WindowsAndMessaging::{
                            EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
                            ShowWindow, SW_HIDE, SW_MINIMIZE,
                        };

                        unsafe extern "system" fn enum_window_callback(
                            hwnd: HWND,
                            _lparam: LPARAM,
                        ) -> BOOL {
                            if IsWindowVisible(hwnd).as_bool() {
                                let mut pid = 0u32;
                                let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
                                if pid != 0 {
                                    if let Ok(handle) =
                                        OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
                                    {
                                        let mut path_buf = [0u16; 512];
                                        let mut size = 512u32;
                                        if QueryFullProcessImageNameW(
                                            handle,
                                            PROCESS_NAME_FORMAT(0),
                                            windows::core::PWSTR(path_buf.as_mut_ptr()),
                                            &mut size,
                                        )
                                        .is_ok()
                                        {
                                            let path_str =
                                                String::from_utf16_lossy(&path_buf[..size as usize])
                                                    .to_lowercase();
                                            if path_str.contains("spotify") {
                                                let _ = ShowWindow(hwnd, SW_MINIMIZE);
                                                let _ = ShowWindow(hwnd, SW_HIDE);
                                            }
                                        }
                                        let _ = CloseHandle(handle);
                                    }
                                }

                                // Secondary check by title
                                let mut buf = [0u16; 256];
                                let len = GetWindowTextW(hwnd, &mut buf);
                                if len > 0 {
                                    let title =
                                        String::from_utf16_lossy(&buf[..len as usize]).to_lowercase();
                                    if title.contains("spotify") {
                                        let _ = ShowWindow(hwnd, SW_MINIMIZE);
                                        let _ = ShowWindow(hwnd, SW_HIDE);
                                    }
                                }
                            }
                            BOOL(1)
                        }

                        let _ = EnumWindows(Some(enum_window_callback), LPARAM(0));
                    }
                    std::thread::sleep(std::time::Duration::from_millis(150));
                }

                // Send play command via Windows Media Play/Pause virtual key
                unsafe {
                    use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYEVENTF_KEYUP};
                    keybd_event(0xB3, 0, Default::default(), 0);
                    keybd_event(0xB3, 0, KEYEVENTF_KEYUP, 0);
                }
            } else if app_type == "youtube" {
                if let Some(browser_exe) = find_browser_app_exe() {
                    let _ = std::process::Command::new(browser_exe)
                        .args([
                            "--app=https://music.youtube.com",
                            "--window-position=-32000,-32000",
                            "--window-size=1,1",
                            "--start-minimized",
                        ])
                        .spawn();
                }
            }
        });
    }
    Ok(())
}

static PREF_ALWAYS_ON_TOP: Mutex<bool> = Mutex::new(false);
static PREF_Y_OFFSET: Mutex<f64> = Mutex::new(8.0);

fn reposition_window(window: &tauri::WebviewWindow, mode: &str) {
    let monitor_opt = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    if let Some(monitor) = monitor_opt {
        let scale_factor = monitor.scale_factor();

        let logical_width = 460.0;
        let logical_height = if mode == "expanded" { 196.0 } else { 48.0 };

        let physical_width = (logical_width * scale_factor).round() as u32;
        let physical_height = (logical_height * scale_factor).round() as u32;

        let screen_width = monitor.size().width;
        let monitor_x = monitor.position().x;
        let monitor_y = monitor.position().y;

        let y_offset = PREF_Y_OFFSET.lock().map(|v| *v).unwrap_or(8.0).clamp(0.0, 32.0);
        let always_on_top = PREF_ALWAYS_ON_TOP.lock().map(|v| *v).unwrap_or(false);

        // Posisi tepat di tengah horizontal monitor fisik (horizontal center)
        let physical_x = monitor_x + ((screen_width as i32 - physical_width as i32) / 2);
        let physical_y = monitor_y + (y_offset * scale_factor).round() as i32;

        let _ = window.set_size(PhysicalSize::new(physical_width, physical_height));
        let _ = window.set_position(PhysicalPosition::new(physical_x, physical_y));
        let _ = window.set_always_on_top(always_on_top);
    }
}

#[tauri::command]
fn update_window_preferences(app: AppHandle, always_on_top: bool, y_offset: f64) -> Result<(), String> {
    if let Ok(mut lock) = PREF_ALWAYS_ON_TOP.lock() {
        *lock = always_on_top;
    }
    if let Ok(mut lock) = PREF_Y_OFFSET.lock() {
        *lock = y_offset.clamp(0.0, 32.0);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(always_on_top);
    }
    Ok(())
}

#[tauri::command]
fn update_island_state(app: AppHandle, mode: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        reposition_window(&window, &mode);
    }
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: u64,
    pub extension: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DirectoryListing {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub items: Vec<FileItem>,
}

#[tauri::command]
fn list_directory(target_path: Option<String>) -> Result<DirectoryListing, String> {
    let dir = match target_path {
        Some(ref p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
        _ => {
            if let Ok(userprofile) = std::env::var("USERPROFILE") {
                let music = std::path::PathBuf::from(&userprofile).join("Music");
                if music.exists() && music.is_dir() {
                    music
                } else {
                    std::path::PathBuf::from(userprofile)
                }
            } else {
                std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("C:\\"))
            }
        }
    };

    let canonical_dir = dir.canonicalize().map_err(|e| format!("Path tidak valid: {}", e))?;
    if !canonical_dir.is_dir() {
        return Err("Target bukan direktori folder".to_string());
    }

    let parent_path = canonical_dir.parent().map(|p| p.to_string_lossy().to_string());
    let current_path = canonical_dir.to_string_lossy().to_string();

    let mut items = Vec::new();
    let read_dir = std::fs::read_dir(&canonical_dir)
        .map_err(|e| format!("Gagal mengakses folder (Permission Denied): {}", e))?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('$') || name.eq_ignore_ascii_case("desktop.ini") {
            continue;
        }

        let is_dir = path.is_dir();
        let metadata = entry.metadata().ok();
        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_ms = metadata
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let extension = if is_dir {
            None
        } else {
            path.extension().map(|e| e.to_string_lossy().to_lowercase())
        };

        items.push(FileItem {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            size,
            modified_ms,
            extension,
        });
    }

    // Urutkan: folder di atas, lalu berdasarkan nama abjad A-Z
    items.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(DirectoryListing {
        current_path,
        parent_path,
        items,
    })
}

#[tauri::command]
fn open_in_system(target_path: String) -> Result<(), String> {
    let p = std::path::Path::new(&target_path);
    if !p.exists() {
        return Err("File atau folder tidak ditemukan".to_string());
    }

    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer")
            .arg(&target_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn read_audio_base64(file_path: String) -> Result<String, String> {
    use base64::engine::general_purpose::STANDARD as BASE64;
    use base64::Engine;

    let p = std::path::PathBuf::from(&file_path);
    if !p.is_file() {
        return Err("File audio tidak ditemukan".to_string());
    }

    let metadata = p.metadata().map_err(|e| e.to_string())?;
    if metadata.len() > 80 * 1024 * 1024 {
        return Err("Ukuran file audio melebihi batas 80MB".to_string());
    }

    let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
    let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();

    let mime = match ext.as_str() {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        _ => "audio/mpeg",
    };

    let b64 = BASE64.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

static TERMINAL_CWD: Mutex<Option<std::path::PathBuf>> = Mutex::new(None);

#[derive(serde::Serialize, Clone, Debug)]
pub struct CmdResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub cwd: String,
}

fn get_or_init_terminal_cwd() -> std::path::PathBuf {
    let mut lock = TERMINAL_CWD.lock().unwrap();
    if let Some(ref p) = *lock {
        p.clone()
    } else {
        let initial = if let Ok(u) = std::env::var("USERPROFILE") {
            std::path::PathBuf::from(u)
        } else {
            std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("C:\\"))
        };
        *lock = Some(initial.clone());
        initial
    }
}

#[tauri::command]
fn get_terminal_cwd() -> String {
    get_or_init_terminal_cwd().to_string_lossy().to_string()
}

#[tauri::command]
fn execute_system_cmd(command: String) -> Result<CmdResult, String> {
    let trimmed = command.trim();
    let cwd = get_or_init_terminal_cwd();

    // Penanganan perintah internal `cd`
    if trimmed.eq_ignore_ascii_case("cd") {
        return Ok(CmdResult {
            stdout: cwd.to_string_lossy().to_string(),
            stderr: String::new(),
            exit_code: 0,
            cwd: cwd.to_string_lossy().to_string(),
        });
    }

    if trimmed.to_lowercase().starts_with("cd ") {
        let raw_target = trimmed[3..].trim().trim_matches('"');
        let target_path = if raw_target == ".." {
            cwd.parent().map(|p| p.to_path_buf()).unwrap_or(cwd.clone())
        } else if raw_target == "\\" || raw_target == "/" {
            std::path::PathBuf::from(cwd.components().next().map(|c| c.as_os_str()).unwrap_or_default())
        } else {
            let p = std::path::Path::new(raw_target);
            if p.is_absolute() {
                p.to_path_buf()
            } else {
                cwd.join(p)
            }
        };

        if target_path.exists() && target_path.is_dir() {
            let canonical = target_path.canonicalize().unwrap_or(target_path);
            let clean_path = std::path::PathBuf::from(
                canonical.to_string_lossy().trim_start_matches(r"\\?\").to_string()
            );
            if let Ok(mut lock) = TERMINAL_CWD.lock() {
                *lock = Some(clean_path.clone());
            }
            return Ok(CmdResult {
                stdout: String::new(),
                stderr: String::new(),
                exit_code: 0,
                cwd: clean_path.to_string_lossy().to_string(),
            });
        } else {
            return Ok(CmdResult {
                stdout: String::new(),
                stderr: format!("The system cannot find the path specified: {}", raw_target),
                exit_code: 1,
                cwd: cwd.to_string_lossy().to_string(),
            });
        }
    }

    // Penanganan perpindahan drive letter Windows (misal: d: atau c:)
    if trimmed.len() == 2 && trimmed.ends_with(':') && trimmed.chars().next().map(|c| c.is_ascii_alphabetic()).unwrap_or(false) {
        let drive_root = format!("{}\\", trimmed.to_uppercase());
        let target_path = std::path::PathBuf::from(&drive_root);
        if target_path.exists() && target_path.is_dir() {
            if let Ok(mut lock) = TERMINAL_CWD.lock() {
                *lock = Some(target_path.clone());
            }
            return Ok(CmdResult {
                stdout: String::new(),
                stderr: String::new(),
                exit_code: 0,
                cwd: target_path.to_string_lossy().to_string(),
            });
        }
    }

    // Eksekusi via Windows cmd.exe /c
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // Siapkan PATH lengkap agar executable npm global (seperti 9router) dan program user selalu ditemukan
        let mut env_path = std::env::var("PATH").unwrap_or_default();
        if let Ok(appdata) = std::env::var("APPDATA") {
            let npm_path = format!("{}\\npm", appdata);
            if !env_path.contains(&npm_path) {
                env_path = format!("{};{}", npm_path, env_path);
            }
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let npm_path = format!("{}\\AppData\\Roaming\\npm", userprofile);
            if !env_path.contains(&npm_path) {
                env_path = format!("{};{}", npm_path, env_path);
            }
            let win_apps = format!("{}\\AppData\\Local\\Microsoft\\WindowsApps", userprofile);
            if !env_path.contains(&win_apps) {
                env_path = format!("{};{}", win_apps, env_path);
            }
        }

        // Penanganan khusus 9router: jika tanpa argumen, jalankan server di jendela terpisah
        // agar proses server / TUI interaktif tidak memblokir thread MusicIsland
        let lower = trimmed.to_lowercase();
        if lower == "9router" || lower == "9router start" {
            let _ = std::process::Command::new("cmd.exe")
                .args(["/c", "start", "", "9router"])
                .current_dir(&cwd)
                .env("PATH", &env_path)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();

            return Ok(CmdResult {
                stdout: "🚀 9Router server sedang dijalankan di jendela terpisah...\n🌐 Dashboard: http://localhost:20128/dashboard\n(Ketik '9router -h' untuk opsi parameter)".to_string(),
                stderr: String::new(),
                exit_code: 0,
                cwd: cwd.to_string_lossy().to_string(),
            });
        }

        let cmd_string = format!("chcp 65001 >nul & call {}", trimmed);

        let child = match std::process::Command::new("cmd.exe")
            .args(["/c", &cmd_string])
            .current_dir(&cwd)
            .env("PATH", &env_path)
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => return Err(format!("Gagal menjalankan perintah CMD: {}", e)),
        };

        // Tunggu proses dengan timeout 8 detik agar perintah interaktif/server tidak menggantung aplikasi
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let res = child.wait_with_output();
            let _ = tx.send(res);
        });

        match rx.recv_timeout(std::time::Duration::from_secs(8)) {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let exit_code = output.status.code().unwrap_or(0);

                Ok(CmdResult {
                    stdout,
                    stderr,
                    exit_code,
                    cwd: cwd.to_string_lossy().to_string(),
                })
            }
            Ok(Err(e)) => Err(format!("Gagal membaca output perintah: {}", e)),
            Err(_) => {
                // Timeout: proses berlangsung lama atau menunggu input TTY (seperti ping -t atau server)
                Ok(CmdResult {
                    stdout: "Perintah sedang berjalan di latar belakang (timeout 8 detik).\nGunakan 'start <perintah>' untuk membuka di jendela konsol terpisah.".to_string(),
                    stderr: String::new(),
                    exit_code: 0,
                    cwd: cwd.to_string_lossy().to_string(),
                })
            }
        }
    }

    #[cfg(not(windows))]
    {
        let output = std::process::Command::new("sh")
            .args(["-c", trimmed])
            .current_dir(&cwd)
            .output()
            .map_err(|e| format!("Gagal menjalankan perintah: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(0);

        Ok(CmdResult {
            stdout,
            stderr,
            exit_code,
            cwd: cwd.to_string_lossy().to_string(),
        })
    }
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct SystemStats {
    pub cpu_usage_percent: f32,
    pub logical_cores: u32,
    pub ram_total_mb: u64,
    pub ram_used_mb: u64,
    pub ram_available_mb: u64,
    pub ram_usage_percent: f32,
    pub virtual_ram_total_mb: u64,
    pub virtual_ram_used_mb: u64,
    pub virtual_ram_available_mb: u64,
    pub app_ram_usage_mb: f32,
    pub app_cpu_usage_percent: f32,
    pub device_name: String,
    pub os_name: String,
    pub is_valid: bool,
}

#[cfg(windows)]
mod monitor {
    use super::SystemStats;
    use std::sync::Mutex;
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    use windows::Win32::System::Threading::{GetCurrentProcess, GetProcessTimes, GetSystemTimes};

    fn filetime_to_u64(ft: FILETIME) -> u64 {
        ((ft.dwHighDateTime as u64) << 32) | (ft.dwLowDateTime as u64)
    }

    struct CpuState {
        prev_idle: u64,
        prev_kernel: u64,
        prev_user: u64,
        prev_app_kernel: u64,
        prev_app_user: u64,
        prev_time: std::time::Instant,
        last_cpu_pct: f32,
        last_app_cpu_pct: f32,
    }

    static CPU_STATE: Mutex<Option<CpuState>> = Mutex::new(None);

    pub fn init_cpu_state() {
        let mut idle = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();

        let mut app_creation = FILETIME::default();
        let mut app_exit = FILETIME::default();
        let mut app_kernel = FILETIME::default();
        let mut app_user = FILETIME::default();

        unsafe {
            let _ = GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user));
            let proc = GetCurrentProcess();
            let _ = GetProcessTimes(
                proc,
                &mut app_creation,
                &mut app_exit,
                &mut app_kernel,
                &mut app_user,
            );
        }

        let mut lock = CPU_STATE.lock().unwrap();
        *lock = Some(CpuState {
            prev_idle: filetime_to_u64(idle),
            prev_kernel: filetime_to_u64(kernel),
            prev_user: filetime_to_u64(user),
            prev_app_kernel: filetime_to_u64(app_kernel),
            prev_app_user: filetime_to_u64(app_user),
            prev_time: std::time::Instant::now(),
            last_cpu_pct: 0.0,
            last_app_cpu_pct: 0.0,
        });
    }

    pub fn sample_system_stats() -> SystemStats {
        let logical_cores = std::thread::available_parallelism()
            .map(|n| n.get() as u32)
            .unwrap_or(1);

        let mut idle = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();

        let mut app_creation = FILETIME::default();
        let mut app_exit = FILETIME::default();
        let mut app_kernel = FILETIME::default();
        let mut app_user = FILETIME::default();

        unsafe {
            let _ = GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user));
            let proc = GetCurrentProcess();
            let _ = GetProcessTimes(
                proc,
                &mut app_creation,
                &mut app_exit,
                &mut app_kernel,
                &mut app_user,
            );
        }

        let idle_u64 = filetime_to_u64(idle);
        let kernel_u64 = filetime_to_u64(kernel);
        let user_u64 = filetime_to_u64(user);

        let app_kernel_u64 = filetime_to_u64(app_kernel);
        let app_user_u64 = filetime_to_u64(app_user);

        let (cpu_usage_percent, app_cpu_usage_percent) = {
            let mut lock = CPU_STATE.lock().unwrap();
            if let Some(ref mut state) = *lock {
                let now = std::time::Instant::now();
                let elapsed = now.duration_since(state.prev_time);

                if elapsed.as_millis() >= 250 {
                    let idle_delta = idle_u64.saturating_sub(state.prev_idle);
                    let kernel_delta = kernel_u64.saturating_sub(state.prev_kernel);
                    let user_delta = user_u64.saturating_sub(state.prev_user);
                    let total_sys = kernel_delta + user_delta;

                    if total_sys > 0 && total_sys >= idle_delta {
                        let busy = total_sys - idle_delta;
                        state.last_cpu_pct = ((busy as f64 / total_sys as f64) * 100.0)
                            .clamp(0.0, 100.0) as f32;
                    }

                    let app_kernel_delta = app_kernel_u64.saturating_sub(state.prev_app_kernel);
                    let app_user_delta = app_user_u64.saturating_sub(state.prev_app_user);
                    let app_total = app_kernel_delta + app_user_delta;

                    if total_sys > 0 {
                        let app_pct = ((app_total as f64 / total_sys as f64) * 100.0)
                            .clamp(0.0, 100.0) as f32;
                        state.last_app_cpu_pct = app_pct;
                    }

                    state.prev_idle = idle_u64;
                    state.prev_kernel = kernel_u64;
                    state.prev_user = user_u64;
                    state.prev_app_kernel = app_kernel_u64;
                    state.prev_app_user = app_user_u64;
                    state.prev_time = now;
                }
                (state.last_cpu_pct, state.last_app_cpu_pct)
            } else {
                (0.0, 0.0)
            }
        };

        let mut mem = MEMORYSTATUSEX {
            dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
            ..Default::default()
        };

        let mem_ok = unsafe { GlobalMemoryStatusEx(&mut mem) }.is_ok();

        let ram_total_mb = mem.ullTotalPhys / (1024 * 1024);
        let ram_avail_mb = mem.ullAvailPhys / (1024 * 1024);
        let ram_used_mb = ram_total_mb.saturating_sub(ram_avail_mb);
        let ram_pct = if ram_total_mb > 0 {
            ((ram_used_mb as f64 / ram_total_mb as f64) * 100.0) as f32
        } else {
            mem.dwMemoryLoad as f32
        };

        let vram_total_mb = mem.ullTotalPageFile / (1024 * 1024);
        let vram_avail_mb = mem.ullAvailPageFile / (1024 * 1024);
        let vram_used_mb = vram_total_mb.saturating_sub(vram_avail_mb);

        let mut pmc = PROCESS_MEMORY_COUNTERS {
            cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
            ..Default::default()
        };
        let app_ram_mb = unsafe {
            let proc = GetCurrentProcess();
            if GetProcessMemoryInfo(
                proc,
                &mut pmc,
                std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
            )
            .is_ok()
            {
                (pmc.WorkingSetSize as f64 / (1024.0 * 1024.0)) as f32
            } else {
                0.0
            }
        };

        let device_name = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows 11 PC".to_string());
        let os_name = "Windows 11".to_string();

        SystemStats {
            cpu_usage_percent: cpu_usage_percent.clamp(0.0, 100.0),
            logical_cores,
            ram_total_mb,
            ram_used_mb,
            ram_available_mb: ram_avail_mb,
            ram_usage_percent: ram_pct.clamp(0.0, 100.0),
            virtual_ram_total_mb: vram_total_mb,
            virtual_ram_used_mb: vram_used_mb,
            virtual_ram_available_mb: vram_avail_mb,
            app_ram_usage_mb: app_ram_mb,
            app_cpu_usage_percent: app_cpu_usage_percent.clamp(0.0, 100.0),
            device_name,
            os_name,
            is_valid: mem_ok,
        }
    }
}

#[tauri::command]
fn get_system_stats() -> SystemStats {
    #[cfg(windows)]
    {
        monitor::sample_system_stats()
    }
    #[cfg(not(windows))]
    {
        SystemStats {
            cpu_usage_percent: 0.0,
            logical_cores: std::thread::available_parallelism().map(|n| n.get() as u32).unwrap_or(1),
            ram_total_mb: 16384,
            ram_used_mb: 8192,
            ram_available_mb: 8192,
            ram_usage_percent: 50.0,
            virtual_ram_total_mb: 16384,
            virtual_ram_used_mb: 8192,
            virtual_ram_available_mb: 8192,
            app_ram_usage_mb: 45.0,
            app_cpu_usage_percent: 0.5,
            device_name: "Desktop".to_string(),
            os_name: "Windows".to_string(),
            is_valid: true,
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Ok(mut lock) = APP_START_TIME.lock() {
                *lock = Some(std::time::Instant::now());
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
                let _ = window.set_shadow(false);
                let _ = window.set_always_on_top(false);
                let _ = window.show();
                reposition_window(&window, "compact");
            }

            #[cfg(windows)]
            {
                monitor::init_cpu_state();
                unsafe {
                    use windows::Win32::System::Console::SetConsoleCtrlHandler;
                    let _ = SetConsoleCtrlHandler(Some(console_ctrl_handler), true);
                }
                std::thread::spawn(media::start_media_worker);
            }

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                #[cfg(windows)]
                {
                    media::pause_playback_sync();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            update_island_state,
            get_media_state,
            media_toggle_play_pause,
            media_next,
            media_prev,
            media_set_repeat,
            media_set_shuffle,
            media_seek_position,
            media_pause_sync,
            get_system_volume,
            set_system_volume,
            toggle_system_mute,
            open_output_settings,
            launch_music_app,
            list_directory,
            open_in_system,
            read_audio_base64,
            update_window_preferences,
            get_app_info,
            execute_system_cmd,
            get_terminal_cwd,
            get_system_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
