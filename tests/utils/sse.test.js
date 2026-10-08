const { EventEmitter } = require('events');
const { SseWriter } = require('../../src/utils/sse');
const { streamResponse } = require('../../src/controllers/streamResponse');

const mockRes = () => {
  const res = new EventEmitter();
  res.chunks = [];
  res.writableEnded = false;
  res.status = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.flushHeaders = jest.fn();
  res.write = jest.fn((c) => { res.chunks.push(c); return true; });
  res.end = jest.fn(() => { res.writableEnded = true; });
  return res;
};

describe('SseWriter', () => {
  test('헤더 설정, 이벤트 형식, close', () => {
    const res = mockRes();
    const sse = new SseWriter(res);
    expect(res.set.mock.calls[0][0]['Content-Type']).toContain('text/event-stream');
    expect(sse.send('delta', { text: '안녕' })).toBe(true);
    expect(res.chunks[0]).toBe('event: delta\ndata: {"text":"안녕"}\n\n');
    sse.close();
    expect(res.end).toHaveBeenCalled();
    expect(sse.send('delta', {})).toBe(false);
  });
  test('연결이 끊기면 더 보내지 않는다', () => {
    const res = mockRes();
    const sse = new SseWriter(res);
    res.emit('close');
    expect(sse.send('delta', {})).toBe(false);
  });
  test('실패: res 없음, 이벤트 이름 없음', () => {
    expect(() => new SseWriter({})).toThrow(TypeError);
    expect(() => new SseWriter(mockRes()).send('')).toThrow(TypeError);
  });
});

describe('streamResponse', () => {
  test('성공: 진행 이벤트를 중계하고 done 전송 후 종료', async () => {
    const res = mockRes();
    await streamResponse(new SseWriter(res), res, async ({ onEvent }) => { onEvent('delta', { text: 'a' }); return { id: 1 }; }, (r) => ({ report: r }));
    expect(res.chunks.join('')).toContain('event: delta');
    expect(res.chunks.join('')).toContain('event: done\ndata: {"report":{"id":1}}');
    expect(res.end).toHaveBeenCalled();
  });
  test('실패: 생성 오류는 error 이벤트, 500대 메시지는 숨김', async () => {
    const res = mockRes();
    await streamResponse(new SseWriter(res), res, async () => { throw new Error('secret'); }, (r) => r);
    expect(res.chunks.join('')).toContain('event: error');
    expect(res.chunks.join('')).not.toContain('secret');
    const res2 = mockRes();
    await streamResponse(new SseWriter(res2), res2, async () => { throw Object.assign(new Error('잘못된 요청'), { status: 404 }); }, (r) => r);
    expect(res2.chunks.join('')).toContain('잘못된 요청');
  });
  test('연결이 끊기면 signal이 abort되고 error를 보내지 않는다', async () => {
    const res = mockRes();
    let seen = null;
    await streamResponse(new SseWriter(res), res, async ({ signal }) => { res.emit('close'); seen = signal.aborted; throw new Error('aborted'); }, (r) => r);
    expect(seen).toBe(true);
    expect(res.chunks.join('')).not.toContain('event: error');
  });
  test('실패: 잘못된 인자', async () => {
    await expect(streamResponse(null, mockRes(), async () => {}, (r) => r)).rejects.toThrow(TypeError);
  });
});
