/* 감지 화면: 소리 파일로 AI 체험 (파일은 기기 밖으로 나가지 않음) */
(function () {
  const { toast, icon } = window.NS;
  const groups = window.NeighborSoundConstants.SOURCE_GROUPS;
  const main = document.getElementById('main');
  const input = document.getElementById('fileInput');
  if (!input) return;
  const label = document.getElementById('filePickLabel');
  const box = document.getElementById('fileResult');
  const progress = document.getElementById('fileProgress');
  const summary = document.getElementById('fileSummary');
  const strip = document.getElementById('fileStrip');
  const groupList = document.getElementById('fileGroups');
  const frameList = document.getElementById('fileFrames');
  const settings = JSON.parse(main.dataset.settings || '{}');
  const MODEL_URLS = [main.dataset.modelUrl, '/models/yamnet/model.json', 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1'].filter(Boolean);
  let engine = null;
  const groupOf = (k) => groups.find((g) => g.key === k) || groups[groups.length - 1];
  const ko = (name) => (window.NeighborSoundLabExplain ? window.NeighborSoundLabExplain.koName(name) : name);

  const render = (result, name) => {
    const frames = result.frames;
    const counts = {};
    frames.forEach((f) => { counts[f.mapped.group] = (counts[f.mapped.group] || 0) + 1; });
    const ranked = Object.entries(counts).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1]);
    if (ranked.length) {
      const [k, n] = ranked[0];
      summary.textContent = '"' + name + '"에서 가장 많이 들린 소리는 ' + groupOf(k).label + '입니다 (' + frames.length + '번 판별 중 ' + n + '번, ' + Math.round((n / frames.length) * 100) + '%).' + (result.truncated ? ' 앞 60초만 분석했습니다.' : '');
    } else {
      summary.textContent = '"' + name + '"에서는 7개 소음원으로 확실하게 분류된 소리가 없었습니다. 신뢰도가 낮은 소리는 판정에서 제외됩니다.';
    }
    strip.innerHTML = frames.map((f) => '<i class="file-strip__cell' + (f.mapped.group === 'other' ? ' is-other' : '') + '" title="' + f.at + '초 · ' + groupOf(f.mapped.group).label + ' ' + Math.round(f.mapped.confidence * 100) + '%"></i>').join('');
    groupList.innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
      const g = groupOf(k);
      return '<li>' + icon(g.icon, 'ico--sm') + '<span>' + g.label + '</span><b>' + n + '번</b></li>';
    }).join('');
    frameList.innerHTML = frames.slice(0, 12).map((f) => {
      const g = groupOf(f.mapped.group);
      const top = f.top[0] ? ko(f.top[0].name) + ' ' + Math.round(f.top[0].score * 100) + '%' : '';
      return '<li><span class="muted">' + f.at.toFixed(1) + '초</span> <strong>' + g.label + '</strong> <span class="muted">' + top + '</span></li>';
    }).join('') + (frames.length > 12 ? '<li class="muted">… 외 ' + (frames.length - 12) + '번</li>' : '');
  };

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    box.hidden = false;
    summary.textContent = '분류 모델을 준비하고 있습니다…';
    strip.innerHTML = ''; groupList.innerHTML = ''; frameList.innerHTML = '';
    progress.style.transform = 'scaleX(0)';
    label.textContent = '분석 중';
    try {
      if (!engine) engine = new window.NSAudioEngine({ modelUrls: MODEL_URLS, confidenceThreshold: settings.confidence_threshold || 0.3 });
      const result = await engine.analyzeFile(file, {
        onProgress: (ratio, last) => {
          progress.style.transform = 'scaleX(' + ratio.toFixed(3) + ')';
          if (last) summary.textContent = Math.round(ratio * 100) + '% · 지금 판별: ' + groupOf(last.mapped.group).label + ' (' + (last.top[0] ? ko(last.top[0].name) : '') + ')';
        },
      });
      if (!result.frames.length) throw new Error('분석할 소리가 너무 짧습니다. 1초 이상인 파일을 골라 주세요.');
      render(result, file.name);
    } catch (err) {
      summary.textContent = err.message;
      toast(err.message, { error: true });
    } finally {
      label.textContent = '다른 파일 고르기';
      input.value = '';
    }
  });
})();
