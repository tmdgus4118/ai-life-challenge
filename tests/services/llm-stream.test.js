const { LlmClient } = require('../../src/services/llm/LlmClient');
const { TemplateLlmClient } = require('../../src/services/llm/TemplateLlmClient');
const { AnthropicLlmClient } = require('../../src/services/llm/AnthropicLlmClient');
const { AiWriterService } = require('../../src/services/AiWriterService');
const { AggregationService } = require('../../src/services/AggregationService');
const { LlmError } = require('../../src/utils/errors');

const agg = new AggregationService();
const period = { from: '2026-09-25T15:00:00Z', to: '2026-10-02T12:00:00Z', days: 7 };
const ev = (over) => ({ source_group: 'footstep', started_at: '2026-09-28T13:10:00Z', ended_at: '2026-09-28T13:10:12Z', duration_sec: 12, avg_db: 41.2, max_db: 58.3, is_night: true, exceeded: true, memo: '', ...over });
const summary = agg.summarize([ev(), ev({ started_at: '2026-09-29T13:30:00Z' })], period);

describe('LlmClient.stream (기본 구현)', () => {
  test('완성문을 한 번에 넘긴다 / 실패: onDelta 없음, 중단', async () => {
    class Fixed extends LlmClient { async generate() { return '완성문'; } }
    const deltas = [];
    expect(await new Fixed().stream({}, (t) => deltas.push(t))).toBe('완성문');
    expect(deltas).toEqual(['완성문']);
    await expect(new Fixed().stream({}, null)).rejects.toThrow(TypeError);
    const ac = new AbortController(); ac.abort();
    await expect(new Fixed().stream({}, () => {}, { signal: ac.signal })).rejects.toThrow('aborted');
  });
});

describe('TemplateLlmClient.stream / splitChunks', () => {
  test('splitChunks: 이어 붙이면 원문, 조각은 짧다', () => {
    const text = '안녕하세요. 22~23시에 발걸음 2건이 기록되었습니다.';
    const chunks = TemplateLlmClient.splitChunks(text);
    expect(chunks.join('')).toBe(text);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => Array.from(c).length <= 3)).toBe(true);
    expect(() => TemplateLlmClient.splitChunks(1)).toThrow(TypeError);
    expect(() => TemplateLlmClient.splitChunks('a', 0)).toThrow(TypeError);
  });
  test('stream: 생각 단계(thinkMs) 동안은 아무것도 보내지 않는다', async () => {
    jest.useFakeTimers();
    const client = new TemplateLlmClient({ chunkDelayMs: 0, thinkMs: 500 });
    const deltas = [];
    const p = client.stream({ type: 'report', summary }, (t) => deltas.push(t));
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(400);
    expect(deltas).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(200);
    await p;
    expect(deltas.length).toBeGreaterThan(0);
    jest.useRealTimers();
  });
  test('stream: 조각을 순서대로 보내고 완성문 반환', async () => {
    const client = new TemplateLlmClient({ chunkDelayMs: 0, thinkMs: 0 });
    const deltas = [];
    const text = await client.stream({ type: 'report', summary }, (t) => deltas.push(t));
    expect(deltas.length).toBeGreaterThan(10);
    expect(deltas.join('')).toBe(text);
  });
  test('실패: 잘못된 지연값, onDelta 없음, 중단 신호', async () => {
    expect(() => new TemplateLlmClient({ chunkDelayMs: -1 })).toThrow(TypeError);
    expect(() => new TemplateLlmClient({ thinkMs: 'x' })).toThrow(TypeError);
    const client = new TemplateLlmClient({ chunkDelayMs: 0, thinkMs: 0 });
    await expect(client.stream({ type: 'report', summary }, 'x')).rejects.toThrow(TypeError);
    const ac = new AbortController(); ac.abort();
    await expect(client.stream({ type: 'report', summary }, () => {}, { signal: ac.signal })).rejects.toThrow('aborted');
  });
});

describe('AnthropicLlmClient.stream', () => {
  const makeStream = (events, final) => ({
    async *[Symbol.asyncIterator]() { for (const e of events) yield e; },
    finalMessage: async () => final,
  });
  const delta = (text) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text } });

  test('성공: text_delta를 그대로 넘기고 최종 텍스트 반환, 중단 신호 전달', async () => {
    const final = { stop_reason: 'end_turn', content: [{ type: 'text', text: '기록된 소음은 2건입니다.' }] };
    const streamFn = jest.fn(() => makeStream([{ type: 'message_start' }, delta('기록된 '), delta('소음은 2건입니다.')], final));
    const client = new AnthropicLlmClient({ sdk: { beta: { messages: { stream: streamFn } } } });
    const deltas = [];
    const ac = new AbortController();
    const text = await client.stream({ type: 'report', summary, system: 's', prompt: 'p' }, (t) => deltas.push(t), { signal: ac.signal });
    expect(deltas).toEqual(['기록된 ', '소음은 2건입니다.']);
    expect(text).toBe('기록된 소음은 2건입니다.');
    expect(streamFn.mock.calls[0][0].fallbacks).toBe('default');
    expect(streamFn.mock.calls[0][1]).toEqual({ signal: ac.signal });
  });
  test('실패: refusal, 스트림 오류 → LlmError, onDelta 없음 → TypeError', async () => {
    const refusal = new AnthropicLlmClient({ sdk: { beta: { messages: { stream: () => makeStream([], { stop_reason: 'refusal', content: [] }) } } } });
    await expect(refusal.stream({ type: 'report', summary, system: 's', prompt: 'p' }, () => {})).rejects.toThrow(LlmError);
    const broken = new AnthropicLlmClient({ sdk: { beta: { messages: { stream: () => { throw new Error('net'); } } } } });
    await expect(broken.stream({ type: 'report', summary, system: 's', prompt: 'p' }, () => {})).rejects.toThrow(LlmError);
    await expect(broken.stream({ type: 'report', summary, system: 's', prompt: 'p' })).rejects.toThrow(TypeError);
  });
});

describe('AiWriterService 스트리밍 이벤트', () => {
  const streamingClient = (outputs) => {
    let i = 0;
    return {
      name: 'fake',
      generate: async () => outputs[0],
      stream: jest.fn(async (task, onDelta) => {
        const out = outputs[Math.min(i, outputs.length - 1)]; i += 1;
        if (out instanceof Error) throw out;
        onDelta(out.slice(0, 3)); onDelta(out.slice(3));
        return out;
      }),
    };
  };
  const collect = () => { const events = []; return { events, onEvent: (type, data) => events.push([type, data]) }; };

  test('첫 시도 통과: attempt → delta들', async () => {
    const { events, onEvent } = collect();
    const writer = new AiWriterService({ llmClient: streamingClient(['기록된 소음은 총 2건입니다.']), fallbackClient: new TemplateLlmClient({ chunkDelayMs: 0, thinkMs: 0 }) });
    const r = await writer.writeReport(summary, { onEvent });
    expect(r.attempts).toBe(1);
    expect(events.map((e) => e[0])).toEqual(['attempt', 'delta', 'delta']);
    expect(events[0][1]).toEqual({ attempt: 1, provider: 'fake' });
  });
  test('검사 탈락 → retry 이벤트(문제 포함) 후 재생성', async () => {
    const { events, onEvent } = collect();
    const writer = new AiWriterService({ llmClient: streamingClient(['위층이 뛰었습니다.', '기록된 소음은 총 2건입니다.']), fallbackClient: new TemplateLlmClient({ chunkDelayMs: 0, thinkMs: 0 }) });
    const r = await writer.writeMessage(summary, 'neighbor', 'soft', { onEvent });
    expect(r.attempts).toBe(2);
    const retry = events.find((e) => e[0] === 'retry');
    expect(retry[1].problems[0]).toContain('금지 표현');
  });
  test('끝까지 실패 → fallback 이벤트 후 규칙 기반 글을 스트리밍', async () => {
    const { events, onEvent } = collect();
    const writer = new AiWriterService({ llmClient: streamingClient(['총 999건']), fallbackClient: new TemplateLlmClient({ chunkDelayMs: 0, thinkMs: 0 }), maxAttempts: 2 });
    const r = await writer.writeReport(summary, { onEvent });
    expect(r.fallback).toBe(true);
    const types = events.map((e) => e[0]);
    expect(types.filter((t) => t === 'retry')).toHaveLength(2);
    expect(types).toContain('fallback');
    expect(types.slice(types.indexOf('fallback') + 1).every((t) => t === 'delta')).toBe(true);
  });
  test('LLM 예외도 retry로 알린다', async () => {
    const { events, onEvent } = collect();
    const writer = new AiWriterService({ llmClient: streamingClient([new Error('net'), '기록된 소음은 총 2건입니다.']), fallbackClient: new TemplateLlmClient({ chunkDelayMs: 0, thinkMs: 0 }) });
    await writer.writeReport(summary, { onEvent });
    expect(events.find((e) => e[0] === 'retry')[1].problems).toEqual(['생성 실패']);
  });
  test('실패: onEvent가 함수가 아님, 중단 신호', async () => {
    const writer = new AiWriterService({ llmClient: streamingClient(['x']), fallbackClient: new TemplateLlmClient({ chunkDelayMs: 0, thinkMs: 0 }) });
    await expect(writer.writeReport(summary, { onEvent: 'x' })).rejects.toThrow(TypeError);
    const ac = new AbortController(); ac.abort();
    await expect(writer.writeReport(summary, { onEvent: () => {}, signal: ac.signal })).rejects.toThrow('aborted');
  });
});
