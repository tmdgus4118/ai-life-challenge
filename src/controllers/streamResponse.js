/**
 * 생성 작업을 SSE로 중계한다. 입력 검증은 호출 전에 끝내 두어(400 JSON) 스트림을 연 뒤에는 생성 오류만 다룬다.
 * 사용자가 화면을 떠나 연결이 끊기면 생성을 중단한다.
 * @param {import('../utils/sse').SseWriter} sse
 * @param {import('express').Response} res
 * @param {(opts:{onEvent:Function, signal:AbortSignal}) => Promise<any>} run
 * @param {(result:any) => object} toPayload
 */
const streamResponse = async (sse, res, run, toPayload) => {
  if (!sse || typeof run !== 'function' || typeof toPayload !== 'function') throw new TypeError('invalid arguments');
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const result = await run({ onEvent: (type, data) => sse.send(type, data), signal: controller.signal });
    sse.send('done', toPayload(result));
  } catch (err) {
    if (!controller.signal.aborted) {
      const message = err && err.status && err.status < 500 ? err.message : '생성 중 오류가 발생했습니다. 다시 시도해 주세요.';
      sse.send('error', { message });
    }
  } finally {
    sse.close();
  }
};

module.exports = { streamResponse };
