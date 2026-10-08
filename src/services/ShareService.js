const crypto = require('crypto');
const { ValidationError, NotFoundError, AppError } = require('../utils/errors');
const { SHARE_TTL_DAYS } = require('../shared/constants');

/**
 * 리포트 공유 링크. 만드는 순간의 집계를 스냅숏으로 저장해 관리사무소·이웃사이센터에 전달한다.
 * 개인 메모는 넣지 않고, 일정 기간 뒤 만료되며, 언제든 취소할 수 있다.
 */
class ShareService {
  constructor({ shareModel, reportService, ttlDays = SHARE_TTL_DAYS }) {
    if (!shareModel || !reportService) throw new TypeError('dependencies are required');
    this.shareModel = shareModel;
    this.reportService = reportService;
    this.ttlDays = ttlDays;
  }

  /** 추측하기 어려운 URL용 토큰 (128비트) */
  static newToken() {
    return crypto.randomBytes(16).toString('base64url');
  }

  /** 공유본에서 빼는 항목: 사용자 메모(개인적 내용이 들어갈 수 있음) */
  static sanitize(summary) {
    if (!summary || typeof summary !== 'object') throw new TypeError('summary is required');
    const { memos, ...rest } = summary;
    return { ...rest, memos: [] };
  }

  async create(userId, days, now = new Date()) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const view = await this.reportService.buildView(userId, days, now);
    if (!view.summary.total_events) throw new ValidationError('공유할 기록이 없습니다. 먼저 기록을 쌓아 주세요.');
    const expires = new Date(now.getTime() + this.ttlDays * 86400000);
    const row = await this.shareModel.insert({
      user_id: userId,
      token: ShareService.newToken(),
      days,
      period_from: view.summary.period.from,
      period_to: view.summary.period.to,
      summary_json: ShareService.sanitize(view.summary),
      ai_text: view.report ? view.report.ai_text : null,
      night_start: view.settings.night_start,
      night_end: view.settings.night_end,
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
      revoked: false,
    });
    return this.publicInfo(row);
  }

  /** 소유자에게 돌려주는 정보 (summary 본문 제외) */
  publicInfo(row) {
    if (!row) throw new TypeError('row is required');
    return { id: row.id, token: row.token, path: `/s/${row.token}`, days: row.days, period_from: row.period_from, period_to: row.period_to, created_at: row.created_at, expires_at: row.expires_at, revoked: Boolean(row.revoked) };
  }

  /** 공개 열람: 없거나 취소되면 404, 만료되면 410 */
  async getByToken(token, now = new Date()) {
    if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new NotFoundError('공유 링크를 찾을 수 없습니다.');
    const row = await this.shareModel.findByToken(token);
    if (!row || row.revoked) throw new NotFoundError('공유 링크를 찾을 수 없거나 취소되었습니다.');
    if (new Date(row.expires_at) <= now) throw new AppError('공유 기간이 끝난 링크입니다. 보낸 분께 새 링크를 요청해 주세요.', 410, 'GONE');
    return row;
  }

  async list(userId, now = new Date()) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const rows = await this.shareModel.findByUser(userId);
    return rows.map((r) => ({ ...this.publicInfo(r), expired: new Date(r.expires_at) <= now }));
  }

  async revoke(userId, id) {
    if (!userId || !id) throw new ValidationError('공유 식별자가 없습니다.');
    const row = await this.shareModel.findById(id);
    if (!row || row.user_id !== userId) throw new NotFoundError('공유 링크를 찾을 수 없습니다.');
    const updated = await this.shareModel.updateById(id, { revoked: true });
    return this.publicInfo(updated);
  }
}

module.exports = { ShareService };
