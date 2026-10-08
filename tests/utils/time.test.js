const { TimeUtil } = require('../../src/utils/time');

const t = new TimeUtil('Asia/Seoul');

describe('TimeUtil', () => {
  test('getParts: UTC 13:10은 KST 22:10 (요일 포함)', () => {
    const p = t.getParts('2026-09-28T13:10:00.000Z');
    expect(p).toMatchObject({ year: 2026, month: 9, day: 28, hour: 22, minute: 10, weekday: 1 });
  });
  test('getParts 실패: 잘못된 날짜', () => {
    expect(() => t.getParts('not-a-date')).toThrow(TypeError);
  });
  test('formatDate/formatTime/formatKorean', () => {
    const d = '2026-09-28T13:10:00.000Z';
    expect(t.formatDate(d)).toBe('2026-09-28');
    expect(t.formatTime(d)).toBe('22:10');
    expect(t.formatKorean(d)).toBe('9월 28일 (월) 22:10');
    expect(t.formatKorean(d, false)).toBe('9월 28일 (월)');
  });
  test('startOfDay: KST 자정은 UTC 전날 15시', () => {
    expect(t.startOfDay('2026-09-28T13:10:00.000Z').toISOString()).toBe('2026-09-27T15:00:00.000Z');
  });
  test('startOfWeek: 월요일 시작', () => {
    // 2026-10-02 (금) → 주 시작 2026-09-28 (월)
    expect(t.formatDate(t.startOfWeek('2026-10-02T03:00:00.000Z'))).toBe('2026-09-28');
    expect(t.getParts(t.startOfWeek('2026-10-04T03:00:00.000Z')).weekday).toBe(1);
  });
  test('addDays 성공/실패', () => {
    expect(t.addDays('2026-09-28T00:00:00.000Z', 2).toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(() => t.addDays('2026-09-28T00:00:00.000Z', 'x')).toThrow(TypeError);
  });
  test('diffSeconds', () => {
    expect(t.diffSeconds('2026-09-28T00:00:00Z', '2026-09-28T00:01:30Z')).toBe(90);
  });
  test('parseDateOnly 성공/실패', () => {
    expect(t.parseDateOnly('2026-09-28').toISOString()).toBe('2026-09-27T15:00:00.000Z');
    expect(() => t.parseDateOnly('2026/09/28')).toThrow(TypeError);
    expect(() => t.parseDateOnly('2026-13-01')).toThrow(TypeError);
  });
  test('formatDuration 성공/실패', () => {
    expect(t.formatDuration(45)).toBe('45초');
    expect(t.formatDuration(90)).toBe('1분 30초');
    expect(t.formatDuration(120)).toBe('2분');
    expect(t.formatDuration(3720)).toBe('1시간 2분');
    expect(() => t.formatDuration(-1)).toThrow(TypeError);
  });
  test('getOffsetMinutes: 서울은 +540', () => {
    expect(t.getOffsetMinutes('2026-09-28T00:00:00Z')).toBe(540);
  });
});
