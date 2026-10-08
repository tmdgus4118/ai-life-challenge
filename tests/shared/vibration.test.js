const { VibrationMeter, G } = require('../../src/shared/vibration');

// 바닥에 평평하게 놓인 폰: z축에 중력, 아주 작은 흔들림
const still = (jitterMg = 1) => ({ x: 0, y: 0, z: G + (Math.random() - 0.5) * (jitterMg / 1000) * G });
const feed = (m, n, sample, t0) => { for (let i = 0; i < n; i += 1) m.push(sample(i), t0 + i * 16); };

describe('VibrationMeter', () => {
  test('조용한 바닥에서는 충격 없음, 바닥값이 잡힌다', () => {
    const m = new VibrationMeter();
    let r;
    for (let s = 0; s < 5; s += 1) { feed(m, 60, () => still(1), s * 1000); r = m.tick(s * 1000 + 999); }
    expect(r.measured).toBe(true);
    expect(r.impact).toBe(false);
    expect(r.floor_mg).toBeLessThan(3);
    expect(r.level).toBeGreaterThanOrEqual(0);
  });

  test('바닥값보다 크게 튄 1초는 충격 진동', () => {
    const m = new VibrationMeter();
    for (let s = 0; s < 5; s += 1) { feed(m, 60, () => still(1), s * 1000); m.tick(s * 1000 + 999); }
    feed(m, 60, (i) => (i === 30 ? { x: 0, y: 0, z: G + 0.2 } : still(1)), 5000); // 약 20mg 충격
    const r = m.tick(5999);
    expect(r.impact).toBe(true);
    expect(r.peak_mg).toBeGreaterThan(10);
  });

  test('충격 순간은 바닥값에 넣지 않는다', () => {
    const m = new VibrationMeter();
    for (let s = 0; s < 5; s += 1) { feed(m, 60, () => still(1), s * 1000); m.tick(s * 1000 + 999); }
    const before = m.peaks.length;
    feed(m, 60, (i) => (i === 10 ? { x: 0.3, y: 0, z: G } : still(1)), 5000);
    m.tick(5999);
    expect(m.peaks.length).toBe(before);
  });

  test('처음 3초(바닥값 없음)에는 큰 값도 충격으로 보지 않는다', () => {
    const m = new VibrationMeter();
    feed(m, 60, (i) => (i === 30 ? { x: 0, y: 0, z: G + 1 } : still(1)), 0);
    expect(m.tick(999).impact).toBe(false);
  });

  test('앱이 폰을 진동시키는 동안(suppress)은 측정하지 않는다', () => {
    const m = new VibrationMeter();
    for (let s = 0; s < 5; s += 1) { feed(m, 60, () => still(1), s * 1000); m.tick(s * 1000 + 999); }
    m.suppress(2000, 5000);
    feed(m, 60, () => ({ x: 0, y: 0, z: G + 2 }), 5000);
    const r = m.tick(5999);
    expect(r.measured).toBe(false);
    expect(r.impact).toBe(false);
    expect(r.suppressed).toBe(true);
  });

  test('샘플이 모자라면 측정 안 됨 (센서 없음)', () => {
    const m = new VibrationMeter();
    expect(m.tick(1000)).toMatchObject({ measured: false, peak_mg: null, impact: false });
  });

  test('level은 0~1 로그 눈금', () => {
    expect(VibrationMeter.level(0)).toBe(0);
    expect(VibrationMeter.level(99)).toBe(1);
    expect(VibrationMeter.level(500)).toBe(1);
    expect(VibrationMeter.level(-1)).toBe(0);
    expect(VibrationMeter.level(9)).toBeCloseTo(0.5, 5);
  });

  test('reset은 상태를 비운다', () => {
    const m = new VibrationMeter();
    feed(m, 60, () => still(1), 0); m.tick(999);
    m.reset();
    expect(m.peaks).toEqual([]);
    expect(m.gravity).toBeNull();
  });

  test('실패: 잘못된 옵션·입력', () => {
    expect(() => new VibrationMeter({ alpha: 0 })).toThrow(RangeError);
    expect(() => new VibrationMeter({ ratio: 0.5 })).toThrow(RangeError);
    expect(() => new VibrationMeter({ minMg: 0 })).toThrow(RangeError);
    expect(() => new VibrationMeter({ floorWindow: 2 })).toThrow(RangeError);
    const m = new VibrationMeter();
    expect(() => m.push({ x: 0, y: null, z: 9.8 })).toThrow(TypeError);
    expect(() => m.push(null)).toThrow(TypeError);
    expect(() => m.suppress(-1)).toThrow(RangeError);
  });
});
