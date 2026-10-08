const { createModels } = require('../../src/models');
const { createServices } = require('../../src/services');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');
const { makeTempDbDir, removeDir, USER_A, USER_B, sampleEventInput } = require('../helpers');

const config = { llmProvider: 'template', llmModel: 'template' };
const NOW = new Date('2026-10-02T12:00:00Z');

describe('ReportService / MessageService / StepGuideService', () => {
  let dir; let m; let s;
  beforeEach(async () => {
    dir = makeTempDbDir();
    m = createModels(dir);
    s = createServices(m, config);
    await s.eventService.createMany(USER_A, [
      sampleEventInput(),
      sampleEventInput({ started_at: '2026-09-29T13:30:00Z', ended_at: '2026-09-29T13:30:20Z', memo: '아이가 깨어남' }),
      sampleEventInput({ started_at: '2026-09-20T13:30:00Z', ended_at: '2026-09-20T13:30:20Z' }), // 7일 밖
    ]);
  });
  afterEach(() => removeDir(dir));

  describe('ReportService', () => {
    test('실패: 의존성 누락', () => {
      const { ReportService } = require('../../src/services/ReportService');
      expect(() => new ReportService({})).toThrow(TypeError);
    });
    test('resolvePeriod: 7일은 오늘 포함 7일 / 실패: 10일', () => {
      const p = s.reportService.resolvePeriod(7, NOW);
      expect(p.from.toISOString()).toBe('2026-09-25T15:00:00.000Z'); // 9/26 00:00 KST
      expect(() => s.reportService.resolvePeriod(10, NOW)).toThrow(ValidationError);
    });
    test('getSummary: 기간 안 사건만 집계, 14일이면 포함', async () => {
      expect((await s.reportService.getSummary(USER_A, 7, NOW)).total_events).toBe(2);
      expect((await s.reportService.getSummary(USER_A, 14, NOW)).total_events).toBe(3);
      await expect(s.reportService.getSummary(null, 7)).rejects.toThrow(ValidationError);
    });
    test('generate: 집계+요약문 저장, getLatest/getByIdForUser', async () => {
      const report = await s.reportService.generate(USER_A, 7, NOW);
      expect(report.ai_text).toContain('2건');
      expect(report.summary_json.total_events).toBe(2);
      expect(report.provider).toBe('template');
      expect((await s.reportService.getLatest(USER_A, 7)).id).toBe(report.id);
      expect((await s.reportService.getByIdForUser(report.id, USER_A)).id).toBe(report.id);
      await expect(s.reportService.getByIdForUser(report.id, USER_B)).rejects.toThrow(NotFoundError);
      await expect(s.reportService.getByIdForUser(null, USER_A)).rejects.toThrow(ValidationError);
      await expect(s.reportService.getLatest()).rejects.toThrow(ValidationError);
    });
    test('generate 20회 반복해도 입력에 없는 숫자·감정 표현 0건', async () => {
      const { SafetyChecker } = require('../../src/services/SafetyChecker');
      const checker = new SafetyChecker();
      for (let i = 0; i < 20; i += 1) {
        const report = await s.reportService.generate(USER_A, 7, NOW);
        const allowed = s.aiWriter.buildAllowedNumbers(report.summary_json, await s.settingsService.get(USER_A), await s.thresholdService.getAll());
        expect(checker.validateReport(report.ai_text, allowed).ok).toBe(true);
      }
    });
    test('getSummary.comparison: 직전 기간 절반 이상 기록한 날이 있으면 증감 비교', async () => {
      // 직전 7일(9/19~9/25 KST): 9/20 기존 + 9/21·22·23 추가 = 4일 기록
      const prev = ['2026-09-18T13:00:00Z', '2026-09-21T13:00:00Z', '2026-09-22T13:00:00Z', '2026-09-23T13:00:00Z'].map((t) => sampleEventInput({ started_at: t, ended_at: t.replace(':00:00Z', ':00:10Z') }));
      await s.eventService.createMany(USER_A, prev);
      const cmp = (await s.reportService.getSummary(USER_A, 7, NOW)).comparison;
      expect(cmp.has_previous).toBe(true);
      expect(cmp.total).toEqual({ previous: 4, delta: -2, percent: -50 }); // 9/18 22시 KST 사건은 비교 기간(9/19~) 밖
      expect(cmp.previous_top_source).toBe('발걸음');
    });
    test('getSummary.comparison: 직전 기간 기록한 날이 절반 미만이면 비교하지 않음(sparse)', async () => {
      const cmp = (await s.reportService.getSummary(USER_A, 7, NOW)).comparison;
      expect(cmp).toMatchObject({ has_previous: false, reason: 'sparse', recorded_days: 1, previous_label: '9월 19일 (토) ~ 9월 25일 (금)' });
      const far = (await s.reportService.getSummary(USER_A, 7, new Date('2026-12-01T00:00:00Z'))).comparison;
      expect(far.has_previous).toBe(false);
      expect(far.reason).toBe('none');
      expect(far.previous_from).toBe('2026-11-18');
    });
    test('isFresh / buildView: 기간·숫자가 바뀐 옛 요약문은 보여 주지 않는다', async () => {
      const report = await s.reportService.generate(USER_A, 7, NOW);
      const summary = await s.reportService.getSummary(USER_A, 7, NOW);
      expect(s.reportService.isFresh(report, summary)).toBe(true);
      expect(s.reportService.isFresh(report, { ...summary, total_events: 99 })).toBe(false);
      expect(s.reportService.isFresh(report, { ...summary, period: { ...summary.period, from: '2026-01-01' } })).toBe(false);
      expect(s.reportService.isFresh(null, summary)).toBe(false);
      await s.eventService.createMany(USER_A, [sampleEventInput({ started_at: '2026-10-01T13:00:00Z', ended_at: '2026-10-01T13:00:09Z' })]);
      const view = await s.reportService.buildView(USER_A, 7, NOW);
      expect(view.report).toBeNull();
      expect(view.stale_report).toBe(true);
    });
    test('getSummary: 데모 기록 건수(demo_events)', async () => {
      await s.eventService.createMany(USER_A, [{ ...sampleEventInput({ started_at: '2026-10-01T13:00:00Z', ended_at: '2026-10-01T13:00:09Z' }), client_id: 'demo' }]);
      expect((await s.reportService.getSummary(USER_A, 7, NOW)).demo_events).toBe(1);
    });
    test('headline: 패턴·증감 문장, 사건 없음 / 실패', () => {
      const base = { total_events: 5, top_hour: { label: '22~23시' }, top_source: { label: '발걸음' } };
      expect(s.reportService.headline({ ...base, comparison: { has_previous: true, total: { delta: 3 } } }, 7)).toEqual({ pattern: '22~23시에 가장 많이 기록되었고, 주된 소음원은 발걸음입니다.', delta: '직전 7일보다 3건 늘었습니다.' });
      expect(s.reportService.headline({ ...base, comparison: { has_previous: true, total: { delta: -2 } } }, 14).delta).toBe('직전 14일보다 2건 줄었습니다.');
      expect(s.reportService.headline({ ...base, comparison: { has_previous: true, total: { delta: 0 } } }, 7).delta).toBe('직전 7일과 같은 수준입니다.');
      expect(s.reportService.headline({ ...base, comparison: { has_previous: false } }, 7).delta).toBeNull();
      expect(s.reportService.headline({ total_events: 0 }, 30).pattern).toBe('최근 30일 동안 기록된 사건이 없습니다.');
      expect(() => s.reportService.headline(null, 7)).toThrow(TypeError);
    });
    test('compare: 실패 케이스', () => {
      expect(() => s.reportService.compare(null, [], {})).toThrow(TypeError);
    });
    test('buildView: 리포트 없으면 report null', async () => {
      const view = await s.reportService.buildView(USER_A, 7, NOW);
      expect(view.report).toBeNull();
      expect(view.summary.total_events).toBe(2);
      expect(view.periods).toEqual([7, 14, 30]);
      await s.reportService.generate(USER_A, 7, NOW);
      expect((await s.reportService.buildView(USER_A, 7, NOW)).report).not.toBeNull();
    });
  });

  describe('MessageService', () => {
    test('실패: 의존성 누락', () => {
      const { MessageService } = require('../../src/services/MessageService');
      expect(() => new MessageService({})).toThrow(TypeError);
    });
    test('generate: 저장 + 다음 단계 안내', async () => {
      const r = await s.messageService.generate(USER_A, { recipient: 'neighbor', tone: 'soft', days: 7 });
      expect(r.message.body.length).toBeLessThanOrEqual(300);
      expect(r.message.recipient_type).toBe('neighbor');
      expect(r.next_step.current_step).toBe(1);
      expect(r.next_step.center.phone).toBe('1661-2642');
    });
    test('generate: report_id로 저장된 집계 사용 / 남의 리포트는 NotFound', async () => {
      const report = await s.reportService.generate(USER_A, 7, NOW);
      const r = await s.messageService.generate(USER_A, { recipient: 'center', tone: 'firm', report_id: report.id });
      expect(r.message.report_id).toBe(report.id);
      await expect(s.messageService.generate(USER_B, { recipient: 'center', tone: 'firm', report_id: report.id })).rejects.toThrow(NotFoundError);
    });
    test('generate 실패: 수신자/말투/사용자 오류', async () => {
      await expect(s.messageService.generate(USER_A, { recipient: 'x' })).rejects.toThrow(ValidationError);
      await expect(s.messageService.generate(USER_A, { recipient: 'neighbor', tone: 'x' })).rejects.toThrow(ValidationError);
      await expect(s.messageService.generate(null, { recipient: 'neighbor' })).rejects.toThrow(ValidationError);
    });
    test('markDelivered: 전달 표시·해제, 단계 안내 갱신 / 실패: 남의 메시지, 식별자 없음', async () => {
      const { message } = await s.messageService.generate(USER_A, { recipient: 'neighbor', tone: 'basic' });
      const r = await s.messageService.markDelivered(USER_A, message.id, { now: new Date('2026-09-10T12:00:00Z') });
      expect(r.message.delivered_at).toBe('2026-09-10T12:00:00.000Z');
      expect((await s.stepGuideService.getGuide(USER_A, NOW)).current_step).toBe(2);
      const undone = await s.messageService.markDelivered(USER_A, message.id, { delivered: false });
      expect(undone.message.delivered_at).toBeNull();
      await expect(s.messageService.markDelivered(USER_B, message.id)).rejects.toThrow(NotFoundError);
      await expect(s.messageService.markDelivered(USER_A, null)).rejects.toThrow(ValidationError);
    });
    test('getHistory / decorate: 최신순, 라벨 포함 / 실패', async () => {
      await s.messageService.generate(USER_A, { recipient: 'neighbor', tone: 'soft' });
      await s.messageService.generate(USER_A, { recipient: 'management', tone: 'firm' });
      const h = await s.messageService.getHistory(USER_A);
      expect(h[0]).toMatchObject({ recipient_label: '관리사무소', tone_label: '단호하게' });
      expect(h[0].created_label).toBeTruthy();
      expect(await s.messageService.getHistory(USER_A, 1)).toHaveLength(1);
      await expect(s.messageService.getHistory()).rejects.toThrow(ValidationError);
      expect(() => s.messageService.decorate(null)).toThrow(TypeError);
    });
    test('소음을 내는 쪽(maker) 모드: 센터 수신자 숨김·생성 거부, 메시지에 role 저장', async () => {
      await s.settingsService.update(USER_A, { role: 'maker' });
      const view = await s.messageService.buildView(USER_A, {});
      expect(view.role).toBe('maker');
      expect(view.recipients.map((r) => r.key)).toEqual(['neighbor', 'management']);
      await expect(s.messageService.generate(USER_A, { recipient: 'center' })).rejects.toThrow(ValidationError);
      const { message } = await s.messageService.generate(USER_A, { recipient: 'neighbor', tone: 'soft' });
      expect(message.role).toBe('maker');
    });
    test('getLatest / buildView', async () => {
      await s.messageService.generate(USER_A, { recipient: 'neighbor', tone: 'soft' });
      await s.messageService.generate(USER_A, { recipient: 'neighbor', tone: 'firm' });
      expect((await s.messageService.getLatest(USER_A, 'neighbor', 'soft')).tone).toBe('soft');
      expect(await s.messageService.getLatest(USER_A, 'center')).toBeNull();
      const view = await s.messageService.buildView(USER_A, { recipient: 'neighbor', tone: 'firm' });
      expect(view.message.tone).toBe('firm');
      expect(view.recipients).toHaveLength(3);
      await expect(s.messageService.getLatest()).rejects.toThrow(ValidationError);
    });
  });

  describe('StepGuideService', () => {
    test('실패: 의존성 누락', () => {
      const { StepGuideService } = require('../../src/services/StepGuideService');
      expect(() => new StepGuideService({})).toThrow(TypeError);
    });
    test('메시지 없음 → 1단계', async () => {
      const g = await s.stepGuideService.getGuide(USER_A, NOW);
      expect(g.current_step).toBe(1);
      expect(g.steps.map((x) => x.status)).toEqual(['current', 'upcoming', 'upcoming']);
      await expect(s.stepGuideService.getGuide()).rejects.toThrow(ValidationError);
    });
    test('생성만 하고 전달 표시가 없으면 1단계 + 전달했음 안내', async () => {
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'neighbor', created_at: '2026-09-10T12:00:00Z' });
      const g = await s.stepGuideService.getGuide(USER_A, NOW);
      expect(g.current_step).toBe(1);
      expect(g.note).toContain('전달했음');
      expect(g.steps[0].delivered).toBe(false);
    });
    test('이웃 메시지 5일 전 전달 → 1단계 대기(9일 남음)', async () => {
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'neighbor', created_at: '2026-09-20T12:00:00Z', delivered_at: '2026-09-27T12:00:00Z' });
      const g = await s.stepGuideService.getGuide(USER_A, NOW);
      expect(g.current_step).toBe(1);
      expect(g.days_until_next).toBe(9);
    });
    test('이웃 메시지 전달 2주 지남 + 이후 초과 사건 → 2단계', async () => {
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'neighbor', created_at: '2026-09-10T12:00:00Z', delivered_at: '2026-09-10T12:00:00Z' });
      const g = await s.stepGuideService.getGuide(USER_A, NOW);
      expect(g.current_step).toBe(2);
      expect(g.steps[0].status).toBe('done');
      expect(g.steps[0].delivered_at).toBe('2026-09-10T12:00:00Z');
    });
    test('관리사무소 민원 2주 지남 + 이후 초과 → 3단계, 센터 메시지까지 있으면 안내문 변경', async () => {
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'neighbor', created_at: '2026-08-10T12:00:00Z', delivered_at: '2026-08-10T12:00:00Z' });
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'management', created_at: '2026-09-10T12:00:00Z', delivered_at: '2026-09-10T12:00:00Z' });
      let g = await s.stepGuideService.getGuide(USER_A, NOW);
      expect(g.current_step).toBe(3);
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'center', created_at: '2026-10-01T12:00:00Z', delivered_at: '2026-10-01T12:00:00Z' });
      g = await s.stepGuideService.getGuide(USER_A, NOW);
      expect(g.note).toContain('상담을 신청한 단계');
    });
    test('scope_note: 최근 14일 주된 소음원이 반려동물이면 센터 대상 밖 안내, 발걸음이면 없음', async () => {
      expect((await s.stepGuideService.getGuide(USER_A, NOW)).scope_note).toBeNull();
      const pets = Array.from({ length: 5 }, (_, i) => sampleEventInput({ source_group: 'pet', started_at: `2026-09-30T0${i}:00:00Z`, ended_at: `2026-09-30T0${i}:00:10Z` }));
      await s.eventService.createMany(USER_A, pets);
      expect((await s.stepGuideService.getGuide(USER_A, NOW)).scope_note).toContain('동물 소음을 상담하지 않으므로');
    });
    test('getCenterScopeNote: 말소리·공사 안내, 기록 없으면 null / 실패: 배열 아님', () => {
      const ev = (g) => ({ source_group: g, started_at: '2026-10-01T00:00:00Z' });
      expect(s.stepGuideService.getCenterScopeNote([ev('voice')], NOW)).toContain('인근소란');
      expect(s.stepGuideService.getCenterScopeNote([ev('hammer')], NOW)).toContain('인테리어 공사');
      expect(s.stepGuideService.getCenterScopeNote([ev('music')], NOW)).toBeNull();
      expect(s.stepGuideService.getCenterScopeNote([{ source_group: 'pet', started_at: '2026-08-01T00:00:00Z' }], NOW)).toBeNull();
      expect(s.stepGuideService.getCenterScopeNote([], NOW)).toBeNull();
      expect(() => s.stepGuideService.getCenterScopeNote(null, NOW)).toThrow(TypeError);
    });
    test('이웃 연락 2주 후 초과 사건이 없으면 해결로 안내', async () => {
      await m.eventModel.deleteByUser(USER_A);
      await m.messageModel.insert({ user_id: USER_A, recipient_type: 'neighbor', created_at: '2026-09-10T12:00:00Z', delivered_at: '2026-09-10T12:00:00Z' });
      const g = await s.stepGuideService.getGuide(USER_A, NOW);
      expect(g.current_step).toBe(1);
      expect(g.note).toContain('해결된 것으로');
    });
  });

  test('createServices: llmInfo 노출, 외부 클라이언트 주입', () => {
    expect(s.llmInfo.provider).toBe('template');
    const injected = createServices(m, config, { llmClient: { name: 'custom', generate: async () => 'x' } });
    expect(injected.llmInfo.provider).toBe('custom');
  });
});
