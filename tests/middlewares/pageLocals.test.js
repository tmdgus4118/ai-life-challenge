const { createPageLocals } = require('../../src/middlewares/pageLocals');
const { SettingsService } = require('../../src/services/SettingsService');
const { TimeUtil } = require('../../src/utils/time');

const fakeTime = (hour) => ({ getParts: () => ({ hour }) });

describe('SettingsService.resolveTheme', () => {
  const svc = new SettingsService({ findByUser: async () => ({}) });
  const base = { night_start: 22, night_end: 6, theme: 'auto' };
  test('auto: 야간 시간대면 dark, 아니면 light', () => {
    expect(svc.resolveTheme(base, 23)).toBe('dark');
    expect(svc.resolveTheme(base, 3)).toBe('dark');
    expect(svc.resolveTheme(base, 14)).toBe('light');
  });
  test('고정값은 시간과 무관', () => {
    expect(svc.resolveTheme({ ...base, theme: 'light' }, 23)).toBe('light');
    expect(svc.resolveTheme({ ...base, theme: 'dark' }, 12)).toBe('dark');
  });
  test('실패: 설정 없음, 시각 범위 밖', () => {
    expect(() => svc.resolveTheme(null, 1)).toThrow(TypeError);
    expect(() => svc.resolveTheme(base, 24)).toThrow(RangeError);
  });
});

describe('createPageLocals', () => {
  const settingsService = { get: jest.fn(async () => ({ night_start: 22, night_end: 6, theme: 'auto', role: 'listener' })), resolveTheme: SettingsService.prototype.resolveTheme };
  test('테마·아이콘·설정을 locals에 넣는다', async () => {
    const res = { locals: {} }; const next = jest.fn();
    await createPageLocals(settingsService, fakeTime(23))({ userId: 'u' }, res, next);
    expect(res.locals.theme).toBe('dark');
    expect(res.locals.userSettings.role).toBe('listener');
    expect(typeof res.locals.icon).toBe('function');
    expect(res.locals.iconSprite).toContain('<symbol');
    expect(next).toHaveBeenCalledWith();
  });
  test('실패: 서비스 없음, 설정 조회 오류는 next(err)', async () => {
    expect(() => createPageLocals()).toThrow(TypeError);
    const next = jest.fn();
    await createPageLocals({ get: async () => { throw new Error('db'); } }, new TimeUtil())({ userId: 'u' }, { locals: {} }, next);
    expect(next.mock.calls[0][0].message).toBe('db');
  });
});
