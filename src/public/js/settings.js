/* 설정 화면: 저장, 마이크 보정, 데모 데이터, 전체 삭제 */
(function () {
  const { api, toast, openModal, closeModal } = window.NS;
  const { DecibelMeter } = window.NeighborSoundDecibel;
  const form = document.getElementById('settingsForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {};
    const checks = ['legacy_building', 'vibration_enabled', 'care_alert'];
    fd.forEach((v, k) => {
      if (checks.includes(k)) return;
      body[k] = k === 'role' || k === 'theme' || k === 'text_size' ? v : Number(v);
    });
    checks.forEach((k) => { body[k] = form.elements[k].checked; });
    try {
      await api('/api/settings', { method: 'PUT', body });
      toast('설정을 저장했습니다.');
      // 역할·테마는 화면 전체 문구와 색에 영향을 주므로 다시 그린다
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      toast(err.message, { error: true });
    }
  });

  // 마이크 보정: 10초 동안 dBFS 측정
  const calibBtn = document.getElementById('calibrateBtn');
  const calibBox = document.getElementById('calibBox');
  const calibProgress = document.getElementById('calibProgress');
  const calibText = document.getElementById('calibText');
  calibBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('마이크를 지원하지 않는 브라우저입니다.', { error: true }); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (err) { toast('마이크 권한이 필요합니다.', { error: true }); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const values = [];
    calibBox.hidden = false;
    calibBtn.disabled = true;
    const total = 10000; const start = Date.now();
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        const rms = DecibelMeter.rms(buf);
        values.push(DecibelMeter.rmsToDbfs(rms));
        const elapsed = Date.now() - start;
        calibProgress.style.transform = 'scaleX(' + Math.min(1, elapsed / total).toFixed(3) + ')';
        calibText.textContent = '측정 중… ' + Math.ceil((total - elapsed) / 1000) + '초 남음 (조용히 기다려 주세요)';
        if (elapsed >= total) { clearInterval(timer); resolve(); }
      }, 200);
    });
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
    const valid = values.filter((v) => v > -120);
    const mean = valid.length ? DecibelMeter.energyMean(valid) : -60;
    try {
      const data = await api('/api/settings/calibrate', { method: 'POST', body: { measured_dbfs: Math.max(-120, Math.min(0, mean)) } });
      form.elements.db_offset.value = data.settings.db_offset;
      calibText.textContent = '측정 완료: 평균 ' + mean.toFixed(1) + ' dBFS → 오프셋 ' + data.settings.db_offset + 'dB 저장 (조용한 방 ≈ 30dB)';
      toast('마이크 보정값을 저장했습니다.');
    } catch (err) {
      calibText.textContent = '저장 실패: ' + err.message;
      toast(err.message, { error: true });
    } finally {
      calibBtn.disabled = false;
    }
  });

  document.getElementById('demoBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const data = await api('/api/data/demo', { method: 'POST' });
      toast('데모 데이터 ' + data.inserted + '건을 불러왔습니다 (기준 초과 ' + data.exceeded + '건). 기록 화면으로 이동합니다.');
      setTimeout(() => { window.location.href = '/records'; }, 900);
    } catch (err) {
      toast(err.message, { error: true });
      btn.disabled = false;
    }
  });

  const modal = document.getElementById('deleteAllModal');
  const confirmInput = document.getElementById('deleteAllConfirmInput');
  const confirmBtn = document.getElementById('deleteAllConfirm');
  document.getElementById('deleteAllBtn').addEventListener('click', () => { confirmInput.value = ''; confirmBtn.disabled = true; openModal(modal); });
  document.getElementById('deleteAllCancel').addEventListener('click', () => closeModal(modal));
  confirmInput.addEventListener('input', () => { confirmBtn.disabled = confirmInput.value.trim() !== '삭제'; });
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    try {
      const data = await api('/api/data', { method: 'DELETE' });
      closeModal(modal);
      toast('전체 기록을 삭제했습니다 (사건 ' + data.deleted.events + '건). ');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      toast(err.message, { error: true });
      confirmBtn.disabled = false;
    }
  });
})();
