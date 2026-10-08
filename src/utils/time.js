const { TIMEZONE } = require('../shared/constants');

/**
 * 시간대(Asia/Seoul) 기준 날짜 계산 유틸리티. 서버 TZ 설정에 의존하지 않는다.
 */
class TimeUtil {
  constructor(timeZone = TIMEZONE) {
    this.timeZone = timeZone;
    this.formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
  }

  /** 입력을 Date로 바꾼다. 유효하지 않으면 예외. */
  toDate(input) {
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) {
      throw new TypeError('invalid date: ' + input);
    }
    return date;
  }

  /** 시간대 기준 연·월·일·시·분·초·요일(0=일) 분해 */
  getParts(input) {
    const date = this.toDate(input);
    const parts = {};
    this.formatter.formatToParts(date).forEach((p) => {
      parts[p.type] = p.value;
    });
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour) % 24,
      minute: Number(parts.minute),
      second: Number(parts.second),
      weekday: weekdayMap[parts.weekday],
    };
  }

  /** YYYY-MM-DD */
  formatDate(input) {
    const p = this.getParts(input);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }

  /** HH:MM */
  formatTime(input) {
    const p = this.getParts(input);
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  }

  /** M월 D일 (요일) HH:MM */
  formatKorean(input, withTime = true) {
    const p = this.getParts(input);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const base = `${p.month}월 ${p.day}일 (${days[p.weekday]})`;
    return withTime ? `${base} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}` : base;
  }

  /** 시간대 기준 해당 날짜 00:00의 UTC Date */
  startOfDay(input) {
    const date = this.toDate(input);
    const p = this.getParts(date);
    const guess = new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0));
    const offsetMinutes = this.getOffsetMinutes(guess);
    return new Date(guess.getTime() - offsetMinutes * 60000);
  }

  /** 시간대의 UTC 오프셋(분) */
  getOffsetMinutes(input) {
    const date = this.toDate(input);
    const p = this.getParts(date);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUtc - date.getTime()) / 60000);
  }

  /** 월요일 시작 주의 첫날 00:00 */
  startOfWeek(input) {
    const dayStart = this.startOfDay(input);
    const weekday = this.getParts(dayStart).weekday;
    const diff = (weekday + 6) % 7;
    return this.addDays(dayStart, -diff);
  }

  addDays(input, days) {
    const date = this.toDate(input);
    if (typeof days !== 'number' || Number.isNaN(days)) throw new TypeError('days must be a number');
    return new Date(date.getTime() + days * 86400000);
  }

  /** 두 시각 차이(초) */
  diffSeconds(from, to) {
    return Math.round((this.toDate(to).getTime() - this.toDate(from).getTime()) / 1000);
  }

  /** YYYY-MM-DD 문자열 검증 후 해당 날짜 시작 Date 반환 */
  parseDateOnly(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      throw new TypeError('date string must be YYYY-MM-DD');
    }
    const [y, m, d] = str.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) throw new TypeError('invalid date string');
    const guess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return this.startOfDay(guess);
  }

  /** 초를 "1분 23초" 형식으로 */
  formatDuration(seconds) {
    if (typeof seconds !== 'number' || seconds < 0 || Number.isNaN(seconds)) throw new TypeError('seconds must be >= 0');
    const s = Math.round(seconds);
    if (s < 60) return `${s}초`;
    const m = Math.floor(s / 60);
    const rest = s % 60;
    if (m < 60) return rest ? `${m}분 ${rest}초` : `${m}분`;
    const h = Math.floor(m / 60);
    return `${h}시간 ${m % 60}분`;
  }
}

module.exports = { TimeUtil, timeUtil: new TimeUtil() };
