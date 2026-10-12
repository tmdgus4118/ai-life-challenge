const request = require('supertest');
const { startApp, stopApp } = require('../http-helpers');
const { AppConfig } = require('../../src/config/env');
const { makeTempDbDir, removeDir, USER_A, USER_B, sampleEventInput } = require('../helpers');

describe('API 통합', () => {
  let dir; let app;
  const as = (userId = USER_A) => ({ 'X-User-Id': userId });
  beforeEach(async () => {
    dir = makeTempDbDir();
    app = await startApp({ config: new AppConfig({ DB_DIR: dir, LLM_PROVIDER: 'template', NODE_ENV: 'test' }) });
  });
  afterEach(async () => { await stopApp(app); removeDir(dir); });

  test('GET /api/health: keep_alive 상태를 함께 돌려준다 (없으면 null, 있으면 호출 횟수)', async () => {
    const before = await request(app.server).get('/api/health');
    expect(before.body.keep_alive).toBeNull();
    app.locals.keepAlive = { enabled: true, url: 'https://x.onrender.com', intervalMs: 300000, pings: 3, failures: 1 };
    const after = await request(app.server).get('/api/health');
    expect(after.body.keep_alive).toMatchObject({ enabled: true, url: 'https://x.onrender.com', interval_min: 5, pings: 3, failures: 1 });
    expect(typeof after.body.keep_alive.uptime_sec).toBe('number');
    delete app.locals.keepAlive;
  });
  test('GET /api/health', async () => {
    const res = await request(app.server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.llm.provider).toBe('template');
  });

  test('헤더 없이 요청하면 쿠키로 새 UUID 발급', async () => {
    const res = await request(app.server).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/^nsid=/);
  });

  describe('/api/events', () => {
    test('POST 성공 → 판정 결과 포함 201, GET 조회, recent', async () => {
      const post = await request(app.server).post('/api/events').set(as()).send({ events: [sampleEventInput(), sampleEventInput({ source_group: 'pet', avg_db: 30 })] });
      expect(post.status).toBe(201);
      expect(post.body.count).toBe(2);
      expect(post.body.events[0]).toMatchObject({ exceeded: true, is_night: true, source_label: '발걸음' });
      const list = await request(app.server).get('/api/events?source=footstep').set(as());
      expect(list.body.count).toBe(1);
      const recent = await request(app.server).get('/api/events/recent').set(as());
      expect(recent.body.events).toHaveLength(2);
      const other = await request(app.server).get('/api/events').set(as(USER_B));
      expect(other.body.count).toBe(0);
    });
    test('POST 실패: 빈 배열 400, 잘못된 JSON 400, 잘못된 소음원 400', async () => {
      expect((await request(app.server).post('/api/events').set(as()).send({ events: [] })).status).toBe(400);
      const bad = await request(app.server).post('/api/events').set(as()).set('Content-Type', 'application/json').send('{bad');
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('INVALID_JSON');
      const src = await request(app.server).post('/api/events').set(as()).send([sampleEventInput({ source_group: 'x' })]);
      expect(src.status).toBe(400);
      expect(src.body.error.code).toBe('VALIDATION_ERROR');
    });
    test('GET /api/events/export.csv: CSV 첨부 파일', async () => {
      await request(app.server).post('/api/events').set(as()).send([sampleEventInput()]);
      const res = await request(app.server).get('/api/events/export.csv').set(as());
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text).toContain('발걸음');
      expect((await request(app.server).get('/api/events/export.csv?source=x').set(as())).status).toBe(400);
    });
    test('GET 실패: 잘못된 날짜 400', async () => {
      expect((await request(app.server).get('/api/events?from=bad').set(as())).status).toBe(400);
    });
    test('PATCH 메모 / DELETE, 남의 사건은 404', async () => {
      const post = await request(app.server).post('/api/events').set(as()).send([sampleEventInput()]);
      const id = post.body.events[0].id;
      const patch = await request(app.server).patch(`/api/events/${id}`).set(as()).send({ memo: '아이가 깨어남' });
      expect(patch.status).toBe(200);
      expect(patch.body.event.memo).toBe('아이가 깨어남');
      expect((await request(app.server).patch(`/api/events/${id}`).set(as()).send({})).status).toBe(400);
      expect((await request(app.server).delete(`/api/events/${id}`).set(as(USER_B))).status).toBe(404);
      expect((await request(app.server).delete(`/api/events/${id}`).set(as())).status).toBe(200);
      expect((await request(app.server).delete(`/api/events/${id}`).set(as())).status).toBe(404);
    });
  });

  describe('/api/reports', () => {
    beforeEach(async () => { await request(app.server).post('/api/data/demo').set(as()); });
    test('summary / generate / latest', async () => {
      const sum = await request(app.server).get('/api/reports/summary?days=7').set(as());
      expect(sum.status).toBe(200);
      expect(sum.body.summary.total_events).toBeGreaterThan(50);
      expect(sum.body.summary.comparison.has_previous).toBe(true);
      expect(typeof sum.body.summary.comparison.total.delta).toBe('number');
      expect((await request(app.server).get('/api/reports/latest').set(as())).body.report).toBeNull();
      const gen = await request(app.server).post('/api/reports/generate').set(as()).send({ days: 7 });
      expect(gen.status).toBe(201);
      expect(gen.body.report.ai_text.length).toBeGreaterThan(20);
      const latest = await request(app.server).get('/api/reports/latest?days=7').set(as());
      expect(latest.body.report.id).toBe(gen.body.report.id);
    });
    test('실패: days=10', async () => {
      expect((await request(app.server).get('/api/reports/summary?days=10').set(as())).status).toBe(400);
      expect((await request(app.server).post('/api/reports/generate').set(as()).send({ days: 'x' })).status).toBe(400);
    });
  });

  describe('/api/messages', () => {
    beforeEach(async () => { await request(app.server).post('/api/data/demo').set(as()); });
    test('generate 9개 조합 모두 300자 이내 201, next-step', async () => {
      for (const recipient of ['neighbor', 'management', 'center']) {
        for (const tone of ['soft', 'basic', 'firm']) {
          const res = await request(app.server).post('/api/messages/generate').set(as()).send({ recipient, tone });
          expect({ status: res.status, body: res.status === 201 ? null : res.body }).toEqual({ status: 201, body: null });
          expect(res.body.message.body.length).toBeLessThanOrEqual(300);
          expect(res.body.next_step.current_step).toBeGreaterThanOrEqual(1);
        }
      }
      const ns = await request(app.server).get('/api/messages/next-step').set(as());
      expect(ns.body.next_step.center.phone).toBe('1661-2642');
    });
    test('PATCH /:id/delivered, GET /history', async () => {
      const gen = await request(app.server).post('/api/messages/generate').set(as()).send({ recipient: 'neighbor' });
      const id = gen.body.message.id;
      const res = await request(app.server).patch(`/api/messages/${id}/delivered`).set(as()).send({});
      expect(res.status).toBe(200);
      expect(res.body.message.delivered_at).toBeTruthy();
      expect(res.body.next_step.steps[0].delivered).toBe(true);
      const undo = await request(app.server).patch(`/api/messages/${id}/delivered`).set(as()).send({ delivered: false });
      expect(undo.body.message.delivered_at).toBeNull();
      expect((await request(app.server).patch(`/api/messages/${id}/delivered`).set(as(USER_B)).send({})).status).toBe(404);
      const hist = await request(app.server).get('/api/messages/history').set(as());
      expect(hist.body.messages[0].recipient_label).toBe('이웃');
    });
    test('실패: 수신자 누락/오류', async () => {
      expect((await request(app.server).post('/api/messages/generate').set(as()).send({})).status).toBe(400);
      expect((await request(app.server).post('/api/messages/generate').set(as()).send({ recipient: 'police' })).status).toBe(400);
    });
  });

  describe('/api/settings', () => {
    test('GET 기본값 + 기준표, PUT 갱신, calibrate', async () => {
      const get = await request(app.server).get('/api/settings').set(as());
      expect(get.body.settings.night_start).toBe(22);
      expect(get.body.thresholds).toHaveLength(3);
      const put = await request(app.server).put('/api/settings').set(as()).send({ night_start: 23, min_duration_sec: 5 });
      expect(put.status).toBe(200);
      expect(put.body.settings).toMatchObject({ night_start: 23, min_duration_sec: 5 });
      const cal = await request(app.server).post('/api/settings/calibrate').set(as()).send({ measured_dbfs: -65 });
      expect(cal.body.settings.db_offset).toBe(95);
    });
    test('실패: 범위 밖, 빈 바디, 보정값 오류', async () => {
      expect((await request(app.server).put('/api/settings').set(as()).send({ night_start: 25 })).status).toBe(400);
      expect((await request(app.server).put('/api/settings').set(as()).send({})).status).toBe(400);
      expect((await request(app.server).post('/api/settings/calibrate').set(as()).send({ measured_dbfs: 10 })).status).toBe(400);
    });
  });

  describe('/api/data', () => {
    test('demo 생성 후 전체 삭제, 다른 사용자 영향 없음', async () => {
      const demo = await request(app.server).post('/api/data/demo').set(as());
      expect(demo.status).toBe(201);
      expect(demo.body.inserted).toBeGreaterThan(100);
      await request(app.server).post('/api/data/demo').set(as(USER_B));
      const del = await request(app.server).delete('/api/data').set(as());
      expect(del.body.deleted.events).toBe(demo.body.inserted);
      expect((await request(app.server).get('/api/events').set(as(USER_B))).body.count).toBeGreaterThan(0);
    });
  });

  test('없는 API 경로는 JSON 404', async () => {
    const res = await request(app.server).get('/api/nope').set(as());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('API 스트리밍 (SSE)', () => {
  let dir; let app;
  const as = () => ({ 'X-User-Id': USER_A });
  const parseSse = (text) => text.trim().split('\n\n').map((block) => {
    const lines = block.split('\n');
    return { event: lines[0].replace('event: ', ''), data: JSON.parse(lines[1].replace('data: ', '')) };
  });
  beforeEach(async () => {
    dir = makeTempDbDir();
    app = await startApp({ config: new AppConfig({ DB_DIR: dir, LLM_PROVIDER: 'template', NODE_ENV: 'test' }) });
    await request(app.server).post('/api/data/demo').set(as());
  });
  afterEach(async () => { await stopApp(app); removeDir(dir); });

  test('POST /api/messages/generate/stream: attempt → delta… → done, 이어 붙인 글 = 저장된 글', async () => {
    const res = await request(app.server).post('/api/messages/generate/stream').set(as()).send({ recipient: 'neighbor', tone: 'firm' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseSse(res.text);
    expect(events[0]).toEqual({ event: 'attempt', data: { attempt: 1, provider: 'template' } });
    const deltas = events.filter((e) => e.event === 'delta');
    expect(deltas.length).toBeGreaterThan(10);
    const done = events[events.length - 1];
    expect(done.event).toBe('done');
    expect(deltas.map((d) => d.data.text).join('')).toBe(done.data.message.body);
    expect(done.data.next_step.current_step).toBe(1);
  });

  test('POST /api/reports/generate/stream: done에 저장된 리포트', async () => {
    const res = await request(app.server).post('/api/reports/generate/stream').set(as()).send({ days: 14 });
    const events = parseSse(res.text);
    const done = events[events.length - 1];
    expect(done.event).toBe('done');
    expect(done.data.report.days).toBe(14);
    expect(events.filter((e) => e.event === 'delta').map((d) => d.data.text).join('')).toBe(done.data.report.ai_text);
    const latest = await request(app.server).get('/api/reports/latest?days=14').set(as());
    expect(latest.body.report.id).toBe(done.data.report.id);
  });

  test('실패: 입력 오류는 스트림을 열기 전에 JSON 400', async () => {
    const res = await request(app.server).post('/api/messages/generate/stream').set(as()).send({ recipient: 'police' });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/json');
    expect((await request(app.server).post('/api/reports/generate/stream').set(as()).send({ days: 9 })).status).toBe(400);
  });
});

describe('API /api/lab', () => {
  let dir; let app;
  const as = () => ({ 'X-User-Id': USER_A });
  beforeEach(async () => {
    dir = makeTempDbDir();
    app = await startApp({ config: new AppConfig({ DB_DIR: dir, LLM_PROVIDER: 'template', NODE_ENV: 'test' }) });
  });
  afterEach(async () => { await stopApp(app); removeDir(dir); });

  test('POST /runs → 201 + 요약, GET /summary, DELETE /runs', async () => {
    const res = await request(app.server).post('/api/lab/runs').set(as()).send({ expected_group: 'pet', frames: [{ group: 'pet', confidence: 0.8, top_class: 'Bark' }] });
    expect(res.status).toBe(201);
    expect(res.body.run.correct).toBe(true);
    expect(res.body.summary.accuracy).toBe(100);
    expect((await request(app.server).get('/api/lab/summary').set(as())).body.summary.total_runs).toBe(1);
    expect((await request(app.server).delete('/api/lab/runs').set(as())).body.deleted).toBe(1);
  });
  test('실패: 잘못된 입력 400', async () => {
    expect((await request(app.server).post('/api/lab/runs').set(as()).send({ expected_group: 'pet', frames: [] })).status).toBe(400);
  });
});

describe('API /api/reports/ask/stream', () => {
  let dir; let app;
  const as = () => ({ 'X-User-Id': USER_A });
  const parseSse = (text) => text.trim().split('\n\n').map((block) => {
    const lines = block.split('\n');
    return { event: lines[0].replace('event: ', ''), data: JSON.parse(lines[1].replace('data: ', '')) };
  });
  beforeEach(async () => {
    dir = makeTempDbDir();
    app = await startApp({ config: new AppConfig({ DB_DIR: dir, LLM_PROVIDER: 'template', NODE_ENV: 'test' }) });
    await request(app.server).post('/api/data/demo').set(as());
  });
  afterEach(async () => { await stopApp(app); removeDir(dir); });

  test('추천 질문: attempt → delta… → done(answer), 이어 붙인 글 = 답', async () => {
    const res = await request(app.server).post('/api/reports/ask/stream').set(as()).send({ days: 7, question_key: 'weekday_weekend' });
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseSse(res.text);
    const done = events[events.length - 1];
    expect(done.event).toBe('done');
    expect(done.data.answer).toContain('평일(월~금)');
    expect(events.filter((e) => e.event === 'delta').map((e) => e.data.text).join('')).toBe(done.data.answer);
  });
  test('실패: 질문 없음 400 JSON', async () => {
    const res = await request(app.server).post('/api/reports/ask/stream').set(as()).send({ days: 7 });
    expect(res.status).toBe(400);
  });
});

describe('공유 링크 API·화면', () => {
  let dir; let app;
  const as = (u = USER_A) => ({ 'X-User-Id': u });
  beforeEach(async () => {
    dir = makeTempDbDir();
    app = await startApp({ config: new AppConfig({ DB_DIR: dir, LLM_PROVIDER: 'template', NODE_ENV: 'test' }) });
    await request(app.server).post('/api/data/demo').set(as());
  });
  afterEach(async () => { await stopApp(app); removeDir(dir); });

  test('POST /api/shares → 201 + 절대 URL, /s/:token 읽기 전용 화면, 목록, 취소 후 404', async () => {
    const res = await request(app.server).post('/api/shares').set(as()).send({ days: 7 });
    expect(res.status).toBe(201);
    expect(res.body.share.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/s\/[A-Za-z0-9_-]{22}$/);
    const page = await request(app.server).get(res.body.share.path);
    expect(page.status).toBe(200);
    ['읽기 전용 리포트', 'class="dial"', '데모 기록', '사용자 메모는 공유되지 않습니다', '1661-2642'].forEach((t) => expect(page.text).toContain(t));
    expect(page.text).not.toContain('class="tabbar"');
    expect(page.headers['x-robots-tag']).toContain('noindex');
    expect((await request(app.server).get('/api/shares').set(as())).body.shares).toHaveLength(1);
    expect((await request(app.server).delete(`/api/shares/${res.body.share.id}`).set(as(USER_B))).status).toBe(404);
    expect((await request(app.server).delete(`/api/shares/${res.body.share.id}`).set(as())).status).toBe(200);
    expect((await request(app.server).get(res.body.share.path)).status).toBe(404);
  });
  test('실패: 기록 없는 사용자 400, 잘못된 기간 400, 없는 토큰 404 화면', async () => {
    expect((await request(app.server).post('/api/shares').set(as(USER_B)).send({ days: 7 })).status).toBe(400);
    expect((await request(app.server).post('/api/shares').set(as()).send({ days: 3 })).status).toBe(400);
    const missing = await request(app.server).get('/s/AAAAAAAAAAAAAAAAAAAAAA');
    expect(missing.status).toBe(404);
    expect(missing.text).toContain('문제가 발생했습니다');
  });
});
