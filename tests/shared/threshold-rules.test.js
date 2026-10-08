const rules = require('../../src/shared/threshold-rules');
const thresholds = require('../../src/config/default-thresholds.json');

const settings = { night_start: 22, night_end: 6 };

describe('threshold-rules.isNightHour', () => {
  test('성공: 22시, 1시는 야간이고 10시는 주간', () => {
    expect(rules.isNightHour(22, 22, 6)).toBe(true);
    expect(rules.isNightHour(1, 22, 6)).toBe(true);
    expect(rules.isNightHour(6, 22, 6)).toBe(false);
    expect(rules.isNightHour(10, 22, 6)).toBe(false);
  });
  test('성공: 자정을 넘지 않는 야간 구간(0~6)도 처리', () => {
    expect(rules.isNightHour(3, 0, 6)).toBe(true);
    expect(rules.isNightHour(7, 0, 6)).toBe(false);
  });
  test('성공: 시작==종료면 야간 없음', () => {
    expect(rules.isNightHour(22, 22, 22)).toBe(false);
  });
  test('실패: 범위 밖 시각이면 RangeError', () => {
    expect(() => rules.isNightHour(24, 22, 6)).toThrow(RangeError);
    expect(() => rules.isNightHour('a', 22, 6)).toThrow(RangeError);
  });
});

describe('threshold-rules.getSourceType', () => {
  test('성공: 발걸음=직접충격, 반려동물=공기전달, 기타=null', () => {
    expect(rules.getSourceType('footstep')).toBe('impact');
    expect(rules.getSourceType('pet')).toBe('airborne');
    expect(rules.getSourceType('other')).toBeNull();
  });
  test('실패: 모르는 그룹이면 RangeError', () => {
    expect(() => rules.getSourceType('alien')).toThrow(RangeError);
  });
});

describe('threshold-rules.evaluate', () => {
  test('성공: 야간 발걸음 41dB → 1분 평균 34 초과', () => {
    const r = rules.evaluate({ source_group: 'footstep', avg_db: 41, max_db: 50, hour: 23 }, thresholds, settings);
    expect(r.is_night).toBe(true);
    expect(r.exceeded).toBe(true);
    expect(r.exceeded_rule).toContain('야간 1분 등가소음도 34dB 초과');
    expect(r.rules).toHaveLength(1);
  });
  test('성공: 최고소음도는 1시간 3회 이상일 때만 초과 (별표 비고 5)', () => {
    const once = rules.evaluate({ source_group: 'footstep', avg_db: 30, max_db: 58, hour: 23 }, thresholds, settings);
    expect(once.exceeded).toBe(false);
    expect(once.max_over).toBe(true);
    const twice = rules.evaluate({ source_group: 'footstep', avg_db: 30, max_db: 58, hour: 23, max_exceed_count_hour: 2 }, thresholds, settings);
    expect(twice.exceeded).toBe(false);
    const third = rules.evaluate({ source_group: 'footstep', avg_db: 41, max_db: 58, hour: 23, max_exceed_count_hour: 3 }, thresholds, settings);
    expect(third.rules.map((x) => x.metric).sort()).toEqual(['avg1min', 'max']);
    expect(third.exceeded_rule).toContain('최고소음도 52dB 초과(1시간 3회)');
  });
  test('성공: 최고값이 기준 이하면 max_over는 false', () => {
    expect(rules.evaluate({ source_group: 'footstep', avg_db: 30, max_db: 50, hour: 23 }, thresholds, settings).max_over).toBe(false);
  });
  test('성공: 오래된 단지는 직접충격음에 2dB 가산 (별표 비고 2), 공기전달음은 그대로', () => {
    const legacy = { ...settings, legacy_building: true };
    expect(rules.evaluate({ source_group: 'footstep', avg_db: 35.5, max_db: 40, hour: 23 }, thresholds, settings).exceeded).toBe(true);
    const r = rules.evaluate({ source_group: 'footstep', avg_db: 35.5, max_db: 40, hour: 23 }, thresholds, legacy);
    expect(r.exceeded).toBe(false);
    const r2 = rules.evaluate({ source_group: 'footstep', avg_db: 36.5, max_db: 40, hour: 23 }, thresholds, legacy);
    expect(r2.exceeded_rule).toContain('야간 1분 등가소음도 36dB 초과');
    expect(rules.evaluate({ source_group: 'music', avg_db: 40.5, max_db: 50, hour: 23 }, thresholds, legacy).exceeded).toBe(true);
  });
  test('성공: 주간 발걸음 38dB → 초과 아님', () => {
    const r = rules.evaluate({ source_group: 'footstep', avg_db: 38, max_db: 50, hour: 14 }, thresholds, settings);
    expect(r.is_night).toBe(false);
    expect(r.exceeded).toBe(false);
    expect(r.exceeded_rule).toBeNull();
  });
  test('성공: 공기전달음은 5분 평균 45/40만 비교 (최고값 무시)', () => {
    const day = rules.evaluate({ source_group: 'music', avg_db: 44, max_db: 80, hour: 14 }, thresholds, settings);
    expect(day.exceeded).toBe(false);
    const night = rules.evaluate({ source_group: 'music', avg_db: 44, max_db: 80, hour: 23 }, thresholds, settings);
    expect(night.exceeded).toBe(true);
    expect(night.rules[0].metric).toBe('avg5min');
  });
  test('성공: 기타 그룹은 판정 제외', () => {
    const r = rules.evaluate({ source_group: 'other', avg_db: 90, max_db: 99, hour: 23 }, thresholds, settings);
    expect(r.exceeded).toBe(false);
  });
  test('성공: 사용자 야간 설정 변경이 반영된다', () => {
    const r = rules.evaluate({ source_group: 'footstep', avg_db: 36, max_db: 40, hour: 21 }, thresholds, { night_start: 21, night_end: 7 });
    expect(r.is_night).toBe(true);
    expect(r.exceeded).toBe(true);
  });
  test('실패: 인자 누락', () => {
    expect(() => rules.evaluate(null, thresholds, settings)).toThrow(TypeError);
    expect(() => rules.evaluate({ source_group: 'footstep', hour: 1 }, [], settings)).toThrow(TypeError);
    expect(() => rules.evaluate({ source_group: 'footstep', hour: 1 }, thresholds, null)).toThrow(TypeError);
  });
});

describe('threshold-rules.getCurrentLimit', () => {
  test('성공: 주간 발걸음 39, 야간 34, 야간 악기 40', () => {
    expect(rules.getCurrentLimit('footstep', 12, thresholds, settings).limit).toBe(39);
    expect(rules.getCurrentLimit('footstep', 23, thresholds, settings).limit).toBe(34);
    expect(rules.getCurrentLimit('music', 23, thresholds, settings).limit).toBe(40);
  });
  test('성공: 기타·미지정은 직접충격 기준으로 안내', () => {
    expect(rules.getCurrentLimit('other', 12, thresholds, settings).limit).toBe(39);
  });
  test('실패: 기준 테이블에 행이 없으면 RangeError', () => {
    expect(() => rules.getCurrentLimit('footstep', 12, [], settings)).toThrow(RangeError);
  });
  test('성공: 오래된 단지 설정이면 기준선도 2dB 높다', () => {
    expect(rules.getCurrentLimit('footstep', 23, thresholds, { ...settings, legacy_building: true }).limit).toBe(36);
  });
});

describe('threshold-rules.getMaxLimit / limitOf', () => {
  test('getMaxLimit: 주간 57, 야간 52, 오래된 단지 야간 54, 공기전달·기타는 null', () => {
    expect(rules.getMaxLimit('footstep', 12, thresholds, settings)).toBe(57);
    expect(rules.getMaxLimit('hammer', 23, thresholds, settings)).toBe(52);
    expect(rules.getMaxLimit('furniture', 23, thresholds, { ...settings, legacy_building: true })).toBe(54);
    expect(rules.getMaxLimit('pet', 23, thresholds, settings)).toBeNull();
    expect(rules.getMaxLimit('other', 23, thresholds, settings)).toBeNull();
    expect(rules.getMaxLimit('footstep', 23, [], settings)).toBeNull();
  });
  test('limitOf: 가산 없는 행은 그대로 / 실패: 행 없음', () => {
    const airborne = thresholds.find((t) => t.source_type === 'airborne');
    expect(rules.limitOf(airborne, true, { legacy_building: true })).toBe(40);
    expect(() => rules.limitOf(null, true, {})).toThrow(TypeError);
  });
});
