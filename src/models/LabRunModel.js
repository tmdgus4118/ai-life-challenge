const { BaseModel } = require('./BaseModel');

/**
 * lab_runs 컬렉션: 분류 정확도 측정 1회 기록
 * id, user_id, expected_group, frames[{group, confidence, top_class}], predicted_group, correct, created_at
 */
class LabRunModel extends BaseModel {
  constructor(dbDir) {
    super(dbDir, 'lab_runs');
  }

  async findByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    const rows = await this.findAll((r) => r.user_id === userId);
    return BaseModel.sortNewestFirst(rows);
  }

  async deleteByUser(userId) {
    if (!userId) throw new TypeError('userId is required');
    return this.deleteWhere((r) => r.user_id === userId);
  }
}

module.exports = { LabRunModel };
