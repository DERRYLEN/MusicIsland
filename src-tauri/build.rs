use std::fs;
use std::path::Path;

fn main() {
    let icons_dir = Path::new("icons");
    let _ = fs::create_dir_all(icons_dir);

    let icon_ico = icons_dir.join("icon.ico");
    if !icon_ico.exists() {
        // Minimal 70-byte valid 1x1 32-bit Windows .ico
        let ico_bytes: [u8; 70] = [
            0, 0, 1, 0, 1, 0,
            1, 1, 0, 0, 1, 0, 32, 0, 48, 0, 0, 0, 22, 0, 0, 0,
            40, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 255,
            0, 0, 0, 0,
        ];
        let _ = fs::write(icon_ico, &ico_bytes);
    }

    // 1x1 valid PNG bytes
    let png_bytes: [u8; 68] = [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
        0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
        0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78,
        0x9C, 0x63, 0x64, 0xF8, 0xCF, 0x50, 0x0F, 0x00, 0x03, 0x86, 0x01, 0x80, 0x5A, 0x34,
        0x7D, 0x6B, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
    ];

    let png_files = [
        "32x32.png",
        "128x128.png",
        "128x128@2x.png",
        "icon.png",
    ];

    for file in png_files {
        let p = icons_dir.join(file);
        if !p.exists() {
            let _ = fs::write(p, &png_bytes);
        }
    }

    tauri_build::build();
}
