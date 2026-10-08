/**
 * 3초 이동창 분류 평활화 (UMD). 신뢰도 가중 다수결로 깜빡임을 없앤다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundSmoother = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  class ClassificationSmoother {
    constructor({ windowSize = 3, confidenceThreshold = 0.3 } = {}) {
      if (!Number.isInteger(windowSize) || windowSize < 1) throw new TypeError('windowSize must be a positive integer');
      this.windowSize = windowSize;
      this.confidenceThreshold = confidenceThreshold;
      this.history = [];
    }

    /**
     * @param {{group:string, confidence:number}} result
     * @returns {{group:string, confidence:number, stable:boolean}}
     */
    push(result) {
      if (!result || typeof result.group !== 'string' || typeof result.confidence !== 'number') {
        throw new TypeError('result {group, confidence} is required');
      }
      this.history.push(result);
      if (this.history.length > this.windowSize) this.history.shift();

      const weights = {};
      this.history.forEach((r) => {
        if (r.group === 'other') return;
        weights[r.group] = (weights[r.group] || 0) + r.confidence;
      });
      let bestGroup = 'other';
      let bestWeight = 0;
      Object.entries(weights).forEach(([g, w]) => {
        if (w > bestWeight) {
          bestGroup = g;
          bestWeight = w;
        }
      });
      const count = this.history.filter((r) => r.group === bestGroup).length;
      const avgConfidence = count ? bestWeight / count : 0;
      const stable = bestGroup !== 'other' && count >= Math.ceil(this.windowSize / 2) && avgConfidence >= this.confidenceThreshold;
      return {
        group: stable ? bestGroup : 'other',
        confidence: Math.round(avgConfidence * 1000) / 1000,
        stable,
      };
    }

    reset() {
      this.history = [];
    }
  }

  return { ClassificationSmoother };
});
