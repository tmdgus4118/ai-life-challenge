const { createModels } = require('../../src/models');
const { makeTempDbDir, removeDir, USER_A, USER_B } = require('../helpers');

describe('domain models', () => {
  let dir; let m;
  beforeEach(() => { dir = makeTempDbDir(); m = createModels(dir); });
  afterEach(() => removeDir(dir));

  describe('EventModel', () => {
    const base = { user_id: USER_A, source_group: 'footstep', avg_db: 40, max_db: 50 };
    beforeEach(async () => {
      await m.eventModel.insertMany([
        { ...base, started_at: '2026-09-28T13:00:00Z' },
        { ...base, started_at: '2026-09-29T13:00:00Z', source_group: 'pet' },
        { ...base, started_at: '2026-09-30T13:00:00Z', excluded: true },
        { ...base, user_id: USER_B, started_at: '2026-09-28T13:00:00Z' },
      ]);
    });
    test('findByUser: 사용자별·기간·소음원 필터, 제외 사건 숨김, 시간순 정렬', async () => {
      const all = await m.eventModel.findByUser(USER_A);
      expect(all).toHaveLength(2);
      expect(all[0].started_at < all[1].started_at).toBe(true);
      expect(await m.eventModel.findByUser(USER_A, { includeExcluded: true })).toHaveLength(3);
      expect(await m.eventModel.findByUser(USER_A, { source: 'pet' })).toHaveLength(1);
      expect(await m.eventModel.findByUser(USER_A, { from: '2026-09-29T00:00:00Z', to: '2026-09-30T00:00:00Z' })).toHaveLength(1);
    });
    test('findByUser 실패: userId 누락, 잘못된 날짜', async () => {
      await expect(m.eventModel.findByUser()).rejects.toThrow(TypeError);
      await expect(m.eventModel.findByUser(USER_A, { from: 'bad' })).rejects.toThrow(TypeError);
    });
    test('findRecent: 최신순 n개', async () => {
      const recent = await m.eventModel.findRecent(USER_A, 1);
      expect(recent).toHaveLength(1);
      expect(recent[0].source_group).toBe('pet');
      await expect(m.eventModel.findRecent()).rejects.toThrow(TypeError);
    });
    test('findByIdForUser: 다른 사용자의 사건은 null', async () => {
      const [row] = await m.eventModel.findByUser(USER_B);
      expect(await m.eventModel.findByIdForUser(row.id, USER_B)).not.toBeNull();
      expect(await m.eventModel.findByIdForUser(row.id, USER_A)).toBeNull();
      await expect(m.eventModel.findByIdForUser(row.id)).rejects.toThrow(TypeError);
    });
    test('deleteByUser: 해당 사용자만 삭제', async () => {
      expect(await m.eventModel.deleteByUser(USER_A)).toBe(3);
      expect(await m.eventModel.findByUser(USER_B)).toHaveLength(1);
      await expect(m.eventModel.deleteByUser()).rejects.toThrow(TypeError);
    });
  });

  describe('ReportModel', () => {
    test('findLatest: 기간별 최신 리포트', async () => {
      await m.reportModel.insert({ user_id: USER_A, days: 7, ai_text: 'old', created_at: '2026-09-01T00:00:00Z' });
      await m.reportModel.insert({ user_id: USER_A, days: 7, ai_text: 'new', created_at: '2026-09-02T00:00:00Z' });
      await m.reportModel.insert({ user_id: USER_A, days: 14, ai_text: 'two', created_at: '2026-09-03T00:00:00Z' });
      expect((await m.reportModel.findLatest(USER_A, 7)).ai_text).toBe('new');
      expect((await m.reportModel.findLatest(USER_A)).ai_text).toBe('two');
      expect(await m.reportModel.findLatest(USER_B)).toBeNull();
      await expect(m.reportModel.findByUser()).rejects.toThrow(TypeError);
      expect(await m.reportModel.deleteByUser(USER_A)).toBe(3);
      await expect(m.reportModel.deleteByUser()).rejects.toThrow(TypeError);
    });
  });

  describe('MessageModel', () => {
    test('findByUser / findFirstByRecipient / deleteByUser', async () => {
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'neighbor', body: 'a', created_at: '2026-09-01T00:00:00Z' });
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'neighbor', body: 'b', created_at: '2026-09-05T00:00:00Z' });
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'center', body: 'c', created_at: '2026-09-06T00:00:00Z' });
      expect((await m.messageModel.findByUser(USER_A))[0].body).toBe('c');
      expect((await m.messageModel.findFirstByRecipient(USER_A, 'neighbor')).body).toBe('a');
      expect(await m.messageModel.findFirstDeliveredByRecipient(USER_A, 'neighbor')).toBeNull();
      const rows = await m.messageModel.findByUser(USER_A, { recipient: 'neighbor' });
      await m.messageModel.updateById(rows[0].id, { delivered_at: '2026-09-09T00:00:00Z' });
      await m.messageModel.updateById(rows[1].id, { delivered_at: '2026-09-08T00:00:00Z' });
      expect((await m.messageModel.findFirstDeliveredByRecipient(USER_A, 'neighbor')).body).toBe('a');
      await expect(m.messageModel.findFirstDeliveredByRecipient(USER_A)).rejects.toThrow(TypeError);
      expect(await m.messageModel.findByIdForUser(rows[0].id, USER_B)).toBeNull();
      await expect(m.messageModel.findByIdForUser(rows[0].id)).rejects.toThrow(TypeError);
      expect(await m.messageModel.findFirstByRecipient(USER_A, 'management')).toBeNull();
      await expect(m.messageModel.findFirstByRecipient(USER_A)).rejects.toThrow(TypeError);
      await expect(m.messageModel.findByUser()).rejects.toThrow(TypeError);
      expect(await m.messageModel.deleteByUser(USER_A)).toBe(3);
      await expect(m.messageModel.deleteByUser()).rejects.toThrow(TypeError);
    });
  });

  describe('SettingsModel', () => {
    test('findByUser: 없으면 기본값, upsert로 생성·갱신', async () => {
      const def = await m.settingsModel.findByUser(USER_A);
      expect(def.night_start).toBe(22);
      await m.settingsModel.upsert(USER_A, { night_start: 21 });
      expect((await m.settingsModel.findByUser(USER_A)).night_start).toBe(21);
      await m.settingsModel.upsert(USER_A, { db_offset: 95 });
      const after = await m.settingsModel.findByUser(USER_A);
      expect(after.night_start).toBe(21);
      expect(after.db_offset).toBe(95);
      expect(await m.settingsModel.count()).toBe(1);
    });
    test('실패: 인자 누락', async () => {
      await expect(m.settingsModel.findByUser()).rejects.toThrow(TypeError);
      await expect(m.settingsModel.upsert(USER_A, null)).rejects.toThrow(TypeError);
      await expect(m.settingsModel.deleteByUser()).rejects.toThrow(TypeError);
    });
  });

  describe('ThresholdModel', () => {
    test('findAll: 비어 있으면 기본 기준표 3행을 채운다', async () => {
      const rows = await m.thresholdModel.findAll();
      expect(rows).toHaveLength(3);
      expect(rows[0].source).toContain('환경부');
    });
    test('fillMissing: 예전 기준표에 없는 필드만 채우고 기존 값은 보존 / 실패', async () => {
      const { ThresholdModel } = require('../../src/models');
      const old = [{ source_type: 'impact', metric: 'max', day_db: 60, night_db: 55 }, { source_type: 'x', metric: 'y' }];
      const defaults = [{ source_type: 'impact', metric: 'max', day_db: 57, night_db: 52, min_count_per_hour: 3, legacy_bonus_db: 2 }];
      const filled = ThresholdModel.fillMissing(old, defaults);
      expect(filled[0]).toEqual({ source_type: 'impact', metric: 'max', day_db: 60, night_db: 55, min_count_per_hour: 3, legacy_bonus_db: 2 });
      expect(filled[1]).toEqual({ source_type: 'x', metric: 'y' });
      expect(() => ThresholdModel.fillMissing(null, [])).toThrow(TypeError);
      await m.thresholdModel.store.write(old.slice(0, 1));
      const rows = await m.thresholdModel.findAll();
      expect(rows[0].min_count_per_hour).toBe(3);
    });
    test('findBySourceType / getLimit 성공·실패', async () => {
      expect(await m.thresholdModel.findBySourceType('impact')).toHaveLength(2);
      expect(await m.thresholdModel.getLimit('impact', 'avg1min', true)).toBe(34);
      expect(await m.thresholdModel.getLimit('airborne', 'avg5min', false)).toBe(45);
      await expect(m.thresholdModel.getLimit('impact', 'nope', false)).rejects.toThrow(RangeError);
      await expect(m.thresholdModel.findBySourceType()).rejects.toThrow(TypeError);
    });
  });
});
