/**
 * 바닥 진동 측정기 (UMD). 폰 가속도 센서(DeviceMotion, 약 60Hz)를 1초 단위로 요약한다.
 *  - 중력 성분은 지수 이동 평균으로 걸러 내고 움직임 성분의 크기만 본다.
 *  - 단위는 mg(중력가속도의 1/1000).
 *  - 바닥에 놓인 폰의 평소 흔들림(바닥값)은 최근 1초 최고값들의 중앙값으로 잡고,
 *    그보다 충분히 크게 튄 1초를 "충격 진동"으로 본다.
 *  - 앱이 직접 폰을 진동시키는 동안(suppress)은 측정하지 않는다.
 * 진동은 소리 기록을 보강하는 근거일 뿐이며, 진동이 없다고 소리가 없었던 것은 아니다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundVibration = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const G = 9.80665;

  class VibrationMeter {
    /**
     * @param {{alpha?:number, ratio?:number, minMg?:number, floorWindow?:number, minSamples?:number}} options
     */
    constructor({ alpha = 0.1, ratio = 2.5, minMg = 3, floorWindow = 30, minSamples = 10 } = {}) {
      if (!(alpha > 0 && alpha <= 1)) throw new RangeError('alpha must be in (0, 1]');
      if (!(ratio >= 1)) throw new RangeError('ratio must be >= 1');
      if (!(minMg > 0)) throw new RangeError('minMg must be > 0');
      if (!Number.isInteger(floorWindow) || floorWindow < 3) throw new RangeError('floorWindow must be an integer >= 3');
      this.alpha = alpha;
      this.ratio = ratio;
      this.minMg = minMg;
      this.floorWindow = floorWindow;
      this.minSamples = minSamples;
      this.reset();
    }

    reset() {
      this.gravity = null;
      this.peaks = [];
      this.window = { peak: 0, count: 0 };
      this.suppressUntil = 0;
      this.total = 0;
    }

    /** 이 시각까지 들어오는 값은 버린다 (앱이 폰을 진동시킬 때) */
    suppress(ms, now = Date.now()) {
      if (!(ms >= 0)) throw new RangeError('ms must be >= 0');
      this.suppressUntil = Math.max(this.suppressUntil, now + ms);
    }

    /**
     * 가속도 한 개 (m/s², 중력 포함)
     * @param {{x:number, y:number, z:number}} a
     * @param {number} now 밀리초
     */
    push(a, now = Date.now()) {
      if (!a || ![a.x, a.y, a.z].every((v) => typeof v === 'number' && Number.isFinite(v))) {
        throw new TypeError('acceleration {x, y, z} must be finite numbers');
      }
      if (!this.gravity) {
        this.gravity = { x: a.x, y: a.y, z: a.z };
        return;
      }
      const g = this.gravity;
      g.x += this.alpha * (a.x - g.x);
      g.y += this.alpha * (a.y - g.y);
      g.z += this.alpha * (a.z - g.z);
      if (now < this.suppressUntil) return;
      const mg = (Math.hypot(a.x - g.x, a.y - g.y, a.z - g.z) / G) * 1000;
      if (mg > this.window.peak) this.window.peak = mg;
      this.window.count += 1;
      this.total += 1;
    }

    /** 평소 흔들림: 최근 1초 최고값들의 중앙값 */
    get floor() {
      if (!this.peaks.length) return null;
      const sorted = this.peaks.slice().sort((x, y) => x - y);
      return sorted[Math.floor(sorted.length / 2)];
    }

    /** 0~1 화면 막대용 (로그 눈금, 100mg에서 가득) */
    static level(mg) {
      if (typeof mg !== 'number' || mg < 0) return 0;
      return Math.min(1, Math.log10(mg + 1) / 2);
    }

    /**
     * 지난 1초를 요약하고 창을 비운다.
     * @returns {{measured:boolean, peak_mg:number|null, floor_mg:number|null, impact:boolean, level:number, suppressed:boolean}}
     */
    tick(now = Date.now()) {
      const { peak, count } = this.window;
      this.window = { peak: 0, count: 0 };
      const suppressed = now < this.suppressUntil;
      if (count < this.minSamples) {
        return { measured: false, peak_mg: null, floor_mg: this.floor === null ? null : round1(this.floor), impact: false, level: 0, suppressed };
      }
      const floor = this.floor;
      const threshold = Math.max(this.minMg, (floor || 0) * this.ratio);
      // 바닥값이 쌓이기 전(처음 3초)에는 충격으로 판정하지 않는다
      const impact = this.peaks.length >= 3 && peak >= threshold;
      // 충격 순간은 바닥값에 넣지 않아 기준이 따라 올라가지 않게 한다
      if (!impact) {
        this.peaks.push(peak);
        if (this.peaks.length > this.floorWindow) this.peaks.shift();
      }
      return { measured: true, peak_mg: round1(peak), floor_mg: floor === null ? null : round1(floor), impact, level: VibrationMeter.level(peak), suppressed };
    }
  }

  const round1 = (v) => Math.round(v * 10) / 10;

  return { VibrationMeter, G };
});
