/**
 * 데시벨 계산 (UMD). AnalyserNode 시간 영역 샘플 → RMS → dBFS → 보정 오프셋을 더한 dB(A) 근사값.
 * 1분 평균은 최근 60개 값의 에너지 평균, 최고값은 그중 최대값.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundDecibel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  class DecibelMeter {
    constructor({ offset = 90, floorDb = 20, ceilDb = 120 } = {}) {
      if (typeof offset !== 'number' || Number.isNaN(offset)) throw new TypeError('offset must be a number');
      this.offset = offset;
      this.floorDb = floorDb;
      this.ceilDb = ceilDb;
    }

    setOffset(offset) {
      if (typeof offset !== 'number' || Number.isNaN(offset)) throw new TypeError('offset must be a number');
      this.offset = offset;
    }

    /** Float32 [-1,1] 샘플의 RMS */
    static rms(samples) {
      if (!samples || typeof samples.length !== 'number' || samples.length === 0) throw new TypeError('samples must be a non-empty array');
      let sum = 0;
      for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
      return Math.sqrt(sum / samples.length);
    }

    /** RMS → dBFS (무음은 -120 하한) */
    static rmsToDbfs(rms) {
      if (typeof rms !== 'number' || Number.isNaN(rms) || rms < 0) throw new TypeError('rms must be >= 0');
      if (rms === 0) return -120;
      return Math.max(-120, 20 * Math.log10(rms));
    }

    /** dBFS + 오프셋 → 표시용 dB (범위 클램프) */
    toDb(dbfs) {
      if (typeof dbfs !== 'number' || Number.isNaN(dbfs)) throw new TypeError('dbfs must be a number');
      const db = dbfs + this.offset;
      return Math.round(Math.min(this.ceilDb, Math.max(this.floorDb, db)) * 10) / 10;
    }

    /** 샘플 배열 → dB 한 번에 */
    measure(samples) {
      return this.toDb(DecibelMeter.rmsToDbfs(DecibelMeter.rms(samples)));
    }

    /** 여러 dB 값의 에너지 평균 (등가소음도 근사) */
    static energyMean(dbs) {
      if (!Array.isArray(dbs) || dbs.length === 0) throw new TypeError('dbs must be a non-empty array');
      const sum = dbs.reduce((acc, db) => acc + Math.pow(10, db / 10), 0);
      return Math.round(10 * Math.log10(sum / dbs.length) * 10) / 10;
    }
  }

  /** 고정 길이 창. 1분 평균(60개)·최고값 계산용 */
  class RollingWindow {
    constructor(size = 60) {
      if (!Number.isInteger(size) || size < 1) throw new TypeError('size must be a positive integer');
      this.size = size;
      this.values = [];
    }

    push(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) throw new TypeError('value must be a number');
      this.values.push(value);
      if (this.values.length > this.size) this.values.shift();
      return this;
    }

    get length() {
      return this.values.length;
    }

    average() {
      return this.values.length ? DecibelMeter.energyMean(this.values) : null;
    }

    max() {
      return this.values.length ? Math.max(...this.values) : null;
    }

    last(n) {
      return this.values.slice(-n);
    }

    clear() {
      this.values = [];
    }
  }

  /**
   * 샘플레이트 변환 (선형 보간). 브라우저가 16kHz AudioContext를 지원하지 않을 때 YAMNet 입력용으로 사용.
   */
  function resample(samples, fromRate, toRate) {
    if (!samples || typeof samples.length !== 'number') throw new TypeError('samples required');
    if (!(fromRate > 0) || !(toRate > 0)) throw new TypeError('rates must be positive');
    if (fromRate === toRate) return Float32Array.from(samples);
    const ratio = fromRate / toRate;
    const outLength = Math.floor(samples.length / ratio);
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i += 1) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = samples[idx];
      const b = idx + 1 < samples.length ? samples[idx + 1] : a;
      out[i] = a + (b - a) * frac;
    }
    return out;
  }

  return { DecibelMeter, RollingWindow, resample };
});
