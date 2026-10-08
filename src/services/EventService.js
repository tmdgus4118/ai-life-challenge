const { NotFoundError, ValidationError } = require('../utils/errors');
const { timeUtil } = require('../utils/time');
const { SOURCE_GROUPS } = require('../shared/constants');

/** 사건 저장·조회·삭제·메모와 기록 화면용 집계 */
class EventService {
  constructor({ eventModel, thresholdService, settingsService, time = timeUtil }) {
    if (!eventModel || !thresholdService || !settingsService) throw new TypeError('dependencies are required');
    this.eventModel = eventModel;
    this.thresholdService = thresholdService;
    this.settingsService = settingsService;
    this.time = time;
  }

  /**
   * 최고소음도는 "1시간에 3회 이상"일 때 초과이므로, 이미 저장된 사건과 이번에 저장할 사건을 합쳐
   * 각 사건 시작 시각 기준 직전 60분 안에 최고소음도 기준을 넘은 횟수(자신 포함)를 센다.
   * @returns {Promise<Map<object, number>>} 입력 객체 → 횟수
   */
  async countMaxExceedInHour(userId, sortedInputs, settings) {
    if (!Array.isArray(sortedInputs)) throw new TypeError('sortedInputs must be an array');
    const counts = new Map();
    if (sortedInputs.length === 0) return counts;
    const HOUR = 3600000;
    const first = new Date(sortedInputs[0].started_at).getTime();
    const last = new Date(sortedInputs[sortedInputs.length - 1].started_at).getTime();
    const existing = await this.eventModel.findByUser(userId, { from: new Date(first - HOUR), to: new Date(last + 1000) });
    const overTimes = [];
    for (const e of existing) {
      const limit = await this.thresholdService.getMaxLimit(e, settings);
      if (limit !== null && e.max_db > limit) overTimes.push(new Date(e.started_at).getTime());
    }
    for (const input of sortedInputs) {
      const at = new Date(input.started_at).getTime();
      const limit = await this.thresholdService.getMaxLimit(input, settings);
      if (limit === null || !(input.max_db > limit)) {
        counts.set(input, 0);
        continue;
      }
      overTimes.push(at);
      counts.set(input, overTimes.filter((t) => t > at - HOUR && t <= at).length);
    }
    return counts;
  }

  /** 사건 여러 건 저장. 각 건을 기준과 비교해 초과 여부를 채운다. */
  async createMany(userId, eventInputs) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    if (!Array.isArray(eventInputs) || eventInputs.length === 0) throw new ValidationError('저장할 사건이 없습니다.');
    const settings = await this.settingsService.get(userId);
    const sorted = eventInputs.slice().sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
    const maxCounts = await this.countMaxExceedInHour(userId, sorted, settings);
    const docs = [];
    for (const input of sorted) {
      const verdict = await this.thresholdService.evaluate({ ...input, max_exceed_count_hour: maxCounts.get(input) || 0 }, settings);
      docs.push({
        user_id: userId,
        started_at: input.started_at,
        ended_at: input.ended_at,
        duration_sec: this.time.diffSeconds(input.started_at, input.ended_at),
        source_group: input.source_group,
        avg_db: Math.round(input.avg_db * 10) / 10,
        max_db: Math.round(input.max_db * 10) / 10,
        confidence: input.confidence ?? null,
        is_night: verdict.is_night,
        exceeded: verdict.exceeded,
        exceeded_rule: verdict.exceeded_rule,
        memo: input.memo || '',
        excluded: Boolean(input.excluded),
        client_id: input.client_id || null,
        db_series: Array.isArray(input.db_series) ? input.db_series : null,
        // 바닥 진동: 센서로 잰 사건만 숫자, 재지 않은 사건은 null (0초와 구분)
        vibration_sec: typeof input.vibration_sec === 'number' ? input.vibration_sec : null,
        vibration_peak_mg: typeof input.vibration_peak_mg === 'number' ? Math.round(input.vibration_peak_mg * 10) / 10 : null,
        vibration_series: Array.isArray(input.vibration_series) ? input.vibration_series : null,
      });
    }
    return this.eventModel.insertMany(docs);
  }

  async list(userId, query = {}) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const rows = await this.eventModel.findByUser(userId, { from: query.from, to: query.to, source: query.source });
    return query.limit ? rows.slice(-query.limit) : rows;
  }

  async getRecent(userId, limit = 3) {
    return this.eventModel.findRecent(userId, limit);
  }

  async remove(userId, id) {
    if (!userId || !id) throw new ValidationError('사건 식별자가 없습니다.');
    const row = await this.eventModel.findByIdForUser(id, userId);
    if (!row) throw new NotFoundError('사건을 찾을 수 없습니다.');
    await this.eventModel.deleteById(id);
    return row;
  }

  async updateMemo(userId, id, memo) {
    if (!userId || !id) throw new ValidationError('사건 식별자가 없습니다.');
    if (typeof memo !== 'string') throw new ValidationError('memo는 문자열이어야 합니다.');
    const row = await this.eventModel.findByIdForUser(id, userId);
    if (!row) throw new NotFoundError('사건을 찾을 수 없습니다.');
    return this.eventModel.updateById(id, { memo: memo.trim() });
  }

  /**
   * 기록 화면: 주 단위(월~일) 사건 목록 + 7×24 히트맵 + 날짜별 묶음
   */
  async getWeekView(userId, { weekStart = null, source = null } = {}) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const start = weekStart ? this.time.startOfWeek(this.time.parseDateOnly(weekStart)) : this.time.startOfWeek(new Date());
    const end = this.time.addDays(start, 7);
    const events = await this.eventModel.findByUser(userId, { from: start, to: end, source });
    const heatmap = this.buildHeatmap(events);
    const byDate = this.groupByDate(events);
    return {
      week_start: this.time.formatDate(start),
      week_end: this.time.formatDate(this.time.addDays(start, 6)),
      prev_week: this.time.formatDate(this.time.addDays(start, -7)),
      next_week: this.time.formatDate(this.time.addDays(start, 7)),
      is_current_week: this.time.formatDate(start) === this.time.formatDate(this.time.startOfWeek(new Date())),
      source,
      events: events.slice().reverse(),
      by_date: byDate,
      heatmap,
      heatmap_max: Math.max(0, ...heatmap.flat()),
      total: events.length,
      exceeded: events.filter((e) => e.exceeded).length,
      demo: events.filter((e) => e.client_id === 'demo').length,
    };
  }

  /** 요일(월=0 … 일=6) × 시간대(0~23) 사건 수 */
  buildHeatmap(events) {
    if (!Array.isArray(events)) throw new TypeError('events must be an array');
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    events.forEach((e) => {
      const p = this.time.getParts(e.started_at);
      const row = (p.weekday + 6) % 7;
      grid[row][p.hour] += 1;
    });
    return grid;
  }

  groupByDate(events) {
    if (!Array.isArray(events)) throw new TypeError('events must be an array');
    const map = new Map();
    events.slice().reverse().forEach((e) => {
      const key = this.time.formatDate(e.started_at);
      if (!map.has(key)) map.set(key, { date: key, label: this.time.formatKorean(e.started_at, false), events: [] });
      map.get(key).events.push(e);
    });
    return Array.from(map.values());
  }

  /** CSV 내보내기 (관리사무소·센터 제출용). 엑셀 호환을 위해 BOM을 붙인다 */
  async exportCsv(userId, query = {}) {
    const rows = await this.list(userId, query);
    const header = ['시작일시', '종료일시', '지속(초)', '소음원', '평균dB', '최고dB', '주야', '기준초과', '초과기준', '바닥진동(초)', '메모', '출처'];
    const escape = (v) => {
      const str = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = rows.map((e) => {
      const d = this.decorate(e);
      return [
        this.time.formatDate(e.started_at) + ' ' + this.time.formatTime(e.started_at),
        this.time.formatDate(e.ended_at) + ' ' + this.time.formatTime(e.ended_at),
        e.duration_sec ?? this.time.diffSeconds(e.started_at, e.ended_at),
        d.source_label, e.avg_db, e.max_db, e.is_night ? '야간' : '주간', e.exceeded ? 'Y' : 'N', e.exceeded_rule || '', typeof e.vibration_sec === 'number' ? e.vibration_sec : '미측정', e.memo || '',
        e.client_id === 'demo' ? '데모(모의 데이터)' : '감지 기록',
      ].map(escape).join(',');
    });
    return '\uFEFF' + [header.join(','), ...lines].join('\n') + '\n';
  }

  /** 뷰에서 쓰기 좋은 형태로 사건을 꾸민다 */
  decorate(event) {
    if (!event) throw new TypeError('event is required');
    const group = SOURCE_GROUPS.find((g) => g.key === event.source_group) || SOURCE_GROUPS[6];
    return {
      ...event,
      source_label: group.label,
      source_icon: group.icon,
      time_label: this.time.formatTime(event.started_at),
      date_label: this.time.formatKorean(event.started_at, false),
      duration_label: this.time.formatDuration(event.duration_sec ?? this.time.diffSeconds(event.started_at, event.ended_at)),
      weekday_index: (this.time.getParts(event.started_at).weekday + 6) % 7,
      is_demo: event.client_id === 'demo',
      has_vibration: typeof event.vibration_sec === 'number' && event.vibration_sec > 0,
      hour: this.time.getParts(event.started_at).hour,
    };
  }
}

module.exports = { EventService };
