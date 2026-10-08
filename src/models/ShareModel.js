const { BaseModel } = require('./BaseModel');

/**
 * shares 컬렉션: 읽기 전용 리포트 공유 링크
 * id, user_id, token, days, period_from, period_to, summary_json(메모 제외 스냅숏), ai_text, created_at, expires_at, revoked
 */
class ShareModel extends BaseModel {
  constructor(dbDir) {
    super(dbDir, 'shares');
  }

  async findByToken(token) {
    if (!token) throw new TypeError('token is required');
    return this.findOne((s) => s.token === token);
  }

  async findByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    const rows = await this.findAll((s) => s.user_id === userId);
    return BaseModel.sortNewestFirst(rows);
  }

  async deleteByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    return this.deleteWhere((s) => s.user_id === userId);
  }
}

module.exports = { ShareModel };
