/* 분류 정확도 측정: 1초마다 분류해 정답과 비교하고, 무슨 소리로 들었는지 결과 카드로 남긴다 */
(function () {
  const { api, toast, icon } = window.NS;
  const { koName, explain } = window.NeighborSoundLabExplain;
  const main = document.getElementById('main');
  const MODEL_URLS = [main.dataset.modelUrl, '/models/yamnet/model.json', 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1'].filter(Boolean);
  const engine = new window.NSAudioEngine({ modelUrls: MODEL_URLS, confidenceThreshold: Number(main.dataset.threshold) || 0.3 });
  const startBtn = document.getElementById('labStart');
  const label = startBtn.querySelector('span');
  const progress = document.getElementById('labProgress');
  const now = document.getElementById('labNow');
  const fileInput = document.getElementById('labFile');
  const fileLabel = document.getElementById('labFileLabel');
  const groups = window.NeighborSoundConstants.SOURCE_GROUPS;
  const SECONDS = 10;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const groupOf = (k) => groups.find((g) => g.key === k) || groups[groups.length - 1];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (v) => Math.round(v * 100) + '%';
  const topText = (top) => (top && top[0] ? koName(top[0].name) + ' ' + pct(top[0].score) : '');

  const el = {
    box: document.getElementById('labResult'),
    verdict: document.getElementById('labVerdict'),
    compare: document.getElementById('labCompare'),
    hitRate: document.getElementById('labHitRate'),
    strip: document.getElementById('labStrip'),
    groups: document.getElementById('labGroups'),
    heard: document.getElementById('labHeard'),
    reason: document.getElementById('labReason'),
    tips: document.getElementById('labTips'),
    frames: document.getElementById('labFrames'),
  };

  /** 결과 카드: 다음 측정 전까지 화면에 남는다 */
  const renderResult = (frames, expected, predicted) => {
    const r = explain(frames, { expected, predicted, groups });
    el.verdict.className = 'badge ' + (r.correct ? 'badge--ok' : 'badge--danger');
    el.verdict.textContent = r.correct ? '맞았습니다' : '틀렸습니다';
    el.compare.innerHTML = '틀어 놓은 소리 <strong>' + esc(r.expected_label) + '</strong> → AI 판정 <strong>' + esc(r.predicted_label) + '</strong>';
    el.hitRate.textContent = '· ' + r.total + '번 중 ' + r.frame_hits + '번 일치 (' + r.frame_accuracy + '%)';
    el.strip.innerHTML = frames.map((f, i) => {
      const cls = f.group === expected ? '' : (f.group === 'other' ? ' is-other' : ' is-miss');
      return '<i class="file-strip__cell' + cls + '" title="' + esc((f.at !== undefined ? f.at.toFixed(1) : i + 1) + '초 · ' + groupOf(f.group).label + ' ' + pct(f.confidence)) + '"></i>';
    }).join('');
    el.groups.innerHTML = r.distribution.map((d) => '<li' + (d.key === expected ? ' class="is-hit"' : '') + '>' + icon(groupOf(d.key).icon, 'ico--sm') + '<span>' + esc(d.label) + '</span><b>' + d.count + '번</b></li>').join('');
    el.heard.innerHTML = r.heard.length
      ? r.heard.map((h) => '<li><span>' + esc(h.ko) + '</span>' + (h.ko !== h.name ? '<span class="muted">' + esc(h.name) + '</span>' : '') + '<b>' + h.count + '번</b></li>').join('')
      : '<li class="muted">들은 소리 정보가 없습니다.</li>';
    el.reason.textContent = r.reason;
    el.tips.hidden = !r.tips.length;
    el.tips.innerHTML = r.tips.map((t) => '<li>' + esc(t) + '</li>').join('');
    el.frames.innerHTML = frames.map((f, i) => {
      const at = f.at !== undefined ? f.at.toFixed(1) : String(i + 1);
      const others = (f.top || []).slice(1).map((t) => koName(t.name) + ' ' + pct(t.score)).join(', ');
      return '<li><span class="muted">' + at + '초</span> <strong>' + esc(groupOf(f.group).label) + '</strong> <span>' + esc(topText(f.top)) + '</span>' + (others ? ' <span class="muted">· ' + esc(others) + '</span>' : '') + '</li>';
    }).join('');
    el.box.hidden = false;
    el.box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  /** 정확도 요약 칸은 서버가 그린 화면으로 바꿔 끼운다 (새로고침 없이) */
  const refreshStats = async () => {
    try {
      const html = await fetch(window.location.pathname, { credentials: 'same-origin' }).then((res) => res.text());
      const next = new DOMParser().parseFromString(html, 'text/html').getElementById('labStats');
      const cur = document.getElementById('labStats');
      if (next && cur) cur.replaceWith(next);
    } catch (e) { /* 요약 갱신 실패는 결과 카드에 영향 없음 */ }
  };

  const save = async (frames, expected) => {
    const payload = frames.slice(0, 120).map((f) => ({ group: f.group, confidence: f.confidence, top_class: f.top_class }));
    const data = await api('/api/lab/runs', { method: 'POST', body: { expected_group: expected, frames: payload } });
    renderResult(frames, expected, data.run.predicted_group);
    await refreshStats();
  };

  const toFrame = (r, at) => ({ group: r.mapped.group, confidence: r.mapped.confidence, top_class: r.mapped.topClass, top: r.top || [], at });

  const resetControls = () => {
    label.textContent = '마이크로 10초 측정';
    fileLabel.textContent = '소리 파일로 측정';
    startBtn.disabled = false;
    fileInput.disabled = false;
  };

  startBtn.addEventListener('click', async () => {
    const expected = (document.querySelector('input[name="expected"]:checked') || {}).value;
    if (!expected) return;
    startBtn.disabled = true;
    fileInput.disabled = true;
    try {
      label.textContent = '마이크 준비 중';
      await engine.start();
      label.textContent = '분류 모델 불러오는 중';
      if (!(await engine.load())) throw new Error('분류 모델을 불러오지 못했습니다.');
      const frames = [];
      for (let i = 0; i < SECONDS; i += 1) {
        label.textContent = '측정 중 ' + (SECONDS - i) + '초';
        await wait(1000);
        const r = await engine.classify();
        if (r) {
          frames.push(toFrame(r, i + 1));
          now.textContent = (i + 1) + '초: ' + groupOf(r.mapped.group).label + ' · ' + pct(r.mapped.confidence) + (r.top[0] ? ' (AI가 들은 소리: ' + topText(r.top) + ')' : '');
        }
        progress.style.transform = 'scaleX(' + ((i + 1) / SECONDS).toFixed(3) + ')';
      }
      engine.stop();
      if (!frames.length) throw new Error('분류 결과가 없습니다. 소리를 더 가까이에서 틀어 주세요.');
      await save(frames, expected);
      now.textContent = '측정이 끝났습니다. 아래 결과를 확인하세요.';
    } catch (err) {
      engine.stop();
      toast(err.message || '측정에 실패했습니다.', { error: true });
      progress.style.transform = 'scaleX(0)';
    } finally {
      resetControls();
    }
  });

  // 소리 파일로 측정 (앞 30초)
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    const expected = (document.querySelector('input[name="expected"]:checked') || {}).value;
    if (!file || !expected) return;
    fileLabel.textContent = '분석 중';
    startBtn.disabled = true;
    try {
      const result = await engine.analyzeFile(file, {
        maxSeconds: 30,
        onProgress: (ratio, last) => {
          progress.style.transform = 'scaleX(' + ratio.toFixed(3) + ')';
          if (last) now.textContent = last.at.toFixed(1) + '초: ' + groupOf(last.mapped.group).label + ' · ' + pct(last.mapped.confidence) + (last.top[0] ? ' (AI가 들은 소리: ' + topText(last.top) + ')' : '');
        },
      });
      const frames = result.frames.map((f) => toFrame(f, f.at));
      if (!frames.length) throw new Error('분석할 소리가 너무 짧습니다. 1초 이상인 파일을 골라 주세요.');
      await save(frames, expected);
      now.textContent = '"' + file.name + '" 분석이 끝났습니다. 아래 결과를 확인하세요.';
    } catch (err) {
      toast(err.message || '측정에 실패했습니다.', { error: true });
      progress.style.transform = 'scaleX(0)';
    } finally {
      fileInput.value = '';
      resetControls();
    }
  });

  // 기록 지우기 버튼은 요약 칸이 바뀌어도 동작하도록 위임
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('#labClear')) return;
    try {
      await api('/api/lab/runs', { method: 'DELETE' });
      el.box.hidden = true;
      await refreshStats();
      toast('측정 기록을 지웠습니다.');
    } catch (err) { toast(err.message, { error: true }); }
  });
})();
