const { ValidationError, NotFoundError } = require('../utils/errors');
const { timeUtil } = require('../utils/time');
const { REPORT_PERIODS } = require('../shared/constants');

/** 기간 집계와 AI 리포트 생성·저장 */
class ReportService {
  constructor({ eventModel, reportModel, aggregationService, aiWriter, settingsService, thresholdService, time = timeUtil }) {
    if (!eventModel || !reportModel || !aggregationService || !aiWriter || !settingsService || !thresholdService) {
      throw new TypeError('dependencies are required');
    }
    this.eventModel = eventModel;
    this.reportModel = reportModel;
    this.aggregation = aggregationService;
    this.aiWriter = aiWriter;
    this.settingsService = settingsService;
    this.thresholdService = thresholdService;
    this.time = time;
  }

  resolvePeriod(days, now = new Date()) {
    if (!REPORT_PERIODS.includes(days)) throw new ValidationError('기간은 7, 14, 30일 중 하나여야 합니다.');
    const to = now;
    const from = this.time.addDays(this.time.startOfDay(now), -(days - 1));
    return { from, to, days };
  }

  /** 집계 JSON (서버 계산) + 직전 같은 길이 기간과의 비교 */
  async getSummary(userId, days = 7, now = new Date()) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const period = this.resolvePeriod(days, now);
    const prevFrom = this.time.addDays(period.from, -days);
    const [events, prevEvents] = await Promise.all([
      this.eventModel.findByUser(userId, { from: period.from, to: this.time.addDays(period.to, 1) }),
      this.eventModel.findByUser(userId, { from: prevFrom, to: period.from }),
    ]);
    const summary = this.aggregation.summarize(events, period);
    summary.comparison = this.compare(summary, prevEvents, { from: prevFrom, to: period.from, days });
    return summary;
  }

  /** 직전 기간 대비 증감 (기록이 없던 기간이면 null) */
  compare(summary, prevEvents, prevPeriod) {
    if (!summary || !Array.isArray(prevEvents)) throw new TypeError('summary and prevEvents are required');
    const recordedDays = new Set(prevEvents.map((e) => this.time.formatDate(e.started_at))).size;
    const minDays = Math.ceil(prevPeriod.days / 2);
    if (recordedDays < minDays) {
      return {
        has_previous: false,
        reason: prevEvents.length ? 'sparse' : 'none',
        recorded_days: recordedDays,
        previous_from: this.time.formatDate(prevPeriod.from),
        previous_to: this.time.formatDate(this.time.addDays(prevPeriod.to, -1)),
        previous_label: `${this.time.formatKorean(prevPeriod.from, false)} ~ ${this.time.formatKorean(this.time.addDays(prevPeriod.to, -1), false)}`,
      };
    }
    const prev = this.aggregation.summarize(prevEvents, prevPeriod);
    const delta = (a, b) => ({ previous: b, delta: a - b, percent: b ? Math.round(((a - b) / b) * 100) : null });
    return {
      has_previous: true,
      previous_from: prev.period.from,
      previous_to: this.time.formatDate(this.time.addDays(prevPeriod.to, -1)),
      total: delta(summary.total_events, prev.total_events),
      exceeded: delta(summary.exceeded_events, prev.exceeded_events),
      night: delta(summary.night_events, prev.night_events),
      previous_top_source: prev.top_source ? prev.top_source.label : null,
      previous_top_hour: prev.top_hour ? prev.top_hour.label : null,
    };
  }

  /** 집계 + LLM 요약문 생성 + 저장 */
  async generate(userId, days = 7, now = new Date(), { onEvent = null, signal = null } = {}) {
    const summary = await this.getSummary(userId, days, now);
    const [settings, thresholds] = await Promise.all([this.settingsService.get(userId), this.thresholdService.getAll()]);
    const written = await this.aiWriter.writeReport(summary, { settings, thresholds, onEvent, signal });
    return this.reportModel.insert({
      user_id: userId,
      period_from: summary.period.from,
      period_to: summary.period.to,
      days,
      summary_json: summary,
      ai_text: written.text,
      provider: written.provider,
      fallback: written.fallback,
      attempts: written.attempts,
    });
  }

  async getLatest(userId, days = null) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    return this.reportModel.findLatest(userId, days);
  }

  async getByIdForUser(id, userId) {
    if (!id || !userId) throw new ValidationError('리포트 식별자가 없습니다.');
    const report = await this.reportModel.findById(id);
    if (!report || report.user_id !== userId) throw new NotFoundError('리포트를 찾을 수 없습니다.');
    return report;
  }

  /** 질문 답변용 파생 수치 (모두 서버가 계산) */
  deriveForAsk(summary) {
    if (!summary) throw new TypeError('summary is required');
    const wc = summary.weekday_counts || [];
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    const max = Math.max(0, ...wc);
    return {
      weekday_total: wc.slice(0, 5).reduce((a, b) => a + b, 0),
      weekend_total: wc.slice(5).reduce((a, b) => a + b, 0),
      busiest_weekday: max > 0 ? { label: days[wc.indexOf(max)], count: max } : null,
      night_share: summary.total_events ? Math.round((summary.night_events / summary.total_events) * 100) : 0,
    };
  }

  /** 기록에게 묻기. 답은 저장하지 않는다 */
  async ask(userId, days, { question, questionKey = null }, { onEvent = null, signal = null, now = new Date() } = {}) {
    const summary = await this.getSummary(userId, days, now);
    const context = { ...summary, derived: this.deriveForAsk(summary) };
    const [settings, thresholds] = await Promise.all([this.settingsService.get(userId), this.thresholdService.getAll()]);
    const written = await this.aiWriter.writeAnswer(context, { question, questionKey }, { settings, thresholds, onEvent, signal });
    return { question, question_key: questionKey, answer: written.text, provider: written.provider, fallback: written.fallback, attempts: written.attempts };
  }

  /** 저장된 요약문이 지금 집계와 같은 기간·같은 숫자로 만들어졌는지 */
  isFresh(report, summary) {
    if (!report || !summary) return false;
    const s = report.summary_json || {};
    return report.period_from === summary.period.from
      && report.period_to === summary.period.to
      && s.total_events === summary.total_events
      && s.exceeded_events === summary.exceeded_events;
  }

  /** 다이얼 아래 한 줄 핵심 패턴과 증감 문장 (숫자는 집계값 그대로) */
  headline(summary, days) {
    if (!summary) throw new TypeError('summary is required');
    if (!summary.total_events) {
      return { pattern: `최근 ${days}일 동안 기록된 사건이 없습니다.`, delta: null };
    }
    const pattern = summary.top_hour && summary.top_source
      ? `${summary.top_hour.label}에 가장 많이 기록되었고, 주된 소음원은 ${summary.top_source.label}입니다.`
      : `최근 ${days}일 동안 ${summary.total_events}건이 기록되었습니다.`;
    const c = summary.comparison;
    let delta = null;
    if (c && c.has_previous) {
      const d = c.total.delta;
      delta = d === 0 ? `직전 ${days}일과 같은 수준입니다.` : `직전 ${days}일보다 ${Math.abs(d)}건 ${d > 0 ? '늘었습니다' : '줄었습니다'}.`;
    }
    return { pattern, delta };
  }

  /** 리포트 화면용: 최신 집계 + 같은 기간의 최근 AI 요약문 */
  async buildView(userId, days = 7, now = new Date()) {
    const [summary, latest, settings] = await Promise.all([
      this.getSummary(userId, days, now),
      this.getLatest(userId, days),
      this.settingsService.get(userId),
    ]);
    return {
      days,
      periods: REPORT_PERIODS,
      summary,
      headline: this.headline(summary, days),
      report: this.isFresh(latest, summary) ? latest : null,
      stale_report: Boolean(latest) && !this.isFresh(latest, summary),
      settings,
      hourly_max: Math.max(1, ...summary.hourly),
      source_max: Math.max(1, ...summary.by_source.map((s) => s.count)),
      generated_label: latest ? this.time.formatKorean(latest.created_at) : null,
    };
  }
}

module.exports = { ReportService };
