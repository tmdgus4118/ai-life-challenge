const { ExclusionToggle } = require('../../src/shared/exclusion-toggle');

const T0 = new Date('2026-10-02T13:00:00Z');
const later = (sec) => new Date(T0.getTime() + sec * 1000);

describe('ExclusionToggle', () => {
  test('toggle: 한 번 누르면 켜지고 다시 누르면 꺼진다', () => {
    const t = new ExclusionToggle();
    expect(t.isOn).toBe(false);
    expect(t.toggle(T0)).toBe(true);
    expect(t.isOn).toBe(true);
    expect(t.toggle(later(5))).toBe(false);
    expect(t.isOn).toBe(false);
  });

  test('onChange: 상태가 바뀔 때만 호출된다', () => {
    const onChange = jest.fn();
    const t = new ExclusionToggle({ onChange });
    t.set(true, T0);
    t.set(true, later(1));
    t.set(false, later(2));
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  test('elapsedSec / formatElapsed: 켜진 뒤 경과 시간, 꺼지면 0', () => {
    const t = new ExclusionToggle();
    expect(t.elapsedSec(later(10))).toBe(0);
    t.toggle(T0);
    expect(t.elapsedSec(later(75))).toBe(75);
    expect(t.formatElapsed(later(75))).toBe('1:15');
    expect(t.formatElapsed(later(9))).toBe('0:09');
    t.toggle(later(80));
    expect(t.elapsedSec(later(90))).toBe(0);
  });

  test('reset: 켜져 있으면 끄고, 꺼져 있으면 그대로', () => {
    const onChange = jest.fn();
    const t = new ExclusionToggle({ onChange });
    t.reset();
    expect(onChange).not.toHaveBeenCalled();
    t.toggle(T0);
    expect(t.reset()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  test('실패: 잘못된 onChange, 불리언 아닌 값, 잘못된 시각', () => {
    expect(() => new ExclusionToggle({ onChange: 'x' })).toThrow(TypeError);
    const t = new ExclusionToggle();
    expect(() => t.set('on')).toThrow(TypeError);
    expect(() => t.toggle('bad-date')).toThrow(TypeError);
    t.toggle(T0);
    expect(() => t.elapsedSec('bad-date')).toThrow(TypeError);
  });
});
