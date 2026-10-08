const { EventDetector } = require('../../src/shared/event-detector');

const T0 = new Date('2026-09-28T13:10:00Z').getTime();
const at = (sec) => new Date(T0 + sec * 1000);
const feed = (det, specs) => {
  const out = [];
  let sec = 0;
  specs.forEach(([count, sample]) => {
    for (let i = 0; i < count; i += 1) {
      const r = det.push({ at: at(sec), ...sample });
      if (r) out.push(r);
      sec += 1;
    }
  });
  return out;
};
const loud = (group = 'footstep', db = 45) => ({ group, db, exceeded: true, confidence: 0.7 });
const quiet = { group: 'other', db: 30, exceeded: false };

describe('EventDetector', () => {
  test('3초 이상 초과 후 10초 조용 → 사건 1건 (평균·최고·지속시간)', () => {
    const det = new EventDetector({ minDurationSec: 3, quietEndSec: 10 });
    const events = feed(det, [[5, loud('footstep', 45)], [10, quiet]]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ source_group: 'footstep', max_db: 45, avg_db: 45, duration_sec: 5, excluded_sec: 0, confidence: 0.7 });
    expect(events[0].started_at).toBe(at(0).toISOString());
    expect(events[0].ended_at).toBe(at(5).toISOString());
  });
  test('db_series: 시작~마지막 초과까지 1초 단위, 조용한 구간 포함, 제외 구간은 null', () => {
    const det = new EventDetector();
    const events = feed(det, [[3, loud('footstep', 45)], [2, { group: 'footstep', db: 30, exceeded: false }], [1, { ...loud('footstep', 80), excluded: true }], [2, loud('footstep', 47)], [10, quiet]]);
    expect(events).toHaveLength(1);
    expect(events[0].db_series).toEqual([45, 45, 45, 30, 30, null, 47, 47]);
    expect(events[0].db_series.length).toBe(events[0].duration_sec);
  });
  test('buildSeries 실패: 배열 아님', () => {
    expect(() => EventDetector.buildSeries(null, 0, 1)).toThrow(TypeError);
  });
  test('2초만 초과하면 사건 아님', () => {
    const det = new EventDetector();
    expect(feed(det, [[2, loud()], [12, quiet]])).toHaveLength(0);
  });
  test('짧은 끊김(10초 미만)은 같은 사건으로 이어진다', () => {
    const det = new EventDetector();
    const events = feed(det, [[4, loud()], [5, quiet], [4, loud()], [10, quiet]]);
    expect(events).toHaveLength(1);
    expect(events[0].duration_sec).toBe(13);
  });
  test('onEvent 콜백 호출, flush로 강제 종료', () => {
    const onEvent = jest.fn();
    const det = new EventDetector({ onEvent });
    feed(det, [[4, loud('pet', 50)]]);
    expect(onEvent).not.toHaveBeenCalled();
    const ev = det.flush();
    expect(ev.source_group).toBe('pet');
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(det.flush()).toBeNull();
  });
  test('사건 중 소음원이 바뀌면 이전 사건 종료 후 새 사건 시작', () => {
    const det = new EventDetector({ minDurationSec: 3, quietEndSec: 5 });
    const events = feed(det, [[4, loud('footstep')], [6, loud('hammer', 60)], [5, quiet]]);
    expect(events.map((e) => e.source_group)).toEqual(['footstep', 'hammer']);
  });
  test('"지금은 우리 집" 구간만으로는 사건이 생기지 않는다', () => {
    const det = new EventDetector();
    expect(feed(det, [[5, { ...loud(), excluded: true }], [10, quiet]])).toHaveLength(0);
  });
  test('사건 중간의 제외 구간은 빼고 앞뒤를 한 사건으로 저장한다 (평균·최고에 제외 구간 dB 미포함)', () => {
    const det = new EventDetector();
    const events = feed(det, [[4, loud('footstep', 45)], [3, { ...loud('footstep', 80), excluded: true }], [4, loud('footstep', 45)], [10, quiet]]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ source_group: 'footstep', max_db: 45, avg_db: 45, duration_sec: 11, excluded_sec: 3 });
    expect(events[0]).not.toHaveProperty('excluded');
  });
  test('사건 끝에 붙은 제외 구간은 사건 길이와 제외 시간에 넣지 않는다', () => {
    const det = new EventDetector();
    const events = feed(det, [[4, loud()], [3, { ...loud('footstep', 80), excluded: true }], [10, quiet]]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ duration_sec: 4, excluded_sec: 0, max_db: 45 });
  });
  test('제외가 조용한 시간(10초) 이상 이어지면 사건이 끝나고, 해제 후 소리는 새 사건이 된다', () => {
    const det = new EventDetector();
    const events = feed(det, [[4, loud()], [10, { ...loud(), excluded: true }], [4, loud()], [10, quiet]]);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.duration_sec)).toEqual([4, 4]);
  });
  test('제외 구간은 사건 시작 후보도 끊는다 (2초 + 제외 1초 + 2초 → 사건 아님)', () => {
    const det = new EventDetector();
    expect(feed(det, [[2, loud()], [1, { ...loud(), excluded: true }], [2, loud()], [12, quiet]])).toHaveLength(0);
  });
  test('getCurrent: 진행 중 사건의 제외 시간 표시', () => {
    const det = new EventDetector();
    feed(det, [[3, loud()], [2, { ...loud(), excluded: true }]]);
    expect(det.getCurrent()).toMatchObject({ group: 'footstep', seconds: 3, excluded_sec: 2 });
  });
  test('other 그룹은 기준 초과라도 사건 아님, getCurrent 요약', () => {
    const det = new EventDetector();
    expect(feed(det, [[5, { group: 'other', db: 70, exceeded: true }], [10, quiet]])).toHaveLength(0);
    feed(det, [[3, loud()]]);
    expect(det.getCurrent()).toEqual({ group: 'footstep', seconds: 3, max_db: 45, excluded_sec: 0 });
  });
  test('configure로 민감도 변경 / 실패 케이스', () => {
    const det = new EventDetector();
    det.configure({ minDurationSec: 5 });
    expect(feed(det, [[4, loud()], [10, quiet]])).toHaveLength(0);
    expect(() => det.configure({ quietEndSec: 0 })).toThrow(TypeError);
    expect(() => new EventDetector({ minDurationSec: 0 })).toThrow(TypeError);
    expect(() => det.push({ group: 'footstep' })).toThrow(TypeError);
    expect(() => det.push({ at: 'bad', group: 'footstep', db: 40 })).toThrow(TypeError);
  });
});

describe('EventDetector 바닥 진동', () => {
  const v = (impact, mg) => ({ impact, peak_mg: mg });
  test('진동 동반 초, 최고 진동, 1초별 진동(1/0)을 남긴다', () => {
    const det = new EventDetector();
    const events = feed(det, [
      [1, { ...loud(), vib: v(true, 22.5) }],
      [2, { ...loud(), vib: v(false, 1.2) }],
      [1, { ...loud(), vib: v(true, 30) }],
      [10, { ...quiet, vib: v(false, 1) }],
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ vibration_sec: 2, vibration_peak_mg: 30 });
    expect(events[0].vibration_series).toEqual([1, 0, 0, 1]);
    expect(events[0].vibration_series.length).toBe(events[0].db_series.length);
  });
  test('센서가 없으면 진동 항목을 만들지 않는다 (0초와 구분)', () => {
    const det = new EventDetector();
    const [e] = feed(det, [[4, loud()], [10, quiet]]);
    expect(e.vibration_sec).toBeUndefined();
    expect(e.vibration_series).toBeUndefined();
  });
  test('측정이 빠진 1초는 null, 제외 구간의 진동은 세지 않는다', () => {
    const det = new EventDetector();
    const [e] = feed(det, [
      [2, { ...loud(), vib: v(false, 1) }],
      [1, loud()],
      [1, { ...loud(), excluded: true, vib: v(true, 40) }],
      [1, { ...loud(), vib: v(true, 12) }],
      [10, quiet],
    ]);
    expect(e.vibration_series).toEqual([0, 0, null, null, 1]);
    expect(e.vibration_sec).toBe(1);
    expect(e.vibration_peak_mg).toBe(12);
  });
  test('getCurrent: 진동을 재고 있을 때만 진행 중 진동 초', () => {
    const det = new EventDetector();
    feed(det, [[3, { ...loud(), vib: v(true, 9) }]]);
    expect(det.getCurrent().vibration_sec).toBe(3);
  });
  test('실패: 진동 값이 잘못되면 무시, buildVibSeries는 배열만', () => {
    expect(EventDetector.isVib({ impact: true, peak_mg: -1 })).toBe(false);
    expect(EventDetector.isVib({ impact: true, peak_mg: NaN })).toBe(false);
    expect(EventDetector.isVib(null)).toBe(false);
    expect(() => EventDetector.buildVibSeries(null, 0, 1)).toThrow(TypeError);
    const det = new EventDetector();
    const [e] = feed(det, [[4, { ...loud(), vib: { impact: true, peak_mg: 'x' } }], [10, quiet]]);
    expect(e.vibration_sec).toBeUndefined();
  });
});
