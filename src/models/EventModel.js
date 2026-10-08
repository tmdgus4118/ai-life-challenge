const { BaseModel } = require('./BaseModel');

/**
 * events 컬렉션
 * id, user_id, started_at, ended_at, source_group, avg_db, max_db,
 * is_night, exceeded, exceeded_rule, memo, excluded, created_at
 */
class EventModel extends BaseModel {
  constructor(dbDir) {
    super(dbDir, 'events');
  }

  /**
   * 사용자별 사건 조회. from/to는 ISO 문자열 또는 Date, source는 그룹 키.
   * 시작 시각 오름차순으로 정렬한다.
   */
  async findByUser(userId, { from = null, to = null, source = null, includeExcluded = false } = {}) {
    if (!userId) throw new TypeError('userId is required');
    const fromMs = from ? new Date(from).getTime() : null;
    const toMs = to ? new Date(to).getTime() : null;
    if ((from && Number.isNaN(fromMs)) || (to && Number.isNaN(toMs))) throw new TypeError('invalid date range');
    const rows = await this.findAll((row) => {
      if (row.user_id !== userId) return false;
      if (!includeExcluded && row.excluded) return false;
      const started = new Date(row.started_at).getTime();
      if (fromMs !== null && started < fromMs) return false;
      if (toMs !== null && started >= toMs) return false;
      if (source && row.source_group !== source) return false;
      return true;
    });
    return rows.sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  }

  /** 최근 사건 n개 (최신순) */
  async findRecent(userId, limit = 3) {
    if (!userId) throw new TypeError('userId is required');
    const rows = await this.findByUser(userId);
    return rows.slice(-limit).reverse();
  }

  async findByIdForUser(id, userId) {
    if (!id || !userId) throw new TypeError('id and userId are required');
    return this.findOne((row) => row.id === id && row.user_id === userId);
  }

  async deleteByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    return this.deleteWhere((row) => row.user_id === userId);
  }
}

module.exports = { EventModel };
