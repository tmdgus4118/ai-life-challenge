const { KeepAlive } = require('../../src/utils/keep-alive');

const okFetch = jest.fn(async () => ({ ok: true, status: 200 }));
const quiet = { warn: jest.fn() };

describe('KeepAlive', () => {
  afterEach(() => { jest.useRealTimers(); okFetch.mockClear(); quiet.warn.mockClear(); });

  test('공개 주소가 있으면 /api/health 를 호출하고 성공을 센다', async () => {
    const k = new KeepAlive({ url: 'https://example.onrender.com/', fetchImpl: okFetch, logger: quiet });
    expect(k.enabled).toBe(true);
    expect(await k.ping()).toBe(true);
    expect(okFetch).toHaveBeenCalledWith('https://example.onrender.com/api/health', expect.objectContaining({ method: 'GET' }));
    expect(k.pings).toBe(1);
    expect(k.failures).toBe(0);
  });

  test('주소가 없으면 꺼져 있고 start는 false', async () => {
    const k = new KeepAlive({ url: '', fetchImpl: okFetch });
    expect(k.enabled).toBe(false);
    expect(k.start()).toBe(false);
    expect(await k.ping()).toBe(false);
    expect(okFetch).not.toHaveBeenCalled();
  });

  test('start는 주기마다 호출하고 stop으로 멈춘다', async () => {
    jest.useFakeTimers();
    const k = new KeepAlive({ url: 'https://example.onrender.com', intervalMs: 1000, fetchImpl: okFetch, logger: quiet });
    expect(k.start()).toBe(true);
    expect(k.start()).toBe(false); // 두 번 시작하지 않는다
    jest.advanceTimersByTime(3000);
    expect(okFetch).toHaveBeenCalledTimes(3);
    k.stop();
    jest.advanceTimersByTime(3000);
    expect(okFetch).toHaveBeenCalledTimes(3);
  });

  test('실패: 응답이 ok가 아니거나 예외면 failures를 세고 경고만 남긴다', async () => {
    const bad = jest.fn(async () => ({ ok: false, status: 503 }));
    const k = new KeepAlive({ url: 'https://example.onrender.com', fetchImpl: bad, logger: quiet });
    expect(await k.ping()).toBe(false);
    const thrower = jest.fn(async () => { throw new Error('network'); });
    const k2 = new KeepAlive({ url: 'https://example.onrender.com', fetchImpl: thrower, logger: quiet });
    expect(await k2.ping()).toBe(false);
    expect(k.failures + k2.failures).toBe(2);
    expect(quiet.warn).toHaveBeenCalledTimes(2);
  });

  test('실패: 잘못된 옵션', () => {
    expect(() => new KeepAlive({ intervalMs: 10 })).toThrow(RangeError);
    expect(() => new KeepAlive({ fetchImpl: 'x' })).toThrow(TypeError);
  });
});
