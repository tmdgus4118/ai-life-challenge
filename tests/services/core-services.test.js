const { createModels } = require('../../src/models');
const { SettingsService } = require('../../src/services/SettingsService');
const { ThresholdService } = require('../../src/services/ThresholdService');
const { EventService } = require('../../src/services/EventService');
const { DataService } = require('../../src/services/DataService');
const { DemoDataService } = require('../../src/services/DemoDataService');
const { EventInputDto } = require('../../src/dtos');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');
const { makeTempDbDir, removeDir, USER_A, USER_B, sampleEventInput } = require('../helpers');

describe('core services', () => {
  let dir; let m; let settingsService; let thresholdService; let eventService; let dataService; let demoService;
  beforeEach(() => {
    dir = makeTempDbDir();
    m = createModels(dir);
    settingsService = new SettingsService(m.settingsModel);
    thresholdService = new ThresholdService(m.thresholdModel);
    eventService = new EventService({ eventModel: m.eventModel, thresholdService, settingsService });
    dataService = new DataService(m);
    demoService = new DemoDataService({ eventService });
  });
  afterEach(() => removeDir(dir));

  describe('SettingsService', () => {
    test('실패: 모델 누락', () => { expect(() => new SettingsService()).toThrow(TypeError); });
    test('get: 기본값 / 실패: userId 없음', async () => {
      expect((await settingsService.get(USER_A)).db_offset).toBe(90);
      await expect(settingsService.get()).rejects.toThrow(ValidationError);
    });
    test('update: 성공, 모르는 키 무시, 범위 밖 실패, 시작==종료 실패', async () => {
      const s = await settingsService.update(USER_A, { night_start: 23, unknown: 1 });
      expect(s.night_start).toBe(23);
      await expect(settingsService.update(USER_A, { night_start: 30 })).rejects.toThrow(ValidationError);
      await expect(settingsService.update(USER_A, { unknown: 1 })).rejects.toThrow(ValidationError);
      await expect(settingsService.update(USER_A, { night_end: 23 })).rejects.toThrow(ValidationError);
      await expect(settingsService.update(USER_A, {})).rejects.toThrow(ValidationError);
    });
    test('calibrate: -62dBFS → 오프셋 92 / 실패: 양수 dBFS', async () => {
      const s = await settingsService.calibrate(USER_A, -62);
      expect(s.db_offset).toBe(92);
      await expect(settingsService.calibrate(USER_A, 5)).rejects.toThrow(ValidationError);
      await expect(settingsService.calibrate(USER_A, 'x')).rejects.toThrow(ValidationError);
    });
    test('update: 역할·테마 선택지 / 실패: 허용되지 않은 값', async () => {
      const r = await settingsService.update(USER_A, { role: 'maker', theme: 'dark' });
      expect(r.role).toBe('maker');
      expect(r.theme).toBe('dark');
      await expect(settingsService.update(USER_A, { role: 'judge' })).rejects.toThrow(ValidationError);
      await expect(settingsService.update(USER_A, { theme: 'neon' })).rejects.toThrow(ValidationError);
    });
    test('update: 오래된 단지 설정(불리언) / 실패: 불리언 아님', async () => {
      expect((await settingsService.get(USER_A)).legacy_building).toBe(false);
      expect((await settingsService.update(USER_A, { legacy_building: true })).legacy_building).toBe(true);
      await expect(settingsService.update(USER_A, { legacy_building: 'yes' })).rejects.toThrow(ValidationError);
    });
    test('calibrate: 범위 클램프', async () => {
      expect((await settingsService.calibrate(USER_A, -119)).db_offset).toBe(140);
    });
  });

  describe('ThresholdService', () => {
    test('실패: 모델 누락', () => { expect(() => new ThresholdService()).toThrow(TypeError); });
    test('evaluate: KST 22:10 발걸음 41dB → 야간 초과', async () => {
      const r = await thresholdService.evaluate(sampleEventInput(), { night_start: 22, night_end: 6 });
      expect(r.is_night).toBe(true);
      expect(r.exceeded).toBe(true);
    });
    test('evaluate: 사용자 야간 23시 설정이면 22:10은 주간 → 41dB 초과(39)', async () => {
      const r = await thresholdService.evaluate(sampleEventInput({ max_db: 50 }), { night_start: 23, night_end: 6 });
      expect(r.is_night).toBe(false);
      expect(r.exceeded_rule).toContain('주간');
    });
    test('getMaxLimit: 야간 발걸음 52, 공기전달 null / 실패: 인자 누락', async () => {
      expect(await thresholdService.getMaxLimit(sampleEventInput(), { night_start: 22, night_end: 6 })).toBe(52);
      expect(await thresholdService.getMaxLimit(sampleEventInput({ source_group: 'pet' }), { night_start: 22, night_end: 6 })).toBeNull();
      await expect(thresholdService.getMaxLimit({}, {})).rejects.toThrow(TypeError);
      await expect(thresholdService.getMaxLimit(sampleEventInput(), null)).rejects.toThrow(TypeError);
    });
    test('evaluate 실패: 인자 누락', async () => {
      await expect(thresholdService.evaluate({}, {})).rejects.toThrow(TypeError);
      await expect(thresholdService.evaluate(sampleEventInput(), null)).rejects.toThrow(TypeError);
    });
    test('getCurrentLimit: 시각에 따라 기준선이 달라진다', async () => {
      const s = { night_start: 22, night_end: 6 };
      expect((await thresholdService.getCurrentLimit('footstep', s, new Date('2026-09-28T13:10:00Z'))).limit).toBe(34);
      expect((await thresholdService.getCurrentLimit('footstep', s, new Date('2026-09-28T03:10:00Z'))).limit).toBe(39);
      expect((await thresholdService.getCurrentLimit(null, s, new Date('2026-09-28T03:10:00Z'))).limit).toBe(39);
    });
  });

  describe('EventService', () => {
    test('실패: 의존성 누락', () => { expect(() => new EventService({})).toThrow(TypeError); });
    test('createMany: 판정 결과를 채워 저장', async () => {
      const rows = await eventService.createMany(USER_A, [EventInputDto.from(sampleEventInput()), EventInputDto.from(sampleEventInput({ source_group: 'other', avg_db: 30 }))]);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ user_id: USER_A, is_night: true, exceeded: true, duration_sec: 12, avg_db: 41.2 });
      expect(rows[1].exceeded).toBe(false);
    });
    test('createMany: 최고소음도만 넘는 사건은 1시간 안 3번째부터 초과', async () => {
      const at = (min) => ({ started_at: new Date(Date.parse('2026-09-28T13:00:00Z') + min * 60000).toISOString(), ended_at: new Date(Date.parse('2026-09-28T13:00:05Z') + min * 60000).toISOString() });
      const loudPeak = (min) => sampleEventInput({ ...at(min), avg_db: 30, max_db: 58 });
      const first = await eventService.createMany(USER_A, [loudPeak(0), loudPeak(10)]);
      expect(first.map((e) => e.exceeded)).toEqual([false, false]);
      const [third] = await eventService.createMany(USER_A, [loudPeak(20)]); // 앞서 저장된 2건과 합쳐 3회
      expect(third.exceeded).toBe(true);
      expect(third.exceeded_rule).toContain('1시간 3회');
      const [later] = await eventService.createMany(USER_A, [loudPeak(90)]); // 1시간 밖
      expect(later.exceeded).toBe(false);
    });
    test('createMany: 오래된 단지 설정이면 같은 사건도 기준 이내', async () => {
      await settingsService.update(USER_A, { legacy_building: true });
      const [row] = await eventService.createMany(USER_A, [sampleEventInput({ avg_db: 35.5, max_db: 40 })]);
      expect(row.exceeded).toBe(false);
    });
    test('countMaxExceedInHour: 빈 입력은 빈 맵 / 실패: 배열 아님', async () => {
      expect((await eventService.countMaxExceedInHour(USER_A, [], {})).size).toBe(0);
      await expect(eventService.countMaxExceedInHour(USER_A, null, {})).rejects.toThrow(TypeError);
    });
    test('createMany: db_series 저장(없으면 null)', async () => {
      const [a, b] = await eventService.createMany(USER_A, [sampleEventInput({ db_series: [40.12, null, 45] }), sampleEventInput()]);
      expect(a.db_series).toEqual([40.12, null, 45]);
      expect(b.db_series).toBeNull();
    });
    test('createMany: 바닥 진동 저장, 재지 않은 사건은 null / decorate는 진동 동반 표시', async () => {
      const [a, b] = await eventService.createMany(USER_A, [sampleEventInput({ vibration_sec: 3, vibration_peak_mg: 21.26, vibration_series: [1, 1, 0, 1] }), sampleEventInput()]);
      expect(a).toMatchObject({ vibration_sec: 3, vibration_peak_mg: 21.3, vibration_series: [1, 1, 0, 1] });
      expect(b).toMatchObject({ vibration_sec: null, vibration_peak_mg: null, vibration_series: null });
      expect(eventService.decorate(a).has_vibration).toBe(true);
      expect(eventService.decorate(b).has_vibration).toBe(false);
      expect(eventService.decorate({ ...a, vibration_sec: 0 }).has_vibration).toBe(false);
      const csv = await eventService.exportCsv(USER_A);
      expect(csv).toContain(',바닥진동(초),');
      expect(csv).toContain(',미측정,');
    });
    test('exportCsv: BOM + 헤더 + 행, 쉼표·따옴표 이스케이프', async () => {
      await eventService.createMany(USER_A, [sampleEventInput({ memo: '아이, "깸"' })]);
      const csv = await eventService.exportCsv(USER_A);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      const lines = csv.trim().split('\n');
      expect(lines[0]).toContain('시작일시,종료일시');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('발걸음,41.2,58.3,야간,Y');
      expect(lines[0]).toContain(',출처');
      expect(lines[1]).toContain(',감지 기록');
      expect(lines[1]).toContain('"아이, ""깸""' + '"');
      expect((await eventService.exportCsv(USER_A, { source: 'pet' })).trim().split('\n')).toHaveLength(1);
    });
    test('decorate: 요일 인덱스(월=0)와 시각', () => {
      const d = eventService.decorate({ source_group: 'footstep', started_at: '2026-09-28T13:10:00Z', ended_at: '2026-09-28T13:10:12Z' });
      expect(d.weekday_index).toBe(0);
      expect(d.hour).toBe(22);
    });
    test('createMany 실패: 빈 배열, userId 없음', async () => {
      await expect(eventService.createMany(USER_A, [])).rejects.toThrow(ValidationError);
      await expect(eventService.createMany(null, [sampleEventInput()])).rejects.toThrow(ValidationError);
    });
    test('list / getRecent', async () => {
      await eventService.createMany(USER_A, [sampleEventInput(), sampleEventInput({ started_at: '2026-09-29T13:00:00Z', ended_at: '2026-09-29T13:00:05Z', source_group: 'pet' })]);
      expect(await eventService.list(USER_A)).toHaveLength(2);
      expect(await eventService.list(USER_A, { source: 'pet' })).toHaveLength(1);
      expect(await eventService.list(USER_A, { limit: 1 })).toHaveLength(1);
      expect((await eventService.getRecent(USER_A, 3))[0].source_group).toBe('pet');
      await expect(eventService.list()).rejects.toThrow(ValidationError);
    });
    test('remove: 본인 사건만 삭제, 없으면 NotFound', async () => {
      const [row] = await eventService.createMany(USER_A, [sampleEventInput()]);
      await expect(eventService.remove(USER_B, row.id)).rejects.toThrow(NotFoundError);
      expect((await eventService.remove(USER_A, row.id)).id).toBe(row.id);
      await expect(eventService.remove(USER_A, row.id)).rejects.toThrow(NotFoundError);
      await expect(eventService.remove(USER_A)).rejects.toThrow(ValidationError);
    });
    test('updateMemo 성공/실패', async () => {
      const [row] = await eventService.createMany(USER_A, [sampleEventInput()]);
      expect((await eventService.updateMemo(USER_A, row.id, ' 아이가 깨어남 ')).memo).toBe('아이가 깨어남');
      await expect(eventService.updateMemo(USER_A, row.id, 5)).rejects.toThrow(ValidationError);
      await expect(eventService.updateMemo(USER_A, 'missing', 'x')).rejects.toThrow(NotFoundError);
    });
    test('getWeekView: 히트맵·날짜 묶음·주 이동', async () => {
      await eventService.createMany(USER_A, [
        sampleEventInput(), // 2026-09-28(월) KST 22:10
        sampleEventInput({ started_at: '2026-09-28T13:20:00Z', ended_at: '2026-09-28T13:20:05Z' }),
        sampleEventInput({ started_at: '2026-10-04T05:00:00Z', ended_at: '2026-10-04T05:00:05Z' }), // 10-04(일) 14시
        sampleEventInput({ started_at: '2026-10-05T05:00:00Z', ended_at: '2026-10-05T05:00:05Z' }), // 다음 주
      ]);
      const view = await eventService.getWeekView(USER_A, { weekStart: '2026-09-30' });
      expect(view.week_start).toBe('2026-09-28');
      expect(view.week_end).toBe('2026-10-04');
      expect(view.prev_week).toBe('2026-09-21');
      expect(view.next_week).toBe('2026-10-05');
      expect(view.total).toBe(3);
      expect(view.heatmap[0][22]).toBe(2);
      expect(view.heatmap[6][14]).toBe(1);
      expect(view.heatmap_max).toBe(2);
      expect(view.by_date).toHaveLength(2);
      expect(view.by_date[0].date).toBe('2026-10-04');
      expect(view.events[0].started_at > view.events[1].started_at).toBe(true);
      const filtered = await eventService.getWeekView(USER_A, { weekStart: '2026-09-28', source: 'pet' });
      expect(filtered.total).toBe(0);
    });
    test('getWeekView 실패: 잘못된 날짜, userId 없음', async () => {
      await expect(eventService.getWeekView(USER_A, { weekStart: '2026/09/28' })).rejects.toThrow(TypeError);
      await expect(eventService.getWeekView()).rejects.toThrow(ValidationError);
    });
    test('buildHeatmap/groupByDate/decorate 실패 케이스', () => {
      expect(() => eventService.buildHeatmap('x')).toThrow(TypeError);
      expect(() => eventService.groupByDate(null)).toThrow(TypeError);
      expect(() => eventService.decorate(null)).toThrow(TypeError);
      const d = eventService.decorate({ source_group: 'footstep', started_at: '2026-09-28T13:10:00Z', ended_at: '2026-09-28T13:10:12Z' });
      expect(d.source_label).toBe('발걸음');
      expect(d.time_label).toBe('22:10');
      expect(d.duration_label).toBe('12초');
    });
  });

  describe('DataService', () => {
    test('실패: 모델 누락', () => { expect(() => new DataService({})).toThrow(TypeError); });
    test('deleteAll: 사용자 데이터만 모두 삭제', async () => {
      await eventService.createMany(USER_A, [sampleEventInput()]);
      await eventService.createMany(USER_B, [sampleEventInput()]);
      await m.reportModel.insert({ user_id: USER_A });
      await m.messageModel.insert({ user_id: USER_A });
      await settingsService.update(USER_A, { night_start: 21 });
      const r = await dataService.deleteAll(USER_A);
      expect(r).toEqual({ events: 1, reports: 1, messages: 1, settings: 1, lab_runs: 0, shares: 0 });
      expect(await eventService.list(USER_B)).toHaveLength(1);
      await expect(dataService.deleteAll()).rejects.toThrow(ValidationError);
    });
    test('getStoredItemsDescription: 5개 항목', () => {
      expect(dataService.getStoredItemsDescription()).toHaveLength(5);
    });
  });

  describe('DemoDataService', () => {
    test('실패: 의존성 누락', () => { expect(() => new DemoDataService({})).toThrow(TypeError); });
    test('buildEvents: 기본 35일치, 30일 이전까지 데이터가 있고 결정적이다', () => {
      const now = new Date('2026-10-02T12:00:00Z');
      const a = demoService.buildEvents({ now });
      expect(a).toEqual(demoService.buildEvents({ now }));
      expect(a.length).toBeGreaterThan(300);
      expect(new Date(a[0].started_at) < new Date('2026-09-02T00:00:00Z')).toBe(true);
      expect(a.every((e) => new Date(e.ended_at) <= now)).toBe(true);
    });
    test('buildEvents: 7·14·30일 건수와 소음원 구성이 서로 다르다 (최근일수록 증가)', () => {
      const now = new Date('2026-10-02T12:00:00Z');
      const a = demoService.buildEvents({ now });
      const within = (days) => a.filter((e) => new Date(e.started_at) >= new Date(now - days * 86400000));
      const [w7, w14, w30] = [within(7), within(14), within(30)];
      expect(w7.length).toBeGreaterThanOrEqual(100);
      expect(w7.length).toBeLessThanOrEqual(170);
      expect(w14.length).toBeGreaterThan(w7.length + 60);
      expect(w30.length).toBeGreaterThan(w14.length + 80);
      expect(w7.length / 7).toBeGreaterThan((w30.length - w14.length) / 16); // 최근 하루 평균이 과거보다 많다
      expect(w7.some((e) => e.source_group === 'hammer')).toBe(false);
      expect(w30.some((e) => e.source_group === 'hammer')).toBe(true); // 3주 전 공사
      const share = (list, g) => list.filter((e) => e.source_group === g).length / list.length;
      expect(share(w7, 'pet')).not.toBeCloseTo(share(w30, 'pet'), 2);
    });
    test('buildEvents: 시간대가 넓게 퍼져 있다 (새벽·아침·낮·저녁·밤·자정 이후)', () => {
      const a = demoService.buildEvents({ now: new Date('2026-10-02T12:00:00Z') });
      const hours = new Set(a.map((e) => Number(new Date(e.started_at).toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }))));
      [0, 1, 6, 10, 14, 18, 19, 22, 23].forEach((h) => expect(hours.has(h)).toBe(true));
      expect(hours.size).toBeGreaterThanOrEqual(18);
      const kst22 = a.filter((e) => new Date(e.started_at).toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }) === '22');
      const kst15 = a.filter((e) => new Date(e.started_at).toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }) === '15');
      expect(kst22.length).toBeGreaterThan(kst15.length * 2);
    });
    test('makeSeries: 길이·최고값·범위 / 실패: 0초', () => {
      const rand = demoService.createRandom(3);
      const series = demoService.makeSeries(20, 40, 55, rand);
      expect(series).toHaveLength(20);
      expect(Math.max(...series)).toBe(55);
      expect(series.every((v) => v >= 25 && v <= 55)).toBe(true);
      expect(demoService.makeSeries(900, 40, 55, rand)).toHaveLength(600);
      expect(() => demoService.makeSeries(0, 40, 55, rand)).toThrow(RangeError);
      const [ev] = demoService.buildEvents({ now: new Date('2026-10-02T12:00:00Z') });
      expect(Array.isArray(ev.db_series)).toBe(true);
    });
    test('makeVibration: 충격음은 대부분 진동 동반, 말소리는 없음, 길이는 dB와 같음 / 실패: 빈 배열', () => {
      const evs = demoService.buildEvents({ now: new Date('2026-10-02T12:00:00Z') });
      evs.forEach((e) => {
        expect(e.vibration_series).toHaveLength(e.db_series.length);
        expect(e.vibration_sec).toBe(e.vibration_series.filter((v) => v === 1).length);
      });
      const share = (g) => { const l = evs.filter((e) => e.source_group === g); return l.filter((e) => e.vibration_sec > 0).length / Math.max(1, l.length); };
      expect(share('footstep')).toBeGreaterThan(0.5);
      expect(share('voice')).toBe(0);
      const same = demoService.makeVibration([40, 50, 45], 'hammer', 7);
      expect(demoService.makeVibration([40, 50, 45], 'hammer', 7)).toEqual(same);
      expect(() => demoService.makeVibration([], 'footstep', 1)).toThrow(TypeError);
    });
    test('intensity: 최근 주 1, 과거로 갈수록 감소 / 실패: 음수', () => {
      expect(demoService.intensity(0)).toBe(1);
      expect(demoService.intensity(8)).toBeLessThan(1);
      expect(demoService.intensity(40)).toBe(0.35);
      expect(() => demoService.intensity(-1)).toThrow(RangeError);
    });
    test('buildEvents 실패: days 범위', () => {
      expect(() => demoService.buildEvents({ days: 0 })).toThrow(ValidationError);
      expect(() => demoService.buildEvents({ days: 1.5 })).toThrow(ValidationError);
    });
    test('createRandom: 같은 시드 같은 수열', () => {
      const r1 = demoService.createRandom(1); const r2 = demoService.createRandom(1);
      expect(r1()).toBe(r2());
    });
    test('seed: 저장 후 재실행 시 중복 없이 교체', async () => {
      const first = await demoService.seed(USER_A, { now: new Date('2026-10-02T12:00:00Z') });
      expect(first.inserted).toBeGreaterThan(50);
      expect(first.exceeded).toBeGreaterThan(0);
      const second = await demoService.seed(USER_A, { now: new Date('2026-10-02T12:00:00Z') });
      expect(await m.eventModel.count()).toBe(second.inserted);
      await expect(demoService.seed()).rejects.toThrow(ValidationError);
    });
  });
});
