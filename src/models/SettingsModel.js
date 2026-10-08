const { BaseModel } = require('./BaseModel');
const { DEFAULT_SETTINGS } = require('../shared/constants');

/**
 * settings 컬렉션: user_id, night_start, night_end, db_offset, min_duration_sec, ...
 * 저장된 값이 없으면 기본값을 돌려준다.
 */
class SettingsModel extends BaseModel {
  constructor(dbDir) {
    super(dbDir, 'settings');
  }

  async findByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    const row = await this.findOne((s) => s.user_id === userId);
    return { ...DEFAULT_SETTINGS, ...(row || {}), user_id: userId };
  }

  /** 없으면 생성, 있으면 병합 갱신 */
  async upsert(userId, patch) {
    if (!userId) throw new TypeError('userId is required');
    if (!patch || typeof patch !== 'object') throw new TypeError('patch must be an object');
    const existing = await this.findOne((s) => s.user_id === userId);
    if (existing) {
      return this.updateById(existing.id, patch);
    }
    return this.insert({ ...DEFAULT_SETTINGS, ...patch, user_id: userId });
  }

  async deleteByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    return this.deleteWhere((s) => s.user_id === userId);
  }
}

module.exports = { SettingsModel };
