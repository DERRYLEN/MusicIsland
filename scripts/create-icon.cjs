const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 70-byte valid Windows .ico file (1x1 32bpp)
const icoBytes = Buffer.from([
  0, 0, 1, 0, 1, 0,
  1, 1, 0, 0, 1, 0, 32, 0, 48, 0, 0, 0, 22, 0, 0, 0,
  40, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 255,
  0, 0, 0, 0
]);

fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBytes);
console.log('Icon created at:', path.join(iconsDir, 'icon.ico'));
