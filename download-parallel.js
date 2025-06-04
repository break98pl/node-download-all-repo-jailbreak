const axios = require('axios');
const fs = require('fs-extra');
const bz2 = require('bz2');

// ⚙️ Cấu hình
const BASE_URL = 'https://rejail.ru/';
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

  const debUrls = [];
  for (const line of rawData.split('\n')) {
    if (line.startsWith('Filename:')) {
      const relPath = line.replace('Filename:', '').trim();
      debUrls.push(BASE_URL + relPath);
    }
  }
  return debUrls;
}

async function downloadDeb(url, index) {
  const fileName = url.split('/').pop();
  const destPath = `${DEB_DIR}/${fileName}`;

  if (await fs.pathExists(destPath)) {
    console.log(`[${index}] ✅ Đã có: ${fileName}`);
    return;
  }

  try {
    const res = await axios.get(url, { responseType: 'stream' });
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
async function downloadAllInBatches(urls, batchSize) {
  let i = 0;
  while (i < urls.length) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.all(
      batch.map((url, idx) => downloadDeb(url, i + idx + 1))
    );
    i += batchSize;
  }
}

async function main() {
  await fs.ensureDir(DEB_DIR);
  try {
    const urls = await fetchPackages();
    console.log(`[+] Tổng cộng ${urls.length} file .deb sẽ được tải.`);
    await downloadAllInBatches(urls, CONCURRENT_DOWNLOADS);
    console.log('[✅] Hoàn tất tải toàn bộ file .deb!');
  } catch (e) {
    console.error('[-] Lỗi:', e.message);
  }
}

main();