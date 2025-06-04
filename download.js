const axios = require('axios');
const fs = require('fs-extra');
const bz2 = require('bz2');

const BASE_URL = 'https://p2kdev.github.io/repo/';
const PACKAGES_URL = BASE_URL + 'Packages'; // hoặc 'Packages.bz2'
const DEB_DIR = './debs';

async function main() {
  await fs.ensureDir(DEB_DIR);

  console.log('[+] Tải Packages...');
  let rawData;
  try {
    const res = await axios.get(PACKAGES_URL, {
        headers: {
            "x-machine": "iPhone6,1",
            "x-unique-id": "8843d7f92416211de9ebb963ff4ce28125932878",
            "x-firmware": "10.1.1",
            "user-agent": "Telesphoreo APT-HTTP/1.0.592",
            "accept-encoding": "gzip",
            "host": "rejail.ru"
        }
    });
    if (PACKAGES_URL.endsWith('.bz2')) {
      console.log('[+] Giải nén Packages.bz2...');
      rawData = bz2.decompress(res.data).toString();
    } else {
      rawData = res.data.toString();
    }
  } catch (err) {
    console.error('[-] Lỗi tải Packages:', err.message);
    return;
  }

  // Phân tích file Packages
  const lines = rawData.split('\n');
  const debUrls = [];
  for (const line of lines) {
    if (line.startsWith('Filename:')) {
      const relativePath = line.replace('Filename:', '').trim();
      debUrls.push(BASE_URL + relativePath);
    }
  }

  console.log(`[+] Tìm thấy ${debUrls.length} file .deb`);

  // Tải từng file .deb
  for (let i = 0; i < debUrls.length; i++) {
    const url = debUrls[i];
    const fileName = url.split('/').pop();
    const destPath = `${DEB_DIR}/${fileName}`;

    if (await fs.pathExists(destPath)) {
      console.log(`[${i + 1}] Đã có: ${fileName}`);
      continue;
    }

    console.log(`[${i + 1}] Đang tải: ${fileName}`);
    try {
      const res = await axios.get(url, { responseType: 'stream', headers: {
            "x-machine": "iPhone6,1",
            "x-unique-id": "8843d7f92416211de9ebb963ff4ce28125932878",
            "x-firmware": "10.1.1",
            "user-agent": "Telesphoreo APT-HTTP/1.0.592",
            "accept-encoding": "gzip",
            "host": "rejail.ru"
        } });
      const writer = fs.createWriteStream(destPath);
      await new Promise((resolve, reject) => {
        res.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (err) {
      console.error(`[-] Lỗi tải ${fileName}: ${err.message}`);
    }
  }

  console.log('[✅] Hoàn tất tải tất cả file .deb');
}

main();