const { timeUtil } = require('../utils/time');
const { SOURCE_GROUPS, DISCLAIMER } = require('../shared/constants');

/**
 * 사건 목록을 리포트용 집계 JSON으로 만든다. 숫자는 전부 여기서 계산하고 LLM은 글만 쓴다.
 */
class AggregationService {
  constructor(time = timeUtil) {
    this.time = time;
  }

  /**
   * @param {Array} events 사건 목록
   * @param {{from:Date|string,to:Date|string,days:number}} period
   */
  summarize(events, period) {
    if (!Array.isArray(events)) throw new TypeError('events must be an array');
    if (!period || !period.from || !period.to || !period.days) throw new TypeError('period {from,to,days} is required');

    const bySource = SOURCE_GROUPS.map((g) => {
      const list = events.filter((e) => e.source_group === g.key);
      return {
        key: g.key,
        label: g.label,
        icon: g.icon,
        count: list.length,
        exceeded: list.filter((e) => e.exceeded).length,
        share: events.length ? Math.round((list.length / events.length) * 100) : 0,
      };
    }).sort((a, b) => b.count - a.count);

    const hourly = Array(24).fill(0);
    const hourlyExceeded = Array(24).fill(0);
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    const weekdayCounts = Array(7).fill(0);
    let nightEvents = 0;
    let nightExceeded = 0;
    let weekdayNight = 0;
    let maxEvent = null;
    let longest = null;
    let dbSum = 0;

    events.forEach((e) => {
      const p = this.time.getParts(e.started_at);
      hourly[p.hour] += 1;
      if (e.exceeded) hourlyExceeded[p.hour] += 1;
      const row = (p.weekday + 6) % 7;
      heatmap[row][p.hour] += 1;
      weekdayCounts[row] += 1;
      if (e.is_night) {
        nightEvents += 1;
        if (e.exceeded) nightExceeded += 1;
        if (row <= 4 && p.hour >= 22) weekdayNight += 1;
      }
      if (!maxEvent || e.max_db > maxEvent.max_db) maxEvent = e;
      const dur = e.duration_sec ?? this.time.diffSeconds(e.started_at, e.ended_at);
      if (!longest || dur > longest.duration) longest = { duration: dur, event: e };
      dbSum += e.avg_db || 0;
    });

    const topHourCount = Math.max(0, ...hourly);
    const topHour = topHourCount > 0 ? hourly.indexOf(topHourCount) : null;
    const topSource = bySource[0] && bySource[0].count > 0 ? bySource[0] : null;

    const memos = events
      .filter((e) => e.memo && e.memo.trim())
      .slice(-5)
      .reverse()
      .map((e) => ({ at_label: this.time.formatKorean(e.started_at), memo: e.memo.trim(), source_label: this.labelOf(e.source_group) }));

    return {
      period: {
        from: this.time.formatDate(period.from),
        to: this.time.formatDate(period.to),
        from_label: this.time.formatKorean(period.from, false),
        to_label: this.time.formatKorean(period.to, false),
        days: period.days,
      },
      total_events: events.length,
      demo_events: events.filter((e) => e.client_id === 'demo').length,
      exceeded_events: events.filter((e) => e.exceeded).length,
      night_events: nightEvents,
      night_exceeded_events: nightExceeded,
      weekday_night_events: weekdayNight,
      by_source: bySource,
      top_source: topSource ? { key: topSource.key, label: topSource.label, count: topSource.count, share: topSource.share } : null,
      hourly,
      hourly_exceeded: hourlyExceeded,
      top_hour: topHour === null ? null : { hour: topHour, count: topHourCount, label: this.hourLabel(topHour) },
      heatmap,
      weekday_counts: weekdayCounts,
      max_db: maxEvent
        ? { value: maxEvent.max_db, source_label: this.labelOf(maxEvent.source_group), at: maxEvent.started_at, at_label: this.time.formatKorean(maxEvent.started_at) }
        : null,
      longest_event: longest
        ? { duration_sec: longest.duration, duration_label: this.time.formatDuration(longest.duration), source_label: this.labelOf(longest.event.source_group), at_label: this.time.formatKorean(longest.event.started_at) }
        : null,
      avg_db_mean: events.length ? Math.round((dbSum / events.length) * 10) / 10 : null,
      vibration: this.summarizeVibration(events),
      memos,
      disclaimer: DISCLAIMER,
    };
  }

  /** 바닥 진동: 진동 센서로 잰 사건 중 충격 진동이 함께 잡힌 사건 수 */
  summarizeVibration(events) {
    if (!Array.isArray(events)) throw new TypeError('events must be an array');
    const measured = events.filter((e) => typeof e.vibration_sec === 'number');
    const withVib = measured.filter((e) => e.vibration_sec > 0);
    return {
      measured_events: measured.length,
      with_vibration: withVib.length,
      share: measured.length ? Math.round((withVib.length / measured.length) * 100) : null,
      exceeded_with_vibration: withVib.filter((e) => e.exceeded).length,
    };
  }

  labelOf(key) {
    const g = SOURCE_GROUPS.find((x) => x.key === key);
    return g ? g.label : '기타';
  }

  hourLabel(hour) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('hour must be 0-23');
    return `${hour}~${(hour + 1) % 24}시`;
  }

  /** 집계 JSON 안의 모든 숫자를 모은다 (LLM 출력 숫자 검증용) */
  collectNumbers(value, acc = new Set()) {
    if (value === null || value === undefined) return acc;
    if (typeof value === 'number') {
      acc.add(value);
      acc.add(Math.round(value));
      return acc;
    }
    if (typeof value === 'string') {
      const matches = value.match(/\d+(?:\.\d+)?/g) || [];
      matches.forEach((m) => acc.add(Number(m)));
      return acc;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => this.collectNumbers(v, acc));
      return acc;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach((v) => this.collectNumbers(v, acc));
    }
    return acc;
  }
}

module.exports = { AggregationService };
