/* 중재 화면: "생각 중…" → 스트리밍으로 초안 작성 → 직접 수정·복사, 다음 단계 갱신 */
(function () {
  const { toast, copyText, api } = window.NS;
  const { AiStreamView, runAiStream } = window.NSAi;
  const main = document.getElementById('main');
  const recipient = main.dataset.recipient;
  const tone = main.dataset.tone;
  const max = Number(main.dataset.max) || 300;
  const body = document.getElementById('messageBody');
  const live = document.getElementById('messageLive');
  const count = document.getElementById('charCount');
  const meta = document.getElementById('draftMeta');
  const genBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const stepNote = document.getElementById('stepNote');
  const stepList = document.getElementById('stepList');
  const view = new AiStreamView(live);
  const deliverRow = document.getElementById('deliverRow');
  const deliveredCheck = document.getElementById('deliveredCheck');
  const deliveredLabel = document.getElementById('deliveredLabel');
  const genLabel = genBtn.querySelector('span');

  const updateCount = (len) => { count.textContent = (typeof len === 'number' ? len : body.value.length) + '/' + max; copyBtn.disabled = body.value.trim().length === 0 || !live.hidden; };
  body.addEventListener('input', () => updateCount());
  updateCount();

  const scopeNote = document.getElementById('scopeNote');
  const renderSteps = (ns) => {
    stepNote.textContent = ns.note;
    scopeNote.hidden = !ns.scope_note;
    scopeNote.textContent = ns.scope_note || '';
    stepList.innerHTML = ns.steps.map((st) => '<li class="step step--' + st.status + '"><span class="step__num" aria-hidden="true">' + st.step + '</span><div class="step__body"><div class="step__title">' + st.title +
      (st.status === 'current' ? ' <span class="badge badge--primary">현재 단계</span>' : st.status === 'done' ? ' <span class="badge badge--ok">진행함</span>' : '') +
      '</div><p class="step__desc">' + st.description + '</p></div></li>').join('');
  };

  const showLive = (on) => {
    live.hidden = !on;
    body.hidden = on;
    copyBtn.disabled = on || body.value.trim().length === 0;
  };

  // 글자 수는 스트리밍 중에도 갱신
  const origAppend = view.append.bind(view);
  view.append = (chunk) => { origAppend(chunk); updateCount(view.text.length); };

  genBtn.addEventListener('click', async () => {
    genBtn.disabled = true;
    const original = genLabel.textContent;
    genLabel.textContent = '작성 중';
    showLive(true);
    await runAiStream({
      path: '/api/messages/generate/stream',
      body: { recipient, tone, days: 7 },
      view,
      onStatus: (s) => { meta.textContent = s; },
      onDone: (data) => {
        view.finish(data.message.body);
        body.value = data.message.body;
        showLive(false);
        updateCount();
        meta.textContent = '방금 생성 · ' + (data.message.provider === 'template' ? '규칙 기반 작성' : 'AI 작성') + (data.message.fallback ? ' · 안전장치로 대체문 사용' : '') + ' · 감정·위협 표현 검사 통과 · 직접 수정할 수 있습니다';
        renderSteps(data.next_step);
        deliverRow.hidden = false;
        deliverRow.dataset.id = data.message.id;
        deliveredCheck.checked = false;
        deliveredLabel.textContent = '직접 보낸 뒤 체크하면 다음 단계 안내가 전달일 기준으로 바뀝니다';
        genLabel.textContent = '다시 생성';
        genBtn.disabled = false;
      },
      onError: (message) => {
        showLive(false);
        meta.textContent = message;
        toast(message, { error: true });
        genLabel.textContent = original;
        genBtn.disabled = false;
      },
    });
  });

  deliveredCheck.addEventListener('change', async () => {
    const id = deliverRow.dataset.id;
    if (!id) return;
    deliveredCheck.disabled = true;
    try {
      const data = await api('/api/messages/' + id + '/delivered', { method: 'PATCH', body: { delivered: deliveredCheck.checked } });
      renderSteps(data.next_step);
      deliveredLabel.textContent = data.message.delivered_at ? '오늘 전달 · 이날부터 2주 동안 기록을 지켜봅니다' : '직접 보낸 뒤 체크하면 다음 단계 안내가 전달일 기준으로 바뀝니다';
      toast(data.message.delivered_at ? '전달했다고 기록했습니다. 다음 단계 안내가 바뀌었습니다.' : '전달 표시를 취소했습니다.');
    } catch (err) {
      deliveredCheck.checked = !deliveredCheck.checked;
      toast(err.message, { error: true });
    } finally {
      deliveredCheck.disabled = false;
    }
  });

  document.querySelectorAll('.history__copy').forEach((b) => b.addEventListener('click', async () => {
    try { await copyText(b.dataset.body); toast('이전 메시지를 복사했습니다.'); } catch (err) { toast('복사에 실패했습니다.', { error: true }); }
  }));

  copyBtn.addEventListener('click', async () => {
    try {
      await copyText(body.value);
      toast('복사했습니다. 메시지 앱에 붙여 넣어 직접 전달하세요.');
    } catch (err) {
      toast('복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.', { error: true });
    }
  });
})();
