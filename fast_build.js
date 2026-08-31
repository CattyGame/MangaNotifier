const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const asar = require('@electron/asar');

console.log('🚀 Bắt đầu quá trình Fast Build sang file .exe (Self-Contained ASAR Package)...\n');

const projectRoot = __dirname;
const outputDir = path.join(projectRoot, 'release', 'Manga Notifier');
const electronDist = path.join(projectRoot, 'node_modules', 'electron', 'dist');

// 0. Tự động đóng các tiến trình Manga Notifier cũ đang chạy ngầm
try {
  if (process.platform === 'win32') {
    execSync('taskkill /F /IM "Manga Notifier.exe" /T', { stdio: 'ignore' });
  }
} catch (e) {
  // Không có tiến trình nào đang chạy
}

// 1. Build React Frontend
console.log('📦 [1/4] Đang build bundle giao diện React (Vite)...');
execSync('npm run build:react', { stdio: 'inherit', cwd: projectRoot });

// 2. Bundle Electron Backend with esbuild
console.log('\n⚡ [2/4] Đang bundle Backend & Scraper Plugins với esbuild...');
const distElectron = path.join(projectRoot, 'dist_electron');
if (!fs.existsSync(distElectron)) {
  fs.mkdirSync(distElectron, { recursive: true });
}

execSync('npx esbuild electron/main.js --bundle --platform=node --target=node20 --external:electron --outfile=dist_electron/main.js', { stdio: 'inherit', cwd: projectRoot });
execSync('npx esbuild electron/preload.js --bundle --platform=node --target=node20 --external:electron --outfile=dist_electron/preload.js', { stdio: 'inherit', cwd: projectRoot });

// 3. Prepare Staging App Folder for ASAR packing
console.log('\n📦 [3/4] Chuẩn bị đóng gói asar...');
const stagingDir = path.join(projectRoot, 'build_staging');
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// Copy dist (Frontend)
fs.cpSync(path.join(projectRoot, 'dist'), path.join(stagingDir, 'dist'), { recursive: true });

// Copy dist_electron (Backend)
fs.cpSync(path.join(projectRoot, 'dist_electron'), path.join(stagingDir, 'dist_electron'), { recursive: true });

// Production package.json
const prodPkg = {
  name: "manga-notifier-desktop",
  version: "1.0.0",
  main: "dist_electron/main.js"
};
fs.writeFileSync(path.join(stagingDir, 'package.json'), JSON.stringify(prodPkg, null, 2), 'utf-8');

// 4. Prepare Output Directory and copy Electron Runtime
console.log('\n📁 [4/4] Khởi tạo thư mục xuất bản .exe và đóng gói app.asar...');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Copy Electron Prebuilt Engine
const electronFiles = fs.readdirSync(electronDist);
for (const file of electronFiles) {
  const src = path.join(electronDist, file);
  try {
    if (file === 'electron.exe') {
      const dest = path.join(outputDir, 'Manga Notifier.exe');
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    } else if (file !== 'resources') {
      const dest = path.join(outputDir, file);
      if (!fs.existsSync(dest)) {
        fs.cpSync(src, dest, { recursive: true });
      }
    }
  } catch (err) {
    // Skip locked files if already present
  }
}

// Ensure resources dir exists
const targetResources = path.join(outputDir, 'resources');
if (!fs.existsSync(targetResources)) {
  fs.mkdirSync(targetResources, { recursive: true });
}

// Pack stagingDir into resources/app.asar
async function pack() {
  console.log('⚡ Đóng gói app.asar bằng @electron/asar API...');
  const asarOutput = path.join(targetResources, 'app.asar');
  await asar.createPackage(stagingDir, asarOutput);

  // Clean up staging folder
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const finalExePath = path.join(outputDir, 'Manga Notifier.exe');

  console.log('\n======================================================');
  console.log('🎉 FAST BUILD HOÀN TẤT THÀNH CÔNG (100% ĐỘC LẬP & TỐI ƯU)!');
  console.log(`📍 Thư mục ứng dụng: "${outputDir}"`);
  console.log(`🚀 File thực thi: "${finalExePath}"`);
  console.log('======================================================\n');
}

pack().catch(console.error);
