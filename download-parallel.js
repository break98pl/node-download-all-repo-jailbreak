const axios = require('axios');
const fs = require('fs-extra');
const bz2 = require('bz2');

// ⚙️ Cấu hình
const BASE_URL = 'https://repo.kenhtao.net/';
const PACKAGES_URL = BASE_URL + 'Packages'; // Hoặc 'Packages.bz2'
const DEB_DIR = './debs';
const CONCURRENT_DOWNLOADS = 5; // 👈 Số lượng tải song song

async function fetchPackages() {
  console.log('[+] Tải Packages...');
  let rawData;
  try {
    const res = await axios.get(PACKAGES_URL, { responseType: 'arraybuffer' });
    rawData = PACKAGES_URL.endsWith('.bz2')
      ? bz2.decompress(res.data).toString()
      : res.data.toString();
  } catch (err) {
    throw new Error('Không thể tải Packages: ' + err.message);
  }

  const packages = [];
  let current = {};
  for (const line of rawData.split('\n')) {
    if (line.startsWith('Package:')) {
      current.package = line.replace('Package:', '').trim();
    } else if (line.startsWith('Version:')) {
      current.version = line.replace('Version:', '').trim();
    } else if (line.startsWith('Architecture:')) {
      current.arch = line.replace('Architecture:', '').trim();
    } else if (line.startsWith('Filename:')) {
      const relPath = line.replace('Filename:', '').trim();
      current.url = BASE_URL + relPath;
      if (current.package && current.version && current.arch && current.url) {
        packages.push(current);
      }
      current = {};
    }
  }
  return packages; // [{package, version, arch, url}, ...]
}

async function downloadDeb(pkg, index) {
  const { package: packageName, version, arch } = pkg;
  const fileName = `${packageName}_${version}_${arch}.deb`; // 👉 có cả architecture
  const destPath = `${DEB_DIR}/${fileName}`;

  if (await fs.pathExists(destPath)) {
    console.log(`[${index}] ✅ Đã có: ${fileName}`);
    return;
  }

  try {
    const res = await axios.get(pkg.url, { responseType: 'stream', headers: {
            "x-machine": "iPhone6,1",
            "x-unique-id": "8843d7f92416211de9ebb963ff4ce28125932878",
            "x-firmware": "10.1.1",
            "user-agent": "Telesphoreo APT-HTTP/1.0.592",
            "accept-encoding": "gzip",
            "host": "repo.kenhtao.net"
        } });
    const writer = fs.createWriteStream(destPath);
    await new Promise((resolve, reject) => {
      res.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    console.log(`[${index}] ✅ Tải xong: ${fileName}`);
  } catch (err) {
    console.warn(`[${index}] ❌ Lỗi khi tải ${fileName}: ${err.message}`);
  }
}

// 🔄 Chia danh sách thành các nhóm tải song song
async function downloadAllInBatches(pkgs, batchSize) {
  let i = 0;
  while (i < pkgs.length) {
    const batch = pkgs.slice(i, i + batchSize);
    await Promise.all(
      batch.map((pkg, idx) => downloadDeb(pkg, i + idx + 1))
    );
    i += batchSize;
  }
}

async function main() {
  await fs.ensureDir(DEB_DIR);
  try {
    const pkgs = await fetchPackages();
    console.log(`[+] Tổng cộng ${pkgs.length} file .deb sẽ được tải.`);
    await downloadAllInBatches(pkgs, CONCURRENT_DOWNLOADS);
    console.log('[✅] Hoàn tất tải toàn bộ file .deb!');
  } catch (e) {
    console.error('[-] Lỗi:', e.message);
  }
}

main();