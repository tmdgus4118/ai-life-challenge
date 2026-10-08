const { createModels } = require('../../src/models');
const { createServices } = require('../../src/services');
const { ShareService } = require('../../src/services/ShareService');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');
const { makeTempDbDir, removeDir, USER_A, USER_B } = require('../helpers');

const NOW = new Date('2026-10-02T12:00:00Z');

describe('ShareService', () => {
  let dir; let m; let s;
  beforeEach(async () => {
    dir = makeTempDbDir();
    m = createModels(dir);
    s = createServices(m, { llmProvider: 'template', streamChunkDelayMs: 0, streamThinkMs: 0 });
    await s.demoDataService.seed(USER_A, { now: NOW });
  });
  afterEach(() => removeDir(dir));

  test('실패: 의존성 누락', () => { expect(() => new ShareService({})).toThrow(TypeError); });

  test('newToken: URL에 안전한 22자, 매번 다름', () => {
    const a = ShareService.newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(ShareService.newToken()).not.toBe(a);
  });

  test('sanitize: 메모를 비운다 / 실패', () => {
    expect(ShareService.sanitize({ total_events: 3, memos: [{ memo: '아이가 깸' }] })).toEqual({ total_events: 3, memos: [] });
    expect(() => ShareService.sanitize(null)).toThrow(TypeError);
  });

  test('create: 스냅숏 저장(메모 제외, 14일 만료), 소유자 정보만 반환', async () => {
    await s.reportService.generate(USER_A, 7, NOW);
    const share = await s.shareService.create(USER_A, 7, NOW);
    expect(share.path).toBe(`/s/${share.token}`);
    expect(share.expires_at).toBe('2026-10-16T12:00:00.000Z');
    expect(share).not.toHaveProperty('summary_json');
    const row = await m.shareModel.findByToken(share.token);
    expect(row.summary_json.memos).toEqual([]);
    expect(row.summary_json.total_events).toBeGreaterThan(50);
    expect(row.ai_text).toBeTruthy();
  });

  test('create 실패: 기록이 없는 사용자, 사용자 없음', async () => {
    await expect(s.shareService.create(USER_B, 7, NOW)).rejects.toThrow(ValidationError);
    await expect(s.shareService.create(null, 7, NOW)).rejects.toThrow(ValidationError);
  });

  test('getByToken: 정상 / 잘못된 형식·없는 토큰·취소 404 / 만료 410', async () => {
    const share = await s.shareService.create(USER_A, 7, NOW);
    expect((await s.shareService.getByToken(share.token, NOW)).id).toBe(share.id);
    await expect(s.shareService.getByToken('../etc', NOW)).rejects.toThrow(NotFoundError);
    await expect(s.shareService.getByToken('A'.repeat(22), NOW)).rejects.toThrow(NotFoundError);
    await expect(s.shareService.getByToken(share.token, new Date('2026-10-17T00:00:00Z'))).rejects.toMatchObject({ status: 410 });
    await s.shareService.revoke(USER_A, share.id);
    await expect(s.shareService.getByToken(share.token, NOW)).rejects.toThrow(NotFoundError);
  });

  test('list / revoke: 본인 것만, 만료 표시 / 실패', async () => {
    const share = await s.shareService.create(USER_A, 7, NOW);
    const list = await s.shareService.list(USER_A, new Date('2026-10-20T00:00:00Z'));
    expect(list).toHaveLength(1);
    expect(list[0].expired).toBe(true);
    await expect(s.shareService.revoke(USER_B, share.id)).rejects.toThrow(NotFoundError);
    expect((await s.shareService.revoke(USER_A, share.id)).revoked).toBe(true);
    await expect(s.shareService.revoke(USER_A)).rejects.toThrow(ValidationError);
    await expect(s.shareService.list()).rejects.toThrow(ValidationError);
    expect(() => s.shareService.publicInfo(null)).toThrow(TypeError);
  });

  test('ShareModel: findByToken·findByUser·deleteByUser 실패 케이스', async () => {
    await expect(m.shareModel.findByToken()).rejects.toThrow(TypeError);
    await expect(m.shareModel.findByUser()).rejects.toThrow(TypeError);
    await expect(m.shareModel.deleteByUser()).rejects.toThrow(TypeError);
  });
});
