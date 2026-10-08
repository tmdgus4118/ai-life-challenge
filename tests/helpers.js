const fs = require('fs');
const os = require('os');
const path = require('path');

/** 테스트마다 격리된 임시 DB 디렉터리를 만든다. */
const makeTempDbDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'neighbor-sound-'));

const removeDir = (dir) => {
  if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
};

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

/** 테스트용 사건 입력 */
const sampleEventInput = (overrides = {}) => ({
  started_at: '2026-09-28T13:10:00.000Z', // KST 22:10 (야간)
  ended_at: '2026-09-28T13:10:12.000Z',
  source_group: 'footstep',
  avg_db: 41.2,
  max_db: 58.3,
  ...overrides,
});

module.exports = { makeTempDbDir, removeDir, USER_A, USER_B, sampleEventInput };
