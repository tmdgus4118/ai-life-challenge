/**
 * "지금은 우리 집" 토글 (UMD). 한 번 누르면 제외 시작, 다시 누르면 해제.
 * 켜진 시각을 기억해 경과 시간을 표시하고, 상태가 바뀔 때마다 onChange를 호출한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundExclusionToggle = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  class ExclusionToggle {
    constructor({ onChange = null } = {}) {
      if (onChange !== null && typeof onChange !== 'function') throw new TypeError('onChange must be a function');
      this.onChange = onChange;
      this.on = false;
      this.startedAt = null;
    }

    get isOn() {
      return this.on;
    }

    toDate(now) {
      const date = now instanceof Date ? now : new Date(now);
      if (Number.isNaN(date.getTime())) throw new TypeError('invalid time');
      return date;
    }

    /** 상태를 지정한다. 바뀌었을 때만 onChange 호출 */
    set(on, now = new Date()) {
      if (typeof on !== 'boolean') throw new TypeError('on must be a boolean');
      const at = this.toDate(now);
      if (this.on === on) return this.on;
      this.on = on;
      this.startedAt = on ? at : null;
      if (this.onChange) this.onChange(this.on);
      return this.on;
    }

    toggle(now = new Date()) {
      return this.set(!this.on, now);
    }

    /** 감지 중지 등으로 강제로 끈다 */
    reset() {
      return this.set(false);
    }

    /** 켜진 뒤 지난 초 (꺼져 있으면 0) */
    elapsedSec(now = new Date()) {
      if (!this.on || !this.startedAt) return 0;
      return Math.max(0, Math.floor((this.toDate(now) - this.startedAt) / 1000));
    }

    /** m:ss */
    formatElapsed(now = new Date()) {
      const sec = this.elapsedSec(now);
      return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    }
  }

  return { ExclusionToggle };
});
