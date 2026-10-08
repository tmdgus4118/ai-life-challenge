const { CareAlert, TIPS } = require('../../src/shared/care-alert');

const T0 = new Date('2026-10-08T14:00:00Z').getTime();
const s = (sec, db, over = {}) => ({ at: T0 + sec * 1000, group: 'footstep', db, limit: 34, ...over });
const run = (ca, list) => list.map((x) => ca.push(x)).filter(Boolean);

describe('CareAlert', () => {
  test('기준에서 3dB 이내가 2초 이어지면 "가까움"', () => {
    const ca = new CareAlert();
    expect(ca.push(s(0, 32))).toBeNull();
    expect(ca.push(s(1, 33))).toEqual({ level: 'near', group: 'footstep', db: 33, limit: 34 });
    expect(ca.count).toBe(1);
  });
  test('기준을 넘으면 "넘음", 한 번이라도 넘은 연속 구간은 넘음으로 알린다', () => {
    const ca = new CareAlert();
    const [a] = run(ca, [s(0, 36), s(1, 33)]);
    expect(a.level).toBe('over');
    expect(ca.overCount).toBe(1);
  });
  test('쉬는 시간(30초) 동안은 다시 알리지 않지만, 가까움 다음 넘음은 바로 알린다', () => {
    const ca = new CareAlert();
    run(ca, [s(0, 32), s(1, 32)]); // near
    expect(run(ca, [s(5, 32), s(6, 32)])).toEqual([]); // 쉬는 중 near
    const escalated = run(ca, [s(8, 40), s(9, 40)]);
    expect(escalated).toHaveLength(1);
    expect(escalated[0].level).toBe('over');
    expect(run(ca, [s(12, 40), s(13, 40)])).toEqual([]); // 쉬는 중 over
    expect(run(ca, [s(45, 40), s(46, 40)])).toHaveLength(1); // 쉬는 시간 지남
  });
  test('조용해지면 연속 카운트 초기화, 기타·제외·기준 없음은 알리지 않음', () => {
    const ca = new CareAlert();
    expect(run(ca, [s(0, 33), s(1, 20), s(2, 33)])).toEqual([]);
    expect(run(ca, [s(3, 50, { group: 'other' }), s(4, 50, { group: 'other' })])).toEqual([]);
    expect(run(ca, [s(5, 50, { excluded: true }), s(6, 50, { excluded: true })])).toEqual([]);
    expect(run(ca, [s(7, 50, { limit: null }), s(8, 50, { limit: null })])).toEqual([]);
  });
  test('reset은 횟수와 쉬는 시간을 비운다', () => {
    const ca = new CareAlert();
    run(ca, [s(0, 40), s(1, 40)]);
    ca.reset();
    expect(ca.count).toBe(0);
    expect(run(ca, [s(2, 40), s(3, 40)])).toHaveLength(1);
  });
  test('describe: 제목·본문(소음원 팁, 주야)', () => {
    const near = CareAlert.describe({ level: 'near', group: 'footstep', db: 33, limit: 34 }, { label: '발걸음', isNight: true });
    expect(near.title).toBe('아랫집 기준에 가까워요');
    expect(near.body).toBe('발걸음 33dB · 야간 기준 34dB. ' + TIPS.footstep);
    const over = CareAlert.describe({ level: 'over', group: 'unknown', db: 50, limit: 45 }, {});
    expect(over.title).toBe('아랫집 기준을 넘었어요');
    expect(over.body).toContain('소리 50dB · 주간 기준 45dB. 잠시 소리를 줄여 주세요.');
  });
  test('실패: 잘못된 옵션·입력', () => {
    expect(() => new CareAlert({ marginDb: -1 })).toThrow(RangeError);
    expect(() => new CareAlert({ sustainSec: 0 })).toThrow(RangeError);
    expect(() => new CareAlert({ cooldownSec: -1 })).toThrow(RangeError);
    const ca = new CareAlert();
    expect(() => ca.push(null)).toThrow(TypeError);
    expect(() => ca.push({ at: 'x', group: 'footstep', db: 40, limit: 34 })).toThrow(TypeError);
    expect(() => CareAlert.describe(null)).toThrow(TypeError);
    expect(() => CareAlert.describe({ level: 'loud' })).toThrow(TypeError);
  });
});
