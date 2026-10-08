const { PromptBuilder } = require('../../src/services/llm/PromptBuilder');
const { LlmClient } = require('../../src/services/llm/LlmClient');
const { TemplateLlmClient } = require('../../src/services/llm/TemplateLlmClient');
const { AnthropicLlmClient } = require('../../src/services/llm/AnthropicLlmClient');
const { LlmClientFactory } = require('../../src/services/llm/LlmClientFactory');
const { AiWriterService } = require('../../src/services/AiWriterService');
const { AggregationService } = require('../../src/services/AggregationService');
const { SafetyChecker } = require('../../src/services/SafetyChecker');
const { LlmError } = require('../../src/utils/errors');
const { RECIPIENT_KEYS, TONE_KEYS, MESSAGE_MAX_LENGTH } = require('../../src/shared/constants');

const agg = new AggregationService();
const period = { from: '2026-09-25T15:00:00Z', to: '2026-10-02T12:00:00Z', days: 7 };
const ev = (over) => ({ source_group: 'footstep', started_at: '2026-09-28T13:10:00Z', ended_at: '2026-09-28T13:10:12Z', duration_sec: 12, avg_db: 41.2, max_db: 58.3, is_night: true, exceeded: true, memo: '', ...over });
const summary = agg.summarize([ev(), ev({ started_at: '2026-09-29T13:30:00Z' }), ev({ source_group: 'furniture', started_at: '2026-09-27T05:00:00Z', is_night: false, exceeded: false })], period);
const emptySummary = agg.summarize([], period);
const settings = { night_start: 22, night_end: 6 };

describe('PromptBuilder', () => {
  const pb = new PromptBuilder();
  test('리포트 프롬프트: 규칙·예시 3개·JSON 포함, 히트맵 제외', () => {
    const p = pb.buildReportPrompt(summary, settings);
    expect(p).toContain('예시 3:');
    expect(p).toContain('"total_events": 3');
    expect(p).not.toContain('heatmap');
    expect(PromptBuilder.REPORT_SYSTEM).toContain('5문장');
  });
  test('소음을 내는 쪽 프롬프트: 양해·조치 구조 / 실패: 센터', () => {
    const p = pb.buildMessagePrompt(summary, 'neighbor', 'firm', { role: 'maker' });
    expect(p).toContain('소음을 내는 쪽');
    expect(p).toContain('할 조치');
    expect(() => pb.buildMakerPrompt(summary, 'center', 'soft')).toThrow(RangeError);
    expect(() => pb.buildMakerPrompt(null, 'neighbor', 'soft')).toThrow(TypeError);
    expect(() => pb.buildMakerPrompt(summary, 'neighbor', 'x')).toThrow(RangeError);
  });
  test('메시지 프롬프트: 수신자·말투 반영 / 실패: 모르는 수신자', () => {
    const p = pb.buildMessagePrompt(summary, 'management', 'firm', settings);
    expect(p).toContain('관리사무소');
    expect(p).toContain('단호하게');
    expect(() => pb.buildMessagePrompt(summary, 'police', 'firm')).toThrow(RangeError);
    expect(() => pb.buildMessagePrompt(summary, 'neighbor', 'angry')).toThrow(RangeError);
    expect(() => pb.buildReportPrompt(null)).toThrow(TypeError);
  });
});

describe('LlmClient base', () => {
  test('generate 미구현 / validateTask 실패', async () => {
    const c = new LlmClient();
    await expect(c.generate({})).rejects.toThrow('must be implemented');
    expect(() => c.validateTask({ type: 'x', summary })).toThrow(TypeError);
    expect(() => c.validateTask({ type: 'report' })).toThrow(TypeError);
  });
});

describe('TemplateLlmClient', () => {
  const client = new TemplateLlmClient();
  const checker = new SafetyChecker();
  test('리포트: 5문장 이내, 숫자는 입력에서만, 금지어 없음', async () => {
    const text = await client.generate({ type: 'report', summary });
    const allowed = agg.collectNumbers(summary);
    expect(checker.validateReport(text, allowed).ok).toBe(true);
    expect(text).toContain('22~23시');
    expect(text.endsWith('참고 자료입니다.')).toBe(true);
  });
  test('리포트: 바닥 진동을 잰 사건이 있으면 진동 동반 수를 쓰고, 5문장·마지막 고지를 지킨다', async () => {
    const vibSummary = agg.summarize([ev({ vibration_sec: 2 }), ev({ started_at: '2026-09-29T13:30:00Z', vibration_sec: 0 }), ev({ source_group: 'furniture', started_at: '2026-09-27T05:00:00Z', is_night: false, exceeded: false, vibration_sec: 1 })], period);
    const text = await client.generate({ type: 'report', summary: vibSummary });
    expect(text).toContain('바닥 진동을 함께 잰 3건 중 2건은 진동을 동반했습니다');
    expect(checker.validateReport(text, agg.collectNumbers(vibSummary)).ok).toBe(true);
    expect(text.endsWith('참고 자료입니다.')).toBe(true);
    const plain = await client.generate({ type: 'report', summary });
    expect(plain).not.toContain('진동');
  });
  test('시간대 건수와 소음원 건수를 섞어 쓰지 않는다 (9가지 메시지 모두)', async () => {
    const mixed = agg.summarize([
      ev(), ev({ started_at: '2026-09-28T13:20:00Z' }), // 22시 발걸음 2
      ev({ started_at: '2026-09-29T05:00:00Z' }), ev({ started_at: '2026-09-30T06:00:00Z' }), // 14·15시 발걸음
    ], period);
    expect(mixed.top_hour.count).toBe(2);
    expect(mixed.top_source.count).toBe(4);
    for (const recipient of RECIPIENT_KEYS) {
      for (const tone of TONE_KEYS) {
        const text = await client.generate({ type: 'message', summary: mixed, recipient, tone });
        expect(text).not.toMatch(/22~23시에 발걸음 소리가 4건/);
        expect(text).toContain('22~23시에 가장 많은 2건');
        expect(text).toContain('발걸음이 4건');
      }
    }
  });
  test('소음을 내는 쪽: 이웃·관리사무소 × 3말투, 300자 이내, 검사 통과, 서로 다른 글 / 실패: 센터', async () => {
    const allowed = agg.collectNumbers(summary);
    const seen = new Set();
    for (const recipient of ['neighbor', 'management']) {
      for (const tone of TONE_KEYS) {
        const text = await client.generate({ type: 'message', summary, recipient, tone, settings: { role: 'maker' } });
        expect(text.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
        expect(checker.validateMessage(text, allowed).ok).toBe(true);
        expect(text).toContain('저희');
        seen.add(text);
      }
    }
    expect(seen.size).toBe(6);
    expect(() => client.writeMakerMessage(summary, 'center', 'soft')).toThrow(RangeError);
    expect(() => client.writeMakerMessage(summary, 'neighbor', 'x')).toThrow(RangeError);
  });
  test('josa: 받침 유무, 영문 끝 / 실패: 빈 값', () => {
    expect(TemplateLlmClient.josa('발걸음', '이', '가')).toBe('발걸음이');
    expect(TemplateLlmClient.josa('가구·충격', '이', '가')).toBe('가구·충격이');
    expect(TemplateLlmClient.josa('말소리·TV', '이', '가')).toBe('말소리·TV가');
    expect(TemplateLlmClient.josa('악기·음악', '이', '가')).toBe('악기·음악이');
    expect(TemplateLlmClient.josa('반려동물', '이', '가')).toBe('반려동물이');
    expect(TemplateLlmClient.josa('망치·공사', '이', '가')).toBe('망치·공사가');
    expect(() => TemplateLlmClient.josa('', '이', '가')).toThrow(TypeError);
  });
  test('리포트: "이(가)" 같은 어색한 조사가 없다', async () => {
    const text = await client.generate({ type: 'report', summary });
    expect(text).not.toContain('이(가)');
  });
  test('리포트: 사건이 없을 때', async () => {
    const text = await client.generate({ type: 'report', summary: emptySummary });
    expect(text).toContain('기록된 소음 사건은 없습니다');
  });
  test('메시지: 9가지 조합 모두 300자 이내, 서로 다른 글, 검사 통과', async () => {
    const allowed = agg.collectNumbers(summary);
    const seen = new Set();
    for (const recipient of RECIPIENT_KEYS) {
      for (const tone of TONE_KEYS) {
        const text = await client.generate({ type: 'message', summary, recipient, tone });
        expect(text.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
        expect(checker.validateMessage(text, allowed).ok).toBe(true);
        seen.add(text);
      }
    }
    expect(seen.size).toBe(9);
  });
  test('실패: 잘못된 task', async () => {
    await expect(client.generate({ type: 'message', summary, recipient: 'x', tone: 'basic' })).rejects.toThrow(RangeError);
    await expect(client.generate(null)).rejects.toThrow(TypeError);
  });
});

describe('AnthropicLlmClient', () => {
  const makeSdk = (impl) => ({ beta: { messages: { create: jest.fn(impl) } } });
  test('실패: apiKey 없음', () => {
    expect(() => new AnthropicLlmClient({})).toThrow(TypeError);
  });
  test('성공: 텍스트 블록을 이어 붙여 반환하고 fallbacks를 요청에 포함', async () => {
    const sdk = makeSdk(async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: ' 요약문 ' }] }));
    const c = new AnthropicLlmClient({ sdk, model: 'claude-opus-5-5' });
    const text = await c.generate({ type: 'report', summary, system: 's', prompt: 'p' });
    expect(text).toBe('요약문');
    const args = sdk.beta.messages.create.mock.calls[0][0];
    expect(args.model).toBe('claude-opus-5-5');
    expect(args.fallbacks).toBe('default');
    expect(args.messages[0].content).toBe('p');
  });
  test('실패: refusal, 빈 응답, SDK 예외 → LlmError', async () => {
    await expect(new AnthropicLlmClient({ sdk: makeSdk(async () => ({ stop_reason: 'refusal', stop_details: { category: 'x' }, content: [] })) })
      .generate({ type: 'report', summary, system: 's', prompt: 'p' })).rejects.toThrow(LlmError);
    await expect(new AnthropicLlmClient({ sdk: makeSdk(async () => ({ stop_reason: 'end_turn', content: [] })) })
      .generate({ type: 'report', summary, system: 's', prompt: 'p' })).rejects.toThrow(LlmError);
    await expect(new AnthropicLlmClient({ sdk: makeSdk(async () => { throw Object.assign(new Error('boom'), { status: 500 }); }) })
      .generate({ type: 'report', summary, system: 's', prompt: 'p' })).rejects.toThrow(LlmError);
    await expect(new AnthropicLlmClient({ sdk: makeSdk(async () => ({})) }).generate({ type: 'report', summary })).rejects.toThrow(TypeError);
  });
});

describe('LlmClientFactory', () => {
  test('template 기본 / anthropic 키 없음 → template 대체 / 모르는 provider', () => {
    expect(LlmClientFactory.create({ llmProvider: 'template' }).client.name).toBe('template');
    const noKey = LlmClientFactory.create({ llmProvider: 'anthropic' });
    expect(noKey.client.name).toBe('template');
    expect(noKey.fallbackReason).toContain('ANTHROPIC_API_KEY');
    expect(LlmClientFactory.create({ llmProvider: 'gpt' }).fallbackReason).toContain('알 수 없는');
    expect(LlmClientFactory.create({ llmProvider: 'anthropic', anthropicApiKey: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz', llmModel: 'claude-opus-5-5' }).client.name).toBe('anthropic');
    const placeholder = LlmClientFactory.create({ llmProvider: 'anthropic', anthropicApiKey: '발급받은_키' });
    expect(placeholder.client.name).toBe('template');
    expect(placeholder.fallbackReason).toContain('형식이 올바르지 않아');
  });
});

describe('LlmClientFactory.isValidApiKey', () => {
  test('성공: ASCII 20자 이상 / 실패: 예시 문구, 공백, 짧은 값, 비문자열', () => {
    expect(LlmClientFactory.isValidApiKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(LlmClientFactory.isValidApiKey('발급받은_키')).toBe(false);
    expect(LlmClientFactory.isValidApiKey('sk-ant-api03 abcdefghijklmnop')).toBe(false);
    expect(LlmClientFactory.isValidApiKey('sk-short')).toBe(false);
    expect(LlmClientFactory.isValidApiKey(undefined)).toBe(false);
  });
});

describe('AiWriterService (생성 → 검사 → 재생성 → 대체)', () => {
  const fakeClient = (outputs) => {
    let i = 0;
    return { name: 'fake', generate: jest.fn(async () => { const out = outputs[Math.min(i, outputs.length - 1)]; i += 1; if (out instanceof Error) throw out; return out; }) };
  };
  test('실패: llmClient 누락', () => { expect(() => new AiWriterService({})).toThrow(TypeError); });
  test('첫 시도 통과', async () => {
    const good = '기록된 소음은 22~23시에 발걸음 2건이 가장 많았습니다. 총 3건 중 2건이 기준을 넘었습니다. 이 기록은 참고 자료입니다.';
    const writer = new AiWriterService({ llmClient: fakeClient([good]) });
    const r = await writer.writeReport(summary, { settings });
    expect(r).toMatchObject({ text: good, provider: 'fake', attempts: 1, fallback: false });
  });
  test('금지어 → 재생성 후 통과 (2회)', async () => {
    const writer = new AiWriterService({ llmClient: fakeClient(['위층이 뛰었습니다.', '기록된 소음은 총 3건입니다.']) });
    const r = await writer.writeReport(summary, { settings });
    expect(r.attempts).toBe(2);
    expect(r.log[0].problems[0]).toContain('금지 표현');
  });
  test('입력에 없는 숫자가 계속 나오면 규칙 기반 대체문 사용', async () => {
    const writer = new AiWriterService({ llmClient: fakeClient(['총 999건입니다.']) });
    const r = await writer.writeReport(summary, { settings });
    expect(r.fallback).toBe(true);
    expect(r.provider).toBe('template');
    expect(r.attempts).toBe(3);
    expect(r.text).toContain('3건');
  });
  test('LLM 예외도 로그에 남기고 대체문으로 이어진다', async () => {
    const writer = new AiWriterService({ llmClient: fakeClient([new Error('network')]), maxAttempts: 2 });
    const r = await writer.writeMessage(summary, 'neighbor', 'soft', { settings });
    expect(r.fallback).toBe(true);
    expect(r.log).toHaveLength(2);
    expect(r.text.length).toBeLessThanOrEqual(300);
  });
  test('메시지 300자 초과 → 대체', async () => {
    const writer = new AiWriterService({ llmClient: fakeClient(['가'.repeat(301)]) });
    const r = await writer.writeMessage(summary, 'center', 'firm', { settings });
    expect(r.fallback).toBe(true);
  });
  test('실패: summary 누락', async () => {
    const writer = new AiWriterService({ llmClient: fakeClient(['x']) });
    await expect(writer.writeReport(null)).rejects.toThrow(TypeError);
    await expect(writer.writeMessage(null, 'neighbor', 'soft')).rejects.toThrow(TypeError);
  });
  test('buildAllowedNumbers: 설정·기준표 숫자 포함', () => {
    const writer = new AiWriterService({ llmClient: fakeClient(['x']) });
    const set = writer.buildAllowedNumbers(summary, { night_start: 21 }, [{ day_db: 39 }]);
    expect(set.has(21)).toBe(true);
    expect(set.has(39)).toBe(true);
  });
});
