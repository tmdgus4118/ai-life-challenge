const { ValidationError, NotFoundError } = require('../utils/errors');
const { timeUtil } = require('../utils/time');
const { RECIPIENTS, TONES, MESSAGE_MAX_LENGTH } = require('../shared/constants');

/** 수신자·말투별 중재 메시지 초안 생성·저장 */
class MessageService {
  constructor({ messageModel, reportService, aiWriter, stepGuideService, settingsService, thresholdService }) {
    if (!messageModel || !reportService || !aiWriter || !stepGuideService || !settingsService || !thresholdService) {
      throw new TypeError('dependencies are required');
    }
    this.messageModel = messageModel;
    this.reportService = reportService;
    this.aiWriter = aiWriter;
    this.stepGuide = stepGuideService;
    this.settingsService = settingsService;
    this.thresholdService = thresholdService;
  }

  async generate(userId, { recipient, tone = 'basic', days = 7, report_id: reportId = null }, { onEvent = null, signal = null } = {}) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    if (!RECIPIENTS.some((r) => r.key === recipient)) throw new ValidationError('수신자 유형이 올바르지 않습니다.');
    if (!TONES.some((t) => t.key === tone)) throw new ValidationError('말투가 올바르지 않습니다.');

    let summary;
    let linkedReportId = null;
    if (reportId) {
      const report = await this.reportService.getByIdForUser(reportId, userId);
      summary = report.summary_json;
      linkedReportId = report.id;
    } else {
      summary = await this.reportService.getSummary(userId, days);
    }
    const [settings, thresholds] = await Promise.all([this.settingsService.get(userId), this.thresholdService.getAll()]);
    if ((settings.role || 'listener') === 'maker' && recipient === 'center') {
      throw new ValidationError('소음을 내는 쪽 모드에서는 이웃사이센터 메시지를 만들지 않습니다.');
    }
    const written = await this.aiWriter.writeMessage(summary, recipient, tone, { settings, thresholds, onEvent, signal });
    const saved = await this.messageModel.insert({
      user_id: userId,
      report_id: linkedReportId,
      recipient_type: recipient,
      tone,
      role: settings.role || 'listener',
      body: written.text,
      length: written.text.length,
      provider: written.provider,
      fallback: written.fallback,
    });
    const nextStep = await this.stepGuide.getGuide(userId);
    return { message: saved, next_step: nextStep, max_length: MESSAGE_MAX_LENGTH };
  }

  /** "전달했음" 표시. 단계 안내는 이 시각을 기준으로 움직인다 */
  async markDelivered(userId, id, { delivered = true, now = new Date() } = {}) {
    if (!userId || !id) throw new ValidationError('메시지 식별자가 없습니다.');
    const row = await this.messageModel.findByIdForUser(id, userId);
    if (!row) throw new NotFoundError('메시지를 찾을 수 없습니다.');
    const updated = await this.messageModel.updateById(id, { delivered_at: delivered ? now.toISOString() : null });
    const nextStep = await this.stepGuide.getGuide(userId, now);
    return { message: updated, next_step: nextStep };
  }

  /** 메시지 이력 (최신순, 수신자·말투 라벨 포함) */
  async getHistory(userId, limit = 20) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const rows = await this.messageModel.findByUser(userId);
    return rows.slice(0, limit).map((m) => this.decorate(m));
  }

  decorate(m) {
    if (!m) throw new TypeError('message is required');
    const r = RECIPIENTS.find((x) => x.key === m.recipient_type);
    const t = TONES.find((x) => x.key === m.tone);
    return {
      ...m,
      recipient_label: r ? r.label : m.recipient_type,
      tone_label: t ? t.label : m.tone,
      created_label: timeUtil.formatKorean(m.created_at),
      delivered_label: m.delivered_at ? timeUtil.formatKorean(m.delivered_at) : null,
    };
  }

  async getLatest(userId, recipient = null, tone = null) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const rows = await this.messageModel.findByUser(userId, { recipient });
    return rows.find((m) => !tone || m.tone === tone) || null;
  }

  /** 중재 화면용 */
  async buildView(userId, { recipient = 'neighbor', tone = 'basic' } = {}) {
    const [latest, guide, history, settings] = await Promise.all([
      this.getLatest(userId, recipient, tone), this.stepGuide.getGuide(userId), this.getHistory(userId, 10), this.settingsService.get(userId),
    ]);
    const role = settings.role || 'listener';
    const recent = await this.reportService.getSummary(userId, 7);
    const recipients = role === 'maker' ? RECIPIENTS.filter((r) => r.key !== 'center') : RECIPIENTS;
    return { recipients, tones: TONES, recipient, tone, message: latest ? this.decorate(latest) : null, next_step: guide, history, role, demo_events: recent.demo_events || 0, max_length: MESSAGE_MAX_LENGTH };
  }
}

module.exports = { MessageService };
