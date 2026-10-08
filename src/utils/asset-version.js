const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 정적 파일(css·js·shared) 내용으로 짧은 해시를 만든다.
 * 내용이 바뀌면 값이 바뀌므로 ?v= 쿼리와 서비스 워커 캐시 이름이 배포마다 자동으로 갱신된다.
 */
class AssetVersion {
  static listFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) return AssetVersion.listFiles(full);
      return /\.(css|js|json|svg|webmanifest)$/.test(d.name) ? [full] : [];
    }).sort();
  }

  /** @param {string[]} dirs 해시에 포함할 폴더 @param {string} base 앞에 붙일 값(예: 패키지 버전) */
  static compute(dirs, base = '') {
    if (!Array.isArray(dirs) || dirs.length === 0) throw new TypeError('dirs must be a non-empty array');
    const hash = crypto.createHash('sha1');
    hash.update(String(base));
    dirs.forEach((dir) => AssetVersion.listFiles(dir).forEach((file) => {
      hash.update(path.basename(file));
      hash.update(fs.readFileSync(file));
    }));
    return `${base ? base + '-' : ''}${hash.digest('hex').slice(0, 8)}`;
  }
}

module.exports = { AssetVersion };
