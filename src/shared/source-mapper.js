/**
 * YAMNet 521 클래스 점수 → 7개 소음원 그룹 (UMD).
 * 매핑은 JSON 설정 파일(source-mapping.json)에서 받는다. 그룹 점수는 그룹에 속한 클래스 점수의 최대값.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundSourceMapper = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  class SourceMapper {
    /**
     * @param {{groups: Object<string,string[]>, confidence_threshold?: number}} mapping
     * @param {string[]} classNames YAMNet class map의 display_name 배열(인덱스 순)
     */
    constructor(mapping, classNames, { confidenceThreshold = null } = {}) {
      if (!mapping || !mapping.groups || typeof mapping.groups !== 'object') throw new TypeError('mapping.groups is required');
      if (!Array.isArray(classNames) || classNames.length === 0) throw new TypeError('classNames must be a non-empty array');
      this.classNames = classNames;
      this.threshold = confidenceThreshold ?? mapping.confidence_threshold ?? 0.3;
      this.groupIndices = {};
      this.unmatched = [];
      Object.entries(mapping.groups).forEach(([group, names]) => {
        const idx = [];
        names.forEach((name) => {
          const i = classNames.indexOf(name);
          if (i === -1) this.unmatched.push(name);
          else idx.push(i);
        });
        this.groupIndices[group] = idx;
      });
    }

    setThreshold(value) {
      if (typeof value !== 'number' || value < 0 || value > 1) throw new RangeError('threshold must be 0-1');
      this.threshold = value;
    }

    /**
     * @param {ArrayLike<number>} scores 521개 클래스 점수 (한 프레임 또는 프레임 평균)
     * @returns {{group:string, confidence:number, topClass:string|null, groupScores:Object}}
     */
    map(scores) {
      if (!scores || scores.length !== this.classNames.length) {
        throw new TypeError(`scores length must be ${this.classNames.length}`);
      }
      const groupScores = {};
      let best = { group: 'other', score: 0, classIndex: -1 };
      Object.entries(this.groupIndices).forEach(([group, idx]) => {
        let max = 0;
        let maxIdx = -1;
        idx.forEach((i) => {
          if (scores[i] > max) {
            max = scores[i];
            maxIdx = i;
          }
        });
        groupScores[group] = Math.round(max * 1000) / 1000;
        if (max > best.score) best = { group, score: max, classIndex: maxIdx };
      });
      let topIdx = 0;
      for (let i = 1; i < scores.length; i += 1) if (scores[i] > scores[topIdx]) topIdx = i;
      const confidence = Math.round(best.score * 1000) / 1000;
      return {
        group: confidence >= this.threshold ? best.group : 'other',
        confidence,
        topClass: best.classIndex >= 0 ? this.classNames[best.classIndex] : null,
        rawTopClass: this.classNames[topIdx],
        groupScores,
      };
    }

    /** 프레임별 점수 [frames][classes] → 평균 점수 */
    static averageFrames(frames) {
      if (!Array.isArray(frames) || frames.length === 0) throw new TypeError('frames must be a non-empty array');
      const n = frames[0].length;
      const out = new Array(n).fill(0);
      frames.forEach((f) => {
        if (f.length !== n) throw new TypeError('frame length mismatch');
        for (let i = 0; i < n; i += 1) out[i] += f[i];
      });
      return out.map((v) => v / frames.length);
    }

    /** class map CSV 텍스트 → display_name 배열 */
    static parseClassMapCsv(csv) {
      if (typeof csv !== 'string' || !csv.trim()) throw new TypeError('csv text is required');
      const lines = csv.trim().split(/\r?\n/);
      const names = [];
      lines.slice(1).forEach((line) => {
        const m = line.match(/^(\d+),([^,]*),(.*)$/);
        if (!m) return;
        let name = m[3].trim();
        if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1).replace(/""/g, '"');
        names[Number(m[1])] = name;
      });
      if (names.length === 0) throw new TypeError('no classes parsed');
      return names;
    }
  }

  return { SourceMapper };
});
