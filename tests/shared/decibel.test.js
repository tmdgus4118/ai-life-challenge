const { DecibelMeter, RollingWindow, resample } = require('../../src/shared/decibel');

describe('DecibelMeter', () => {
  test('rms: 진폭 0.5 사각파 → 0.5 / 실패: 빈 배열', () => {
    expect(DecibelMeter.rms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5);
    expect(() => DecibelMeter.rms([])).toThrow(TypeError);
    expect(() => DecibelMeter.rms(null)).toThrow(TypeError);
  });
  test('rmsToDbfs: 1 → 0dBFS, 0.001 → -60, 0 → -120 / 실패: 음수', () => {
    expect(DecibelMeter.rmsToDbfs(1)).toBe(0);
    expect(DecibelMeter.rmsToDbfs(0.001)).toBeCloseTo(-60);
    expect(DecibelMeter.rmsToDbfs(0)).toBe(-120);
    expect(() => DecibelMeter.rmsToDbfs(-1)).toThrow(TypeError);
  });
  test('toDb: 오프셋 적용과 클램프 / 실패: 생성자·setOffset 인자', () => {
    const m = new DecibelMeter({ offset: 90 });
    expect(m.toDb(-60)).toBe(30);
    expect(m.toDb(-119)).toBe(20);
    expect(m.toDb(50)).toBe(120);
    m.setOffset(95);
    expect(m.toDb(-60)).toBe(35);
    expect(() => m.toDb('x')).toThrow(TypeError);
    expect(() => new DecibelMeter({ offset: 'x' })).toThrow(TypeError);
    expect(() => m.setOffset(NaN)).toThrow(TypeError);
  });
  test('measure: 샘플 → dB', () => {
    const m = new DecibelMeter({ offset: 90 });
    expect(m.measure(new Float32Array(100).fill(0.001))).toBe(30);
  });
  test('energyMean: 같은 값이면 그대로, 다른 값은 큰 쪽으로 치우침 / 실패', () => {
    expect(DecibelMeter.energyMean([40, 40, 40])).toBe(40);
    const mean = DecibelMeter.energyMean([30, 60]);
    expect(mean).toBeGreaterThan(45);
    expect(mean).toBeLessThan(60);
    expect(() => DecibelMeter.energyMean([])).toThrow(TypeError);
  });
});

describe('RollingWindow', () => {
  test('고정 길이 유지, 평균·최대·last·clear', () => {
    const w = new RollingWindow(3);
    [30, 40, 50, 60].forEach((v) => w.push(v));
    expect(w.length).toBe(3);
    expect(w.max()).toBe(60);
    expect(w.last(2)).toEqual([50, 60]);
    expect(w.average()).toBeGreaterThan(50);
    w.clear();
    expect(w.average()).toBeNull();
    expect(w.max()).toBeNull();
  });
  test('실패: 잘못된 크기, 숫자 아님', () => {
    expect(() => new RollingWindow(0)).toThrow(TypeError);
    expect(() => new RollingWindow(3).push('x')).toThrow(TypeError);
  });
});

describe('resample', () => {
  test('48k → 16k 길이 1/3, 같은 레이트면 복사', () => {
    const input = new Float32Array(48000).map((_, i) => Math.sin(i / 10));
    const out = resample(input, 48000, 16000);
    expect(out.length).toBe(16000);
    expect(out[0]).toBeCloseTo(input[0]);
    expect(resample([1, 2, 3], 16000, 16000)).toEqual(Float32Array.from([1, 2, 3]));
  });
  test('실패: 잘못된 인자', () => {
    expect(() => resample(null, 1, 1)).toThrow(TypeError);
    expect(() => resample([1], 0, 1)).toThrow(TypeError);
  });
});
