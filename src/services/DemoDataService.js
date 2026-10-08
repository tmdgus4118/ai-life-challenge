const { ValidationError } = require('../utils/errors');
const { timeUtil } = require('../utils/time');

/**
 * 데모용 모의 데이터 생성기 (기본 35일치, 약 400건).
 * 최근으로 올수록 소음이 늘어나는 흐름이라 7·14·30일 리포트 수치가 서로 다르게 나온다.
 *  - 평일 밤 21:30~다음 날 01:30 발걸음 집중 (22~23시 정점), 평일 아침 6~7시 발걸음
 *  - 평일 저녁 19~21시 말소리·TV, 최근 3주 화·목 18~20시 피아노 연습
 *  - 최근 18일 평일 낮 10~16시 개 짖는 소리 (새로 이사 온 반려견)
 *  - 주말 오후 14~18시 가구 끄는 소리, 주말 오전·밤 발걸음
 *  - 3주 전 토요일 오전 10~12시 인테리어 공사(망치·드릴)
 *  - 가끔 새벽 2~4시 발걸음·말소리
 * 시드 난수를 써서 같은 시드·같은 기준 시각이면 같은 데이터를 만든다.
 */
class DemoDataService {
  constructor({ eventService, time = timeUtil }) {
    if (!eventService) throw new TypeError('eventService is required');
    this.eventService = eventService;
    this.time = time;
  }

  /** 결정적 난수 (mulberry32) */
  createRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 며칠 전인지(0=오늘)에 따른 소음 강도. 최근 주일수록 1에 가깝다 */
  intensity(daysAgo) {
    if (!Number.isInteger(daysAgo) || daysAgo < 0) throw new RangeError('daysAgo must be a non-negative integer');
    const week = Math.floor(daysAgo / 7);
    return [1, 0.78, 0.6, 0.45, 0.35][Math.min(week, 4)];
  }

  /** 사건 입력 목록을 만든다 (저장하지 않음) */
  buildEvents({ days = 35, seed = 20261002, now = new Date() } = {}) {
    if (!Number.isInteger(days) || days < 1 || days > 60) throw new ValidationError('days는 1~60 사이 정수여야 합니다.');
    const rand = this.createRandom(seed);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const between = (min, max) => min + rand() * (max - min);
    const count = (min, max, factor = 1) => Math.round((min + rand() * (max - min)) * factor);
    const events = [];
    const todayStart = this.time.startOfDay(now);
    const add = (dayStart, minute, duration, group, avg, max) => events.push(this.makeEvent(dayStart, Math.floor(minute), Math.max(3, Math.floor(duration)), group, avg, max, rand));

    for (let d = days - 1; d >= 0; d -= 1) {
      const dayStart = this.time.addDays(todayStart, -d);
      const weekday = this.time.getParts(dayStart).weekday; // 0=일
      const isWeekend = weekday === 0 || weekday === 6;
      const f = this.intensity(d);

      if (!isWeekend) {
        // 평일 밤 발걸음: 21:30~01:30, 22~23시에 몰리도록 두 구간에서 뽑는다
        const night = count(10, 14, f);
        for (let i = 0; i < night; i += 1) {
          const minute = rand() < 0.7 ? between(22 * 60, 23 * 60 + 59) : between(21 * 60 + 30, 25 * 60 + 30);
          const avg = between(35, 45);
          add(dayStart, minute, between(4, 45), 'footstep', avg, avg + between(8, 18));
        }
        // 아침 발걸음 6~7시
        for (let i = 0, n = count(1, 3, f); i < n; i += 1) {
          const avg = between(34, 42);
          add(dayStart, between(6 * 60, 7 * 60 + 40), between(3, 25), 'footstep', avg, avg + between(8, 14));
        }
        // 저녁 말소리·TV 19~21시
        for (let i = 0, n = count(1, 3); i < n; i += 1) {
          const avg = between(38, 47);
          add(dayStart, between(19 * 60, 21 * 60 + 30), between(20, 120), 'voice', avg, avg + between(4, 10));
        }
        // 최근 3주 화·목 피아노 연습 18~20시
        if (d < 21 && (weekday === 2 || weekday === 4)) {
          for (let i = 0, n = count(2, 4); i < n; i += 1) {
            const avg = between(41, 49);
            add(dayStart, between(18 * 60, 20 * 60), between(30, 180), 'music', avg, avg + between(5, 11));
          }
        }
        // 최근 18일 평일 낮 개 짖는 소리
        if (d < 18) {
          for (let i = 0, n = count(2, 5); i < n; i += 1) {
            const avg = between(40, 50);
            add(dayStart, between(10 * 60, 16 * 60 + 30), between(5, 50), 'pet', avg, avg + between(6, 14));
          }
        }
      } else {
        // 주말 오후 가구 끄는 소리 14~18시
        for (let i = 0, n = count(4, 7, f); i < n; i += 1) {
          const avg = between(36, 47);
          add(dayStart, between(14 * 60, 18 * 60), between(3, 18), 'furniture', avg, avg + between(10, 20));
        }
        // 주말 오전 10~12시, 밤 22~24시 발걸음
        for (let i = 0, n = count(3, 6, f); i < n; i += 1) {
          const minute = rand() < 0.5 ? between(10 * 60, 12 * 60) : between(22 * 60, 23 * 60 + 58);
          const avg = between(35, 44);
          add(dayStart, minute, between(4, 30), 'footstep', avg, avg + between(8, 16));
        }
        // 3주 전 토요일 오전 인테리어 공사
        if (weekday === 6 && d >= 14 && d < 21) {
          for (let i = 0, n = count(5, 8); i < n; i += 1) {
            const avg = between(48, 58);
            add(dayStart, between(10 * 60, 12 * 60), between(10, 90), 'hammer', avg, avg + between(8, 16));
          }
        }
        // 주말 낮 말소리
        for (let i = 0, n = count(1, 3); i < n; i += 1) {
          const avg = between(38, 46);
          add(dayStart, between(12 * 60, 20 * 60), between(20, 90), 'voice', avg, avg + between(4, 9));
        }
      }

      // 낮 시간 간헐적 가구·충격
      for (let i = 0, n = count(0, 2); i < n; i += 1) {
        const avg = between(37, 46);
        add(dayStart, between(9 * 60, 21 * 60), between(3, 12), 'furniture', avg, avg + between(10, 18));
      }
      // 가끔 새벽 2~4시
      if (rand() < 0.3 * f + 0.05) {
        const avg = between(33, 40);
        add(dayStart, between(2 * 60, 4 * 60), between(3, 15), pick(['footstep', 'footstep', 'voice']), avg, avg + between(6, 12));
      }
    }

    // 미래 시각 제거 후 시간순 정렬
    const nowMs = now.getTime();
    return events
      .filter((e) => new Date(e.ended_at).getTime() <= nowMs)
      .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  }

  /** 평균 근처에서 흔들리다 한 번 최고값을 찍는 1초 단위 dB 시퀀스 */
  makeSeries(durationSec, avgDb, maxDb, rand) {
    if (!(durationSec >= 1)) throw new RangeError('durationSec must be >= 1');
    const n = Math.min(600, Math.floor(durationSec));
    const peakAt = Math.floor(rand() * n);
    const series = [];
    for (let i = 0; i < n; i += 1) {
      const wobble = (rand() - 0.5) * 6;
      let v = avgDb + wobble;
      if (i === peakAt) v = maxDb;
      else if (Math.abs(i - peakAt) === 1) v = avgDb + (maxDb - avgDb) * 0.5;
      series.push(Math.round(Math.min(maxDb, Math.max(25, v)) * 10) / 10);
    }
    return series;
  }

  /**
   * 바닥 진동 데모: 충격음(발걸음·가구·망치)은 큰 소리 순간에 진동이 함께 잡히고, 말소리·음악은 거의 없다.
   * 기존 데모 난수 흐름을 바꾸지 않도록 사건 시각으로 만든 별도 난수를 쓴다.
   */
  makeVibration(series, group, seed) {
    if (!Array.isArray(series) || series.length === 0) throw new TypeError('series must be a non-empty array');
    const rand = this.createRandom(seed);
    const chance = { footstep: 0.75, furniture: 0.85, hammer: 0.9, pet: 0.15, music: 0.05, voice: 0 }[group] ?? 0;
    const peak = Math.max(...series);
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const hit = rand() < chance;
    // 가장 큰 순간은 거의 항상, 평균보다 큰 순간은 가끔 진동이 함께 잡힌다
    const vibration_series = series.map((v) => (hit && (v >= peak - 3 ? rand() < 0.9 : v >= mean && rand() < 0.35) ? 1 : 0));
    const vibration_sec = vibration_series.filter((v) => v === 1).length;
    const vibration_peak_mg = vibration_sec
      ? Math.round((6 + rand() * (group === 'hammer' ? 40 : 18)) * 10) / 10
      : Math.round((0.6 + rand() * 1.4) * 10) / 10;
    return { vibration_series, vibration_sec, vibration_peak_mg };
  }

  makeEvent(dayStart, minuteOfDay, durationSec, group, avgDb, maxDb, rand) {
    const started = new Date(dayStart.getTime() + minuteOfDay * 60000 + Math.floor(rand() * 59000));
    const ended = new Date(started.getTime() + durationSec * 1000);
    const memos = {
      footstep: ['아이가 깨어남', '', '', '', '', '잠들다 깸', '', ''],
      furniture: ['가구 끄는 소리', '', ''],
      pet: ['', '', '개 짖음 반복'],
      voice: ['', '', ''],
      music: ['피아노 연습 소리', '', ''],
      hammer: ['인테리어 공사 소리', ''],
    };
    const series = this.makeSeries(durationSec, avgDb, maxDb, rand);
    return {
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      source_group: group,
      avg_db: Math.round(avgDb * 10) / 10,
      max_db: Math.round(maxDb * 10) / 10,
      db_series: series,
      confidence: Math.round((0.45 + rand() * 0.5) * 100) / 100,
      memo: (memos[group] || [''])[Math.floor(rand() * (memos[group] || ['']).length)],
      excluded: false,
      client_id: 'demo',
      ...this.makeVibration(series, group, Math.floor(started.getTime() / 1000)),
    };
  }

  /** 사용자에게 데모 데이터를 넣는다. 기존 데모 데이터는 먼저 지운다. */
  async seed(userId, options = {}) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    await this.eventService.eventModel.deleteWhere((e) => e.user_id === userId && e.client_id === 'demo');
    const inputs = this.buildEvents(options);
    const rows = await this.eventService.createMany(userId, inputs);
    return { inserted: rows.length, exceeded: rows.filter((r) => r.exceeded).length };
  }
}

module.exports = { DemoDataService };
