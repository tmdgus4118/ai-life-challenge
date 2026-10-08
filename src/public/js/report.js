/* 리포트 화면: AI 요약문 "생각 중…" → 스트리밍 생성, PDF 저장 */
(function () {
  const { toast, api, copyText } = window.NS;
  const { AiStreamView, runAiStream } = window.NSAi;
  const main = document.getElementById('main');
  const days = Number(main.dataset.days) || 7;
  const btn = document.getElementById('regenBtn');
  const text = document.getElementById('aiText');
  const meta = document.getElementById('aiMeta');
  const view = new AiStreamView(text);

  const generate = async () => {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = '작성 중…';
    await runAiStream({
      path: '/api/reports/generate/stream',
      body: { days },
      view,
      onStatus: (s) => { meta.textContent = s; },
      onDone: (data) => {
        view.finish(data.report.ai_text);
        const provider = data.report.provider === 'template' ? '규칙 기반 작성' : 'AI 작성';
        meta.textContent = '방금 생성 · ' + provider + (data.report.fallback ? ' · 안전장치로 대체문 사용' : '') + ' · 생성 ' + data.report.attempts + '회';
        btn.textContent = '다시 생성';
        btn.disabled = false;
      },
      onError: (message) => {
        text.textContent = '요약문을 만들지 못했습니다. 다시 생성을 눌러 주세요.';
        meta.textContent = message;
        toast(message, { error: true });
        btn.textContent = original;
        btn.disabled = false;
      },
    });
  };
  btn.addEventListener('click', generate);

  // 요약문이 없고 사건이 있으면 자동 생성
  if (text.classList.contains('is-empty') && !/기록된 사건이 없어/.test(text.textContent)) {
    generate();
  }

  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      try {
        const summary = JSON.parse(main.dataset.summary);
        const canvas = document.getElementById('shareCanvas');
        const aiText = text.classList.contains('is-empty') || text.classList.contains('is-streaming') ? '' : text.textContent.trim();
        window.NSShareCard.draw(canvas, summary, aiText, main.dataset.role);
        const result = await window.NSShareCard.share(canvas, 'neighbor-sound-report-' + summary.period.to + '.png');
        toast(result === 'shared' ? '공유했습니다.' : '리포트 이미지를 저장했습니다. 메신저로 전달하세요.');
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        toast('이미지를 만들지 못했습니다: ' + err.message, { error: true });
      }
    });
  }

  /* ---------- 기록에게 묻기 ---------- */
  const thread = document.getElementById('askThread');
  const askForm = document.getElementById('askForm');
  const askInput = document.getElementById('askInput');
  const askSend = document.getElementById('askSend');
  const chips = Array.from(document.querySelectorAll('.ask-chip'));
  let asking = false;
  const setBusy = (on) => { asking = on; askSend.disabled = on; askInput.disabled = on; chips.forEach((c) => { c.disabled = on; }); };
  const ask = async (body, questionText) => {
    if (asking) return;
    setBusy(true);
    const item = document.createElement('li');
    item.className = 'ask-item';
    item.innerHTML = '<p class="ask-item__q"></p><p class="ask-item__a"></p><p class="ask-item__meta muted small"></p>';
    item.querySelector('.ask-item__q').textContent = questionText;
    thread.prepend(item);
    const aView = new AiStreamView(item.querySelector('.ask-item__a'));
    const metaEl = item.querySelector('.ask-item__meta');
    await runAiStream({
      path: '/api/reports/ask/stream',
      body: { days, ...body },
      view: aView,
      onStatus: (s) => { metaEl.textContent = s; },
      onDone: (data) => {
        aView.finish(data.answer);
        metaEl.textContent = (data.provider === 'template' ? '규칙 기반 답변' : 'AI 답변') + (data.fallback ? ' · 안전장치로 대체문 사용' : '') + ' · 저장되지 않음';
        setBusy(false);
      },
      onError: (message) => { metaEl.textContent = message; toast(message, { error: true }); setBusy(false); },
    });
  };
  chips.forEach((c) => c.addEventListener('click', () => ask({ question_key: c.dataset.key }, c.textContent)));
  if (askForm) {
    askForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = askInput.value.trim();
      if (!q) { askInput.focus(); return; }
      askInput.value = '';
      ask({ question: q }, q);
    });
  }

  /* ---------- 링크로 공유 (읽기 전용, 14일 뒤 만료) ---------- */
  const linkBtn = document.getElementById('linkBtn');
  const shareRow = document.getElementById('shareRow');
  const shareText = document.getElementById('shareText');
  let lastUrl = '';
  if (linkBtn) {
    linkBtn.addEventListener('click', async () => {
      linkBtn.disabled = true;
      try {
        const data = await api('/api/shares', { method: 'POST', body: { days } });
        lastUrl = data.share.url;
        const until = new Date(data.share.expires_at);
        shareText.textContent = lastUrl + ' · ' + (until.getMonth() + 1) + '월 ' + until.getDate() + '일까지 열람 가능 · 메모 제외';
        shareRow.hidden = false;
        try { await copyText(lastUrl); toast('공유 링크를 복사했습니다. 관리사무소나 이웃사이센터에 전달하세요.'); } catch (e) { toast('공유 링크를 만들었습니다. 아래에서 복사하세요.'); }
      } catch (err) {
        toast(err.message, { error: true });
      } finally {
        linkBtn.disabled = false;
      }
    });
    document.getElementById('shareCopy').addEventListener('click', async () => {
      try { await copyText(lastUrl); toast('복사했습니다.'); } catch (e) { toast('복사에 실패했습니다.', { error: true }); }
    });
  }

  const pdf = document.getElementById('pdfBtn');
  pdf.addEventListener('click', (e) => {
    e.preventDefault();
    window.open(pdf.getAttribute('href') + '&autoprint=1', '_blank', 'noopener');
  });
})();
