/**
 * Server-Sent Events 응답 도우미. 생성 과정을 브라우저로 실시간 전송한다.
 */
class SseWriter {
  constructor(res) {
    if (!res || typeof res.write !== 'function') throw new TypeError('res is required');
    this.res = res;
    this.closed = false;
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.on('close', () => {
      this.closed = true;
    });
  }

  /** 이벤트 하나를 보낸다. 연결이 닫혔으면 false */
  send(event, data = {}) {
    if (typeof event !== 'string' || !event) throw new TypeError('event name is required');
    if (this.closed || this.res.writableEnded) return false;
    this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    return true;
  }

  close() {
    if (!this.res.writableEnded) this.res.end();
    this.closed = true;
  }
}

module.exports = { SseWriter };
