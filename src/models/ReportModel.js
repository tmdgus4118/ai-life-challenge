const { BaseModel } = require('./BaseModel');

/**
 * reports 컬렉션: id, user_id, period_from, period_to, days, summary_json, ai_text, provider, created_at
 */
class ReportModel extends BaseModel {
  constructor(dbDir) {
    super(dbDir, 'reports');
  }

  async findByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    const rows = await this.findAll((r) => r.user_id === userId);
    return BaseModel.sortNewestFirst(rows);
  }

  /** 기간(days)이 같은 가장 최근 리포트 */
  async findLatest(userId, days = null) {
    const rows = await this.findByUser(userId);
    const filtered = days ? rows.filter((r) => r.days === days) : rows;
    return filtered[0] || null;
  }

  async deleteByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    return this.deleteWhere((r) => r.user_id === userId);
  }
}

module.exports = { ReportModel };
