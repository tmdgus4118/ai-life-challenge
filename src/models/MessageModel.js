const { BaseModel } = require('./BaseModel');

/**
 * messages 컬렉션: id, user_id, report_id, recipient_type, tone, body, created_at
 */
class MessageModel extends BaseModel {
  constructor(dbDir) {
    super(dbDir, 'messages');
  }

  async findByUser(userId, { recipient = null } = {}) {
    if (!userId) throw new TypeError('userId is required');
    const rows = await this.findAll((m) => m.user_id === userId && (!recipient || m.recipient_type === recipient));
    return BaseModel.sortNewestFirst(rows);
  }

  /** 수신자별 첫 생성 시각 (단계 안내 계산용) */
  async findFirstByRecipient(userId, recipient) {
    if (!recipient) throw new TypeError('recipient is required');
    const rows = await this.findByUser(userId, { recipient });
    return rows.length ? rows[rows.length - 1] : null;
  }

  /** 수신자별 가장 이른 "전달했음" 시각의 메시지 (없으면 null) */
  async findFirstDeliveredByRecipient(userId, recipient) {
    if (!recipient) throw new TypeError('recipient is required');
    const rows = (await this.findByUser(userId, { recipient })).filter((m) => m.delivered_at);
    if (!rows.length) return null;
    return rows.sort((a, b) => new Date(a.delivered_at) - new Date(b.delivered_at))[0];
  }

  async findByIdForUser(id, userId) {
    if (!id || !userId) throw new TypeError('id and userId are required');
    return this.findOne((m) => m.id === id && m.user_id === userId);
  }

  async deleteByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    return this.deleteWhere((m) => m.user_id === userId);
  }
}

module.exports = { MessageModel };
