const icons = require('../../src/shared/icons');
const { SOURCE_GROUPS } = require('../../src/shared/constants');

describe('shared/icons', () => {
  test('모든 소음원 그룹에 아이콘이 있다', () => {
    SOURCE_GROUPS.forEach((g) => expect(icons.has(g.icon)).toBe(true));
  });
  test('sprite: 모든 심볼을 한 번씩 포함', () => {
    const svg = icons.sprite();
    icons.names.forEach((n) => expect(svg).toContain(`id="i-${n}"`));
    expect(svg).toContain('stroke-width="1.8"');
  });
  test('icon: use 참조와 클래스 / 실패: 없는 이름', () => {
    expect(icons.icon('pet', 'big')).toBe('<svg class="ico big" aria-hidden="true" focusable="false"><use href="#i-pet"></use></svg>');
    expect(icons.icon('home')).toContain('class="ico"');
    expect(() => icons.icon('emoji')).toThrow(RangeError);
  });
});
