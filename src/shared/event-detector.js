/**
 * 사건 판정기 (UMD). 1초 단위 샘플(시각, 소음원, dB, 초과 여부, 제외 여부)을 받아
 *  - 같은 소음원이 기준 초과로 minDurationSec(기본 3초) 이상 이어지면 사건 시작
 *  - quietEndSec(기본 10초) 이상 조용하면 사건 종료
 *  - "지금은 우리 집" 구간(excluded)의 소리는 사건에 넣지 않는다.
 *    제외된 1초는 조용한 1초로 취급하므로, 제외가 quietEndSec보다 짧으면 앞뒤 소리가 한 사건으로 이어지고
 *    길면 사건이 끝난다. 평균·최고 dB와 최소 지속시간 판정에는 제외 구간을 쓰지 않는다.
 *  - 1초 샘플에 바닥 진동(vib: {impact, peak_mg})이 있으면 사건마다 진동 동반 초·최고 진동·1초별 진동을 남긴다.
 *    진동 센서가 없으면 진동 항목을 아예 만들지 않는다(0초와 구분).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./decibel'));
  } else {
    root.NeighborSoundEventDetector = factory(root.NeighborSoundDecibel);
  }
})(typeof self !== 'undefined' ? self : this, function (decibel) {
  const { DecibelMeter } = decibel;

  class EventDetector {
    constructor({ minDurationSec = 3, quietEndSec = 10, onEvent = null } = {}) {
      if (!(minDurationSec >= 1)) throw new TypeError('minDurationSec must be >= 1');
      if (!(quietEndSec >= 1)) throw new TypeError('quietEndSec must be >= 1');
      this.minDurationSec = minDurationSec;
      this.quietEndSec = quietEndSec;
      this.onEvent = onEvent;
      this.reset();
    }

    reset() {
      this.candidate = null; // {group, samples:[]}
      this.current = null; // {group, samples:[], lastExceedAt}
      this.quietCount = 0;
    }

    configure({ minDurationSec, quietEndSec } = {}) {
      if (minDurationSec !== undefined) {
        if (!(minDurationSec >= 1)) throw new TypeError('minDurationSec must be >= 1');
        this.minDurationSec = minDurationSec;
      }
      if (quietEndSec !== undefined) {
        if (!(quietEndSec >= 1)) throw new TypeError('quietEndSec must be >= 1');
        this.quietEndSec = quietEndSec;
      }
    }

    /**
     * @param {{at:Date|string|number, group:string, db:number, exceeded:boolean, excluded?:boolean, confidence?:number, vib?:{impact:boolean, peak_mg:number}|null}} sample
     * @returns {object|null} 종료된 사건이 있으면 사건 객체
     */
    push(sample) {
      if (!sample || sample.at === undefined || typeof sample.group !== 'string' || typeof sample.db !== 'number') {
        throw new TypeError('sample {at, group, db, exceeded} is required');
      }
      const at = new Date(sample.at);
      if (Number.isNaN(at.getTime())) throw new TypeError('sample.at is invalid');
      const active = Boolean(sample.exceeded) && !sample.excluded && sample.group !== 'other';
      const vib = !sample.excluded && EventDetector.isVib(sample.vib) ? { impact: Boolean(sample.vib.impact), peak_mg: sample.vib.peak_mg } : null;

      // 진행 중 사건 처리
      if (this.current) {
        this.current.timeline.push({ at, db: sample.excluded ? null : sample.db, vib });
        if (active && sample.group === this.current.group) {
          this.current.samples.push({ at, db: sample.db, confidence: sample.confidence, vib });
          this.current.lastExceedAt = at;
          // 사건 중간에 끼어 있던 제외 시간만 확정해서 센다
          this.current.excludedSec += this.current.pendingExcluded;
          this.current.pendingExcluded = 0;
          this.quietCount = 0;
          this.candidate = null;
          return null;
        }
        this.quietCount += 1;
        if (sample.excluded) this.current.pendingExcluded += 1;
        if (active) this.trackCandidate(sample, at, vib);
        if (this.quietCount >= this.quietEndSec) {
          const finished = this.finish();
          if (this.candidate && this.candidate.samples.length >= this.minDurationSec) this.promoteCandidate();
          return finished;
        }
        return null;
      }

      // 사건 없음: 후보 추적
      if (active) {
        this.trackCandidate(sample, at, vib);
        if (this.candidate.samples.length >= this.minDurationSec) this.promoteCandidate();
      } else {
        this.candidate = null;
      }
      return null;
    }

    trackCandidate(sample, at, vib = null) {
      if (!this.candidate || this.candidate.group !== sample.group) {
        this.candidate = { group: sample.group, samples: [] };
      }
      this.candidate.samples.push({ at, db: sample.db, confidence: sample.confidence, vib });
    }

    static isVib(v) {
      return Boolean(v) && typeof v === 'object' && typeof v.peak_mg === 'number' && Number.isFinite(v.peak_mg) && v.peak_mg >= 0;
    }

    /** 사건 시작부터 마지막 초과까지의 1초 진동 (1=충격 진동, 0=진동 없음, null=측정 안 됨) */
    static buildVibSeries(timeline, startAt, endAt) {
      if (!Array.isArray(timeline)) throw new TypeError('timeline must be an array');
      const start = new Date(startAt).getTime();
      const end = new Date(endAt).getTime();
      const length = Math.max(1, Math.round((end - start) / 1000) + 1);
      const series = new Array(length).fill(null);
      timeline.forEach((t) => {
        const idx = Math.round((new Date(t.at).getTime() - start) / 1000);
        if (idx >= 0 && idx < length && t.vib) series[idx] = t.vib.impact ? 1 : 0;
      });
      return series;
    }

    /** 진동 요약. 측정된 1초가 하나도 없으면 null */
    static summarizeVib(timeline, startAt, endAt) {
      const start = new Date(startAt).getTime();
      const end = new Date(endAt).getTime();
      const inRange = timeline.filter((t) => t.vib && new Date(t.at).getTime() >= start && new Date(t.at).getTime() <= end);
      if (!inRange.length) return null;
      return {
        vibration_sec: inRange.filter((t) => t.vib.impact).length,
        vibration_peak_mg: Math.round(Math.max(...inRange.map((t) => t.vib.peak_mg)) * 10) / 10,
        vibration_series: EventDetector.buildVibSeries(timeline, startAt, endAt),
      };
    }

    /** 사건 시작부터 마지막 초과까지의 1초 단위 dB (제외 구간은 null) */
    static buildSeries(timeline, startAt, endAt) {
      if (!Array.isArray(timeline)) throw new TypeError('timeline must be an array');
      const start = new Date(startAt).getTime();
      const end = new Date(endAt).getTime();
      const length = Math.max(1, Math.round((end - start) / 1000) + 1);
      const series = new Array(length).fill(null);
      timeline.forEach((t) => {
        const idx = Math.round((new Date(t.at).getTime() - start) / 1000);
        if (idx >= 0 && idx < length) series[idx] = t.db === null ? null : Math.round(t.db * 10) / 10;
      });
      return series;
    }

    promoteCandidate() {
      this.current = {
        group: this.candidate.group,
        samples: this.candidate.samples.slice(),
        lastExceedAt: this.candidate.samples[this.candidate.samples.length - 1].at,
        excludedSec: 0,
        pendingExcluded: 0,
        timeline: this.candidate.samples.map((x) => ({ at: x.at, db: x.db, vib: x.vib || null })),
      };
      this.candidate = null;
      this.quietCount = 0;
    }

    /** 진행 중 사건을 강제 종료 (감지 중지 시) */
    flush() {
      if (!this.current) return null;
      return this.finish();
    }

    finish() {
      const cur = this.current;
      this.current = null;
      this.quietCount = 0;
      if (!cur || cur.samples.length < this.minDurationSec) return null;
      const dbs = cur.samples.map((s) => s.db);
      const confidences = cur.samples.map((s) => s.confidence).filter((c) => typeof c === 'number');
      const startedAt = cur.samples[0].at;
      const endedAt = new Date(cur.lastExceedAt.getTime() + 1000);
      const event = {
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        source_group: cur.group,
        avg_db: DecibelMeter.energyMean(dbs),
        max_db: Math.round(Math.max(...dbs) * 10) / 10,
        confidence: confidences.length ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100 : undefined,
        duration_sec: Math.round((endedAt - startedAt) / 1000),
        excluded_sec: cur.excludedSec,
        db_series: EventDetector.buildSeries(cur.timeline, startedAt, cur.lastExceedAt),
      };
      const vibSummary = EventDetector.summarizeVib(cur.timeline, startedAt, cur.lastExceedAt);
      if (vibSummary) Object.assign(event, vibSummary);
      if (typeof this.onEvent === 'function') this.onEvent(event);
      return event;
    }

    /** 현재 진행 중 사건 요약 (UI 표시용) */
    getCurrent() {
      if (!this.current) return null;
      const summary = {
        group: this.current.group,
        seconds: this.current.samples.length,
        max_db: Math.max(...this.current.samples.map((s) => s.db)),
        excluded_sec: this.current.excludedSec + this.current.pendingExcluded,
      };
      if (this.current.timeline.some((t) => t.vib)) summary.vibration_sec = this.current.timeline.filter((t) => t.vib && t.vib.impact).length;
      return summary;
    }
  }

  return { EventDetector };
});
