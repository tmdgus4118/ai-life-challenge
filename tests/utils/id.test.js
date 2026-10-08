const { IdUtil } = require('../../src/utils/id');

describe('IdUtil', () => {
  test('generate: 유효한 UUID v4', () => {
    const id = IdUtil.generate();
    expect(IdUtil.isValid(id)).toBe(true);
    expect(IdUtil.generate()).not.toBe(id);
  });
  test('isValid 실패: 형식이 아니면 false', () => {
    expect(IdUtil.isValid('abc')).toBe(false);
    expect(IdUtil.isValid(123)).toBe(false);
    expect(IdUtil.isValid('')).toBe(false);
  });
});
