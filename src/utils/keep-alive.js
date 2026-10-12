/**
 * 무료 호스팅(Render)은 15분 동안 공개 주소로 들어오는 요청이 없으면 서버를 재운다.
 * 자기 공개 주소의 헬스체크를 주기적으로(기본 5분) 호출해 깨어 있게 한다. 공개 주소가 없으면 아무것도 하지 않는다.
 */
class KeepAlive {
  /**
   * @param {{url?:string, intervalMs?:number, fetchImpl?:Function, logger?:{warn:Function}}} options
   */
  constructor({ url = '', intervalMs = 5 * 60 * 1000, fetchImpl = globalThis.fetch, logger = console } = {}) {
    if (!Number.isFinite(intervalMs) || intervalMs < 1000) throw new RangeError('intervalMs must be >= 1000');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
    this.url = String(url || '').replace(/\/+$/, '');
    this.intervalMs = intervalMs;
    this.fetchImpl = fetchImpl;
    this.logger = logger;
    this.timer = null;
    this.pings = 0;
    this.failures = 0;
  }

  get enabled() {
    return /^https?:\/\//.test(this.url);
  }

  /** 한 번 호출. 실패해도 던지지 않고 횟수만 센다 */
  async ping() {
    if (!this.enabled) return false;
    try {
      const res = await this.fetchImpl(`${this.url}/api/health`, { method: 'GET', signal: AbortSignal.timeout(60000) });
      this.pings += 1;
      if (!res.ok) throw new Error(`status ${res.status}`);
      return true;
    } catch (err) {
      this.failures += 1;
      if (this.logger && typeof this.logger.warn === 'function') this.logger.warn(`[keep-alive] 실패: ${err.message}`);
      return false;
    }
  }

  /** 주기 호출 시작. 공개 주소가 없으면 false */
  start() {
    if (!this.enabled || this.timer) return false;
    this.timer = setInterval(() => { this.ping(); }, this.intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref(); // 종료를 막지 않는다
    return true;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { KeepAlive };
