const { ValidationError } = require('../utils/errors');
const rules = require('../shared/threshold-rules');
const { SETTINGS_LIMITS, SETTINGS_BOOLEANS, SETTINGS_ENUMS } = require('../shared/constants');

/** 사용자별 설정(야간 시간, 보정 오프셋, 민감도) */
class SettingsService {
  constructor(settingsModel) {
    if (!settingsModel) throw new TypeError('settingsModel is required');
    this.settingsModel = settingsModel;
  }

  async get(userId) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    return this.settingsModel.findByUser(userId);
  }

  /** 범위 검증 후 저장. DTO를 거친 값을 다시 한 번 방어적으로 검사한다. */
  async update(userId, patch) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) {
      throw new ValidationError('변경할 설정 항목이 없습니다.');
    }
    const clean = {};
    Object.entries(patch).forEach(([key, value]) => {
      if (SETTINGS_ENUMS[key]) {
        if (!SETTINGS_ENUMS[key].includes(value)) throw new ValidationError(`${key} 값이 올바르지 않습니다.`, { field: key });
        clean[key] = value;
        return;
      }
      if (SETTINGS_BOOLEANS.includes(key)) {
        if (typeof value !== 'boolean') throw new ValidationError(`${key}는 참/거짓이어야 합니다.`, { field: key });
        clean[key] = value;
        return;
      }
      const limit = SETTINGS_LIMITS[key];
      if (!limit) return;
      if (typeof value !== 'number' || Number.isNaN(value) || value < limit.min || value > limit.max) {
        throw new ValidationError(`${key} 값이 허용 범위를 벗어났습니다.`, { field: key });
      }
      clean[key] = value;
    });
    if (Object.keys(clean).length === 0) throw new ValidationError('변경할 설정 항목이 없습니다.');
    const current = await this.settingsModel.findByUser(userId);
    const merged = { ...current, ...clean };
    if (merged.night_start === merged.night_end) {
      throw new ValidationError('야간 시작과 종료 시각은 같을 수 없습니다.', { field: 'night_end' });
    }
    await this.settingsModel.upsert(userId, clean);
    return this.settingsModel.findByUser(userId);
  }

  /**
   * 화면 테마 결정. auto면 사용자 야간 시간대(기본 22~06시)에 어두운 화면.
   * @returns {'light'|'dark'}
   */
  resolveTheme(settings, hour) {
    if (!settings) throw new TypeError('settings is required');
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('hour must be 0-23');
    if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
    return rules.isNightHour(hour, settings.night_start, settings.night_end) ? 'dark' : 'light';
  }

  /**
   * 마이크 보정: 조용한 방에서 측정한 평균 dBFS를 받아 30dB가 되도록 오프셋을 계산한다.
   */
  async calibrate(userId, measuredDbfs, targetDb = 30) {
    if (typeof measuredDbfs !== 'number' || Number.isNaN(measuredDbfs) || measuredDbfs > 0 || measuredDbfs < -120) {
      throw new ValidationError('측정값(dBFS)은 -120~0 사이여야 합니다.', { field: 'measured_dbfs' });
    }
    const offset = Math.round((targetDb - measuredDbfs) * 10) / 10;
    const { min, max } = SETTINGS_LIMITS.db_offset;
    const clamped = Math.min(max, Math.max(min, offset));
    return this.update(userId, { db_offset: clamped });
  }
}

module.exports = { SettingsService };
