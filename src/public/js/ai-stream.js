/* AI 생성 화면 공통: "생각 중…" → 글자 스트리밍 → 완료. 서버 SSE를 fetch로 읽는다. */
(function () {
  const { getUserId } = window.NS;

  /** SSE(POST) 호출. 입력 오류는 JSON 응답이므로 예외로 던진다 */
  const streamApi = async (path, body, onEvent, { signal } = {}) => {
    const headers = { Accept: 'text/event-stream', 'Content-Type': 'application/json' };
    const userId = getUserId();
    if (userId) headers['X-User-Id'] = userId;
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body || {}), credentials: 'same-origin', signal });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || type.indexOf('text/event-stream') === -1) {
      let message = '요청에 실패했습니다 (' + res.status + ')';
      try { const data = await res.json(); if (data && data.error) message = data.error.message; } catch (e) { /* ignore */ }
      throw new Error(message);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = 'message'; let data = '';
        block.split('\n').forEach((line) => {
          if (line.indexOf('event: ') === 0) event = line.slice(7);
          else if (line.indexOf('data: ') === 0) data += line.slice(6);
        });
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (e) { parsed = null; }
        onEvent(event, parsed);
      }
    }
  };

  /** 글이 써지는 영역 (div) */
  class AiStreamView {
    constructor(el) {
      if (!el) throw new Error('target element required');
      this.el = el;
      this.text = '';
      this.thinking = false;
    }

    showThinking(label) {
      this.text = '';
      this.thinking = true;
      this.el.classList.remove('is-empty');
      this.el.classList.add('is-streaming');
      this.el.innerHTML = '<span class="ai-thinking" role="status"><span class="ai-thinking__spinner" aria-hidden="true"></span>' +
        '<span class="ai-thinking__label"></span><span class="ai-thinking__dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></span>';
      this.el.querySelector('.ai-thinking__label').textContent = label || '생각 중';
    }

    append(chunk) {
      if (this.thinking) {
        this.thinking = false;
        this.el.innerHTML = '<span class="ai-live__text"></span><span class="ai-caret" aria-hidden="true"></span>';
      }
      this.text += chunk;
      this.el.querySelector('.ai-live__text').textContent = this.text;
    }

    finish(finalText) {
      this.thinking = false;
      this.el.classList.remove('is-streaming');
      this.text = typeof finalText === 'string' ? finalText : this.text;
      this.el.textContent = this.text;
      return this.text;
    }
  }

  /**
   * 생성 실행. handlers: onDone(data), onError(message), onStatus(text)
   */
  const runAiStream = async ({ path, body, view, onDone, onError, onStatus }) => {
    const status = (t) => { if (onStatus) onStatus(t); };
    view.showThinking('생각 중');
    status('AI가 기록을 읽고 글을 구상하고 있습니다');
    let finished = false;
    try {
      await streamApi(path, body, (event, data) => {
        if (event === 'attempt' && data && data.attempt > 1) {
          view.showThinking('표현을 다듬어 다시 쓰는 중');
        } else if (event === 'delta' && data) {
          if (view.thinking) status('작성 중');
          view.append(data.text);
        } else if (event === 'retry') {
          view.showThinking('검사에서 걸린 표현을 고치는 중');
          status('감정·위협 표현 또는 입력에 없는 숫자가 있어 다시 작성합니다');
        } else if (event === 'fallback') {
          view.showThinking('정리된 문장으로 다시 쓰는 중');
          status('AI 결과가 검사를 통과하지 못해 규칙 기반 문장으로 작성합니다');
        } else if (event === 'done') {
          finished = true;
          onDone(data);
        } else if (event === 'error') {
          finished = true;
          view.finish('');
          onError((data && data.message) || '생성에 실패했습니다.');
        }
      });
      if (!finished) { view.finish(''); onError('연결이 끊겼습니다. 다시 시도해 주세요.'); }
    } catch (err) {
      view.finish('');
      onError(err.message);
    }
  };

  window.NSAi = { streamApi, AiStreamView, runAiStream };
})();
