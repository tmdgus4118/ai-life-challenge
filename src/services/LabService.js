const { ValidationError } = require('../utils/errors');
const { SOURCE_GROUPS } = require('../shared/constants');

/**
 * 분류 정확도 측정. 공개 음원을 틀어 놓고 일정 시간 분류한 결과를 정답과 비교한다.
 * 한 번의 측정은 '기타'를 뺀 프레임 다수결로 예측 소음원을 정한다 (전부 기타면 기타).
 */
class LabService {
  constructor({ labRunModel }) {
    if (!labRunModel) throw new TypeError('labRunModel is required');
    this.labRunModel = labRunModel;
  }

  /** 프레임 다수결. 동률이면 평균 신뢰도가 높은 쪽 */
  static predict(frames) {
    if (!Array.isArray(frames) || frames.length === 0) throw new TypeError('frames must be a non-empty array');
    const tally = {};
    frames.forEach((f) => {
      if (f.group === 'other') return;
      if (!tally[f.group]) tally[f.group] = { count: 0, conf: 0 };
      tally[f.group].count += 1;
      tally[f.group].conf += f.confidence || 0;
    });
    const ranked = Object.entries(tally).sort((a, b) => b[1].count - a[1].count || b[1].conf - a[1].conf);
    return ranked.length ? ranked[0][0] : 'other';
  }

  async record(userId, { expected_group: expected, frames }) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const predicted = LabService.predict(frames);
    const frameHits = frames.filter((f) => f.group === expected).length;
    return this.labRunModel.insert({
      user_id: userId,
      expected_group: expected,
      frames,
      predicted_group: predicted,
      correct: predicted === expected,
      frame_accuracy: Math.round((frameHits / frames.length) * 100),
    });
  }

  /** 소음원별 정확도, 전체 정확도, 혼동 행렬 */
  async summary(userId) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const runs = await this.labRunModel.findByUser(userId);
    const keys = SOURCE_GROUPS.map((g) => g.key);
    const matrix = {};
    keys.forEach((e) => { matrix[e] = {}; keys.forEach((p) => { matrix[e][p] = 0; }); });
    runs.forEach((r) => { if (matrix[r.expected_group]) matrix[r.expected_group][r.predicted_group] += 1; });
    const byGroup = SOURCE_GROUPS.filter((g) => g.key !== 'other').map((g) => {
      const list = runs.filter((r) => r.expected_group === g.key);
      const correct = list.filter((r) => r.correct).length;
      return { key: g.key, label: g.label, icon: g.icon, runs: list.length, correct, accuracy: list.length ? Math.round((correct / list.length) * 100) : null };
    });
    const correct = runs.filter((r) => r.correct).length;
    return {
      total_runs: runs.length,
      correct,
      accuracy: runs.length ? Math.round((correct / runs.length) * 100) : null,
      by_group: byGroup,
      matrix,
      labels: SOURCE_GROUPS.map((g) => ({ key: g.key, label: g.label })),
      recent: runs.slice(0, 10).map((r) => ({ id: r.id, expected_group: r.expected_group, predicted_group: r.predicted_group, correct: r.correct, frame_accuracy: r.frame_accuracy, created_at: r.created_at })),
    };
  }

  async clear(userId) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    return this.labRunModel.deleteByUser(userId);
  }
}

module.exports = { LabService };
