/**
 * YAMNet TF.js 모델을 로컬(src/public/models/yamnet)에 내려받아 셀프 호스팅한다.
 * TF Hub가 느리거나 막힌 환경에서도 감지 화면이 동작하게 한다.
 *   npm run download-model
 * 주의: 기본 주소(tfhub.dev)는 2025년 TF Hub 종료 뒤 404를 돌려준다. 모델 파일은 저장소에 포함되어 있으므로
 * 보통은 실행할 필요가 없고, 다시 받으려면 YAMNET_SOURCE 환경 변수로 살아 있는 주소를 넘겨야 한다.
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.YAMNET_SOURCE || 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1';
const OUT_DIR = path.join(__dirname, '..', 'public', 'models', 'yamnet');

const fetchBuffer = async (url) => {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
};

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const modelUrl = `${BASE}/model.json?tfjs-format=file`;
  console.log('model.json 다운로드:', modelUrl);
  const modelBuf = await fetchBuffer(modelUrl);
  const model = JSON.parse(modelBuf.toString('utf8'));
  fs.writeFileSync(path.join(OUT_DIR, 'model.json'), modelBuf);
  const paths = (model.weightsManifest || []).flatMap((m) => m.paths || []);
  for (const p of paths) {
    const url = `${BASE}/${p}?tfjs-format=file`;
    console.log('가중치 다운로드:', p);
    fs.writeFileSync(path.join(OUT_DIR, p), await fetchBuffer(url));
  }
  console.log(`완료: ${OUT_DIR} (${paths.length}개 가중치 파일)`);
};

main().catch((err) => {
  console.error('모델 다운로드 실패:', err.message);
  process.exit(1);
});
