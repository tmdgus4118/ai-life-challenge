const dial = require('../../src/shared/dial');

const hourly = Array(24).fill(0);
hourly[22] = 10; hourly[23] = 6; hourly[14] = 3;
const ex = Array(24).fill(0);
ex[22] = 7; ex[23] = 2;

describe('shared/dial', () => {
  test('angleOf: 0시는 위(-π/2), 6시는 오른쪽(0) / 실패: 숫자 아님', () => {
    expect(dial.angleOf(0)).toBeCloseTo(-Math.PI / 2);
    expect(dial.angleOf(6)).toBeCloseTo(0);
    expect(() => dial.angleOf('x')).toThrow(TypeError);
  });
  test('annularSector: 닫힌 경로, 큰 호 플래그 / 실패: 반지름 역전', () => {
    const d = dial.annularSector(70, 148, dial.angleOf(22), dial.angleOf(6));
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain(' 0 0 1 '); // 8시간 = 120° → 작은 호
    expect(dial.annularSector(1, 2, 0, Math.PI * 1.5)).toContain(' 0 1 1 ');
    expect(() => dial.annularSector(10, 5, 0, 1)).toThrow(RangeError);
  });
  test('build: 야간 음영·막대·초과 막대·라벨·접근성 레이블', () => {
    const svg = dial.build({ hourly, hourlyExceeded: ex, nightStart: 22, nightEnd: 6 });
    expect(svg).toContain('class="dial__night"');
    expect(svg).toContain('class="dial__ring"');
    expect((svg.match(/class="dial__bar is-exceeded/g) || []).length).toBe(2);
    expect(svg).toContain('<title>22시 10건, 기준 초과 7건</title>');
    expect(svg).toContain('>19</text>'); // 총합
    expect(svg).toContain('기준 초과 9');
    expect(svg).toContain('aria-label="24시간 소음 다이얼: 총 19건, 기준 초과 9건, 가장 많은 시간 22시');
    expect(svg).toContain('is-peak');
    ['0시', '6시', '12시', '18시'].forEach((t) => expect(svg).toContain(`>${t}</text>`));
  });
  test('build: 사건이 없으면 막대·초과 문구 없음, 야간 시작=종료면 음영 없음', () => {
    const svg = dial.build({ hourly: Array(24).fill(0), nightStart: 0, nightEnd: 0 });
    expect(svg).not.toContain('dial__bar');
    expect(svg).not.toContain('dial__night');
    expect(svg).not.toContain('기준 초과');
  });
  test('build 실패: 24칸이 아님', () => {
    expect(() => dial.build({ hourly: [1, 2] })).toThrow(TypeError);
    expect(() => dial.build(null)).toThrow(TypeError);
  });
});
