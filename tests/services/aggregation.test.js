const { AggregationService } = require('../../src/services/AggregationService');

const agg = new AggregationService();
const period = { from: '2026-09-25T15:00:00Z', to: '2026-10-02T12:00:00Z', days: 7 };
const ev = (over) => ({ source_group: 'footstep', started_at: '2026-09-28T13:10:00Z', ended_at: '2026-09-28T13:10:12Z', duration_sec: 12, avg_db: 41, max_db: 58, is_night: true, exceeded: true, memo: '', ...over });

describe('AggregationService.summarize', () => {
  test('성공: 집계 숫자·패턴·최대값·메모', () => {
    const s = agg.summarize([
      ev(),
      ev({ started_at: '2026-09-29T13:30:00Z', max_db: 60, memo: '아이가 깨어남' }),
      ev({ source_group: 'pet', started_at: '2026-09-30T05:00:00Z', is_night: false, exceeded: false, duration_sec: 90, max_db: 50 }),
    ], period);
    expect(s.total_events).toBe(3);
    expect(s.exceeded_events).toBe(2);
    expect(s.night_events).toBe(2);
    expect(s.weekday_night_events).toBe(2);
    expect(s.top_source).toMatchObject({ key: 'footstep', count: 2, share: 67 });
    expect(s.top_hour).toEqual({ hour: 22, count: 2, label: '22~23시' });
    expect(s.hourly_exceeded[22]).toBe(2);
    expect(s.hourly_exceeded[14]).toBe(0);
    expect(s.max_db.value).toBe(60);
    expect(s.longest_event.duration_label).toBe('1분 30초');
    expect(s.memos).toHaveLength(1);
    expect(s.heatmap[0][22]).toBe(1); // 월요일 22시
    expect(s.heatmap[1][22]).toBe(1); // 화요일
    expect(s.period).toMatchObject({ from: '2026-09-26', to: '2026-10-02', days: 7 });
    expect(s.by_source[0].key).toBe('footstep');
    expect(s.avg_db_mean).toBe(41);
  });
  test('성공: 빈 목록은 null 패턴', () => {
    const s = agg.summarize([], period);
    expect(s.total_events).toBe(0);
    expect(s.top_source).toBeNull();
    expect(s.top_hour).toBeNull();
    expect(s.max_db).toBeNull();
    expect(s.avg_db_mean).toBeNull();
  });
  test('실패: 인자 오류', () => {
    expect(() => agg.summarize('x', period)).toThrow(TypeError);
    expect(() => agg.summarize([], {})).toThrow(TypeError);
  });
  test('hourLabel / labelOf', () => {
    expect(agg.hourLabel(23)).toBe('23~0시');
    expect(() => agg.hourLabel(24)).toThrow(RangeError);
    expect(agg.labelOf('nope')).toBe('기타');
  });
  test('collectNumbers: 숫자·문자열 속 숫자·소수를 모두 모은다', () => {
    const set = agg.collectNumbers({ a: 41.2, b: '9월 25일', c: [3, { d: '22~23시' }], e: null });
    expect(set.has(41.2)).toBe(true);
    expect(set.has(41)).toBe(true);
    expect(set.has(9)).toBe(true);
    expect(set.has(25)).toBe(true);
    expect(set.has(23)).toBe(true);
    expect(set.has(99)).toBe(false);
  });
});

describe('AggregationService.summarizeVibration', () => {
  const agg = new AggregationService();
  test('진동을 잰 사건만 분모, 진동 동반·기준 초과 동반 수', () => {
    const v = agg.summarizeVibration([
      { vibration_sec: 2, exceeded: true },
      { vibration_sec: 0, exceeded: true },
      { vibration_sec: 1, exceeded: false },
      { vibration_sec: null, exceeded: true },
      { exceeded: false },
    ]);
    expect(v).toEqual({ measured_events: 3, with_vibration: 2, share: 67, exceeded_with_vibration: 1 });
  });
  test('잰 사건이 없으면 share는 null, summarize에도 포함', () => {
    expect(agg.summarizeVibration([{ exceeded: true }])).toEqual({ measured_events: 0, with_vibration: 0, share: null, exceeded_with_vibration: 0 });
    const s = agg.summarize([], { from: '2026-09-22', to: '2026-09-28', days: 7 });
    expect(s.vibration.measured_events).toBe(0);
  });
  test('실패: 배열이 아니면 TypeError', () => {
    expect(() => agg.summarizeVibration(null)).toThrow(TypeError);
  });
});
