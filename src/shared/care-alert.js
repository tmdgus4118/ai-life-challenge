/**
 * 배려 알림 (UMD). "소음을 내는 쪽" 사용자가 감지 중일 때,
 * 우리 집 소리가 지금 시간대 기준에 가까워지거나 넘으면 바로 알려 준다.
 *  - 기준에서 marginDb 이내로 sustainSec초 이상 이어지면 '가까움', 기준을 넘으면 '넘음'
 *  - 같은 알림이 계속 울리지 않도록 cooldownSec 동안 쉬되, '가까움' 다음에 '넘음'이 오면 바로 알린다
 *  - "기타" 소리와 기준이 없는 소리는 알리지 않는다
 * 우리 집에서 잰 값이라 아랫집에 들리는 크기와 다르므로 참고용 안내다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundCareAlert = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const TIPS = {
    footstep: '뒤꿈치 대신 앞꿈치로 걷거나 실내화를 신어 주세요.',
    furniture: '의자와 문은 천천히 움직이고, 바닥에 놓을 땐 살며시 내려놓아 주세요.',
    hammer: '망치질과 공구 작업은 낮 시간으로 미뤄 주세요.',
    pet: '반려동물이 진정하도록 잠시 살펴봐 주세요.',
    music: '음량을 줄이거나 헤드폰을 써 주세요.',
    voice: '목소리와 TV 음량을 조금만 낮춰 주세요.',
  };

  class CareAlert {
    constructor({ marginDb = 3, sustainSec = 2, cooldownSec = 30 } = {}) {
      if (!(marginDb >= 0)) throw new RangeError('marginDb must be >= 0');
      if (!Number.isInteger(sustainSec) || sustainSec < 1) throw new RangeError('sustainSec must be an integer >= 1');
      if (!(cooldownSec >= 0)) throw new RangeError('cooldownSec must be >= 0');
      this.marginDb = marginDb;
      this.sustainSec = sustainSec;
      this.cooldownSec = cooldownSec;
      this.reset();
    }

    reset() {
      this.streak = 0;
      this.streakLevel = null;
      this.lastAlertAt = null;
      this.lastLevel = null;
      this.count = 0;
      this.overCount = 0;
    }

    levelOf(db, limit) {
      if (typeof db !== 'number' || typeof limit !== 'number') return null;
      if (db > limit) return 'over';
      if (db >= limit - this.marginDb) return 'near';
      return null;
    }

    /**
     * @param {{at:Date|number|string, group:string, db:number, limit:number|null, excluded?:boolean}} sample
     * @returns {{level:'near'|'over', group:string, db:number, limit:number}|null}
     */
    push(sample) {
      if (!sample || sample.at === undefined || typeof sample.group !== 'string' || typeof sample.db !== 'number') {
        throw new TypeError('sample {at, group, db, limit} is required');
      }
      const at = new Date(sample.at).getTime();
      if (Number.isNaN(at)) throw new TypeError('sample.at is invalid');
      const level = sample.excluded || sample.group === 'other' ? null : this.levelOf(sample.db, sample.limit);
      if (!level) {
        this.streak = 0;
        this.streakLevel = null;
        return null;
      }
      this.streak += 1;
      if (level === 'over' || !this.streakLevel) this.streakLevel = level;
      if (this.streak < this.sustainSec) return null;

      const cooling = this.lastAlertAt !== null && at - this.lastAlertAt < this.cooldownSec * 1000;
      const escalated = this.lastLevel === 'near' && this.streakLevel === 'over';
      if (cooling && !escalated) return null;

      const alert = { level: this.streakLevel, group: sample.group, db: Math.round(sample.db), limit: sample.limit };
      this.lastAlertAt = at;
      this.lastLevel = alert.level;
      this.count += 1;
      if (alert.level === 'over') this.overCount += 1;
      this.streak = 0;
      this.streakLevel = null;
      return alert;
    }

    /** 화면 문구 */
    static describe(alert, { label, isNight } = {}) {
      if (!alert || (alert.level !== 'near' && alert.level !== 'over')) throw new TypeError('alert with level is required');
      const title = alert.level === 'over' ? '아랫집 기준을 넘었어요' : '아랫집 기준에 가까워요';
      const body = (label || '소리') + ' ' + alert.db + 'dB · ' + (isNight ? '야간' : '주간') + ' 기준 ' + alert.limit + 'dB. ' + (TIPS[alert.group] || '잠시 소리를 줄여 주세요.');
      return { title, body };
    }
  }

  return { CareAlert, TIPS };
});
