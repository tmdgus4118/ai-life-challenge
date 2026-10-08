/* 감지 화면: 마이크 → dB(1초) + YAMNet 분류(0.975초 창) → 평활화 → (+ 바닥 진동) → 사건 판정 → 서버 저장
 * 소음을 내는 쪽 모드에서는 기준에 가까워질 때 배려 알림을 띄운다 */
(function () {
  const { api, toast, openModal, closeModal, icon } = window.NS;
  const constants = window.NeighborSoundConstants;
  const rules = window.NeighborSoundThresholdRules;
  const { DecibelMeter, RollingWindow } = window.NeighborSoundDecibel;
  const AudioEngine = window.NSAudioEngine;
  const { ClassificationSmoother } = window.NeighborSoundSmoother;
  const { EventDetector } = window.NeighborSoundEventDetector;
  const { ExclusionToggle } = window.NeighborSoundExclusionToggle;
  const { VibrationMeter } = window.NeighborSoundVibration;
  const { CareAlert } = window.NeighborSoundCareAlert;

  const main = document.getElementById('main');
  const settings = JSON.parse(main.dataset.settings);
  const thresholds = JSON.parse(main.dataset.thresholds);
  const MODEL_URLS = [main.dataset.modelUrl, '/models/yamnet/model.json', 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1'].filter(Boolean);
  const CLASS_MAP_URL = '/models/yamnet_class_map.csv';
  const MAPPING_URL = '/config/source-mapping.json';

  const el = {
    card: document.getElementById('detectCard'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    sourceIcon: document.getElementById('sourceIcon'),
    sourceLabel: document.getElementById('sourceLabel'),
    sourceMeta: document.getElementById('sourceMeta'),
    gaugeFill: document.getElementById('gaugeFill'),
    gaugeLimit: document.getElementById('gaugeLimit'),
    gaugeLimitText: document.getElementById('gaugeLimitText'),
    dbValue: document.getElementById('dbValue'),
    levelWord: document.getElementById('levelWord'),
    limitLabel: document.getElementById('limitLabel'),
    bars: Array.from(document.querySelectorAll('#waveBars .bars__bar')),
    recordBtn: document.getElementById('recordBtn'),
    recordLabel: document.getElementById('recordLabel'),
    excludeBtn: document.getElementById('excludeBtn'),
    excludeLabel: document.getElementById('excludeLabel'),
    excludeHint: document.getElementById('excludeHint'),
    recentList: document.getElementById('recentList'),
    guideModal: document.getElementById('guideModal'),
    guideOk: document.getElementById('guideOk'),
    topkList: document.getElementById('topkList'),
    topkMeta: document.getElementById('topkMeta'),
    sessionStat: document.getElementById('sessionStat'),
    sessionMinutes: document.getElementById('sessionMinutes'),
    sessionEvents: document.getElementById('sessionEvents'),
    sessionExceeded: document.getElementById('sessionExceeded'),
    dimBtn: document.getElementById('dimBtn'),
    nightCover: document.getElementById('nightCover'),
    nightClock: document.getElementById('nightClock'),
    nightDb: document.getElementById('nightDb'),
    nightEvents: document.getElementById('nightEvents'),
    sessionModal: document.getElementById('sessionModal'),
    sessionKv: document.getElementById('sessionKv'),
    sessionNote: document.getElementById('sessionNote'),
    vibRow: document.getElementById('vibRow'),
    vibFill: document.getElementById('vibFill'),
    vibState: document.getElementById('vibState'),
    careBanner: document.getElementById('careBanner'),
    careTitle: document.getElementById('careTitle'),
    careBody: document.getElementById('careBody'),
    nightAlert: document.getElementById('nightAlert'),
  };
  const careOn = settings.role === 'maker' && Boolean(settings.care_alert) && Boolean(el.careBanner);

  const state = {
    running: false,
    exclusion: null,
    engine: new AudioEngine({ modelUrls: MODEL_URLS, classMapUrl: CLASS_MAP_URL, mappingUrl: MAPPING_URL, confidenceThreshold: settings.confidence_threshold }),
    meter: new DecibelMeter({ offset: settings.db_offset }),
    minuteWindow: new RollingWindow(60),
    smoother: new ClassificationSmoother({ windowSize: 3, confidenceThreshold: settings.confidence_threshold }),
    detector: null,
    lastClass: { group: 'other', confidence: 0, topClass: null },
    topk: [],
    session: { startedAt: null, events: 0, exceeded: 0, sources: {}, maxDb: null, vibEvents: 0, vibMeasured: false },
    vib: new VibrationMeter(),
    vibOn: false,
    vibSeen: false,
    vibStartedAt: 0,
    care: new CareAlert(),
    careTimer: null,
    wakeLock: null,
    wasExceeding: false,
    tickTimer: null,
    classifyTimer: null,
    lastTen: [],
    pending: [],
    recent: [],
  };

  const isExcluded = () => Boolean(state.exclusion && state.exclusion.isOn);

  const renderExcludeButton = () => {
    const on = isExcluded();
    el.excludeBtn.classList.toggle('is-on', on);
    el.excludeBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.excludeLabel.textContent = on ? '우리 집 소리 제외 중 ' + state.exclusion.formatElapsed() : '지금은 우리 집';
    el.excludeHint.textContent = on ? '(다시 누르면 해제)' : '(누르면 제외 시작)';
  };

  const setStatus = (text, mode) => {
    el.statusText.textContent = text;
    el.statusDot.className = 'status-dot' + (mode ? ' is-' + mode : '');
  };

  const groupOf = (key) => constants.getSourceGroup(key) || constants.getSourceGroup('other');
  const ko = (name) => (name && window.NeighborSoundLabExplain ? window.NeighborSoundLabExplain.koName(name) : name);

  const currentLimit = (group, at = new Date()) => rules.getCurrentLimit(group, at.getHours(), thresholds, settings);

  /* ---------- UI ---------- */
  const renderGauge = (db, limit, exceeding) => {
    const min = 20; const max = 90;
    const ratio = Math.min(1, Math.max(0, (db - min) / (max - min)));
    const len = 251.3;
    el.gaugeFill.style.strokeDashoffset = String(len - len * ratio);
    el.gaugeFill.classList.toggle('is-exceeding', exceeding);
    el.dbValue.textContent = db === null ? '—' : Math.round(db);
    el.dbValue.classList.toggle('is-idle', db === null);
    el.dbValue.classList.toggle('is-exceeding', exceeding);
    // Apple 소음 앱처럼 숫자 아래 상태 단어 하나
    let level = 'idle'; let word = '대기 중';
    if (db !== null) {
      if (db > limit.limit) { level = 'over'; word = '기준 초과'; }
      else if (db > limit.limit - 6) { level = 'near'; word = '기준에 가까움'; }
      else { level = 'ok'; word = '조용함'; }
    }
    if (el.levelWord.dataset.level !== level) { el.levelWord.dataset.level = level; el.levelWord.textContent = word; }
    const angle = Math.PI * (1 - Math.min(1, Math.max(0, (limit.limit - min) / (max - min))));
    const cx = 100; const cy = 110; const r1 = 68; const r2 = 94;
    el.gaugeLimit.setAttribute('x1', (cx + r1 * Math.cos(angle)).toFixed(1));
    el.gaugeLimit.setAttribute('y1', (cy - r1 * Math.sin(angle)).toFixed(1));
    el.gaugeLimit.setAttribute('x2', (cx + r2 * Math.cos(angle)).toFixed(1));
    el.gaugeLimit.setAttribute('y2', (cy - r2 * Math.sin(angle)).toFixed(1));
    el.gaugeLimitText.setAttribute('x', (cx + 104 * Math.cos(angle)).toFixed(1));
    el.gaugeLimitText.setAttribute('y', (cy - 104 * Math.sin(angle) + 3).toFixed(1));
    el.gaugeLimitText.textContent = '기준 ' + limit.limit + 'dB';
    el.limitLabel.textContent = (limit.is_night ? '야간' : '주간') + ' 기준 ' + limit.limit + 'dB (' + (limit.source_type === 'impact' ? '직접충격음 1분 평균' : '공기전달음 5분 평균') + ')';
  };

  const renderBars = () => {
    el.bars.forEach((bar, i) => {
      const s = state.lastTen[i];
      if (!s) { bar.style.transform = 'scaleY(0.04)'; bar.className = 'bars__bar'; return; }
      bar.style.transform = 'scaleY(' + (Math.max(4, Math.min(100, ((s.db - 20) / 70) * 100)) / 100) + ')';
      bar.className = 'bars__bar' + (s.excluded ? ' is-excluded' : s.exceeded ? ' is-exceeding' : '');
    });
  };

  const renderSource = (cls, exceeding) => {
    const g = groupOf(cls.group);
    el.sourceIcon.innerHTML = icon(g.icon, 'ico--xl');
    el.sourceIcon.className = 'source-display__icon' + (g.key === 'other' ? ' is-other' : '') + (exceeding ? ' is-exceeding' : '');
    el.sourceLabel.textContent = isExcluded() ? '우리 집 (제외 중)' : (g.key === 'other' ? '판정 제외 소리' : g.label);
    const cur = state.detector && state.detector.getCurrent();
    let meta = '';
    if (!state.engine.ready) meta = state.engine.failed ? '분류 모델 없음 · 데시벨만 기록' : '분류 모델 준비 중…';
    else if (cls.group === 'other') meta = cls.topClass ? '신뢰도 ' + Math.round(cls.confidence * 100) + '% (' + ko(cls.topClass) + ') · 판정 제외' : '분류 신뢰도 낮음 · 판정 제외';
    else meta = '신뢰도 ' + Math.round(cls.confidence * 100) + '%' + (cls.topClass ? ' · ' + ko(cls.topClass) : '');
    if (cur) meta += ' · 사건 진행 ' + cur.seconds + '초' + (cur.excluded_sec ? ' (제외 ' + cur.excluded_sec + '초)' : '') + (cur.vibration_sec ? ' · 진동 ' + cur.vibration_sec + '초' : '');
    el.sourceMeta.textContent = meta;
  };

  const renderTopk = () => {
    const items = el.topkList.querySelectorAll('.topk__item');
    items.forEach((li, i) => {
      const t = state.topk[i];
      if (!t) { li.classList.add('is-empty'); li.querySelector('.topk__name').textContent = '—'; li.querySelector('.topk__fill').style.transform = 'scaleX(0)'; li.querySelector('.topk__pct').textContent = '0%'; return; }
      li.classList.remove('is-empty');
      const g = t.group ? groupOf(t.group) : null;
      li.querySelector('.topk__name').innerHTML = (g && g.key !== 'other' ? icon(g.icon, 'ico--sm') + ' ' : '');
      li.querySelector('.topk__name').appendChild(document.createTextNode(ko(t.name)));
      li.querySelector('.topk__fill').style.transform = 'scaleX(' + Math.min(1, Math.max(0, t.score)).toFixed(3) + ')';
      li.querySelector('.topk__fill').className = 'topk__fill' + (g && g.key !== 'other' ? ' is-mapped' : '');
      li.querySelector('.topk__pct').textContent = Math.round(t.score * 100) + '%';
    });
  };

  const renderSession = () => {
    if (!state.session.startedAt) { el.sessionStat.hidden = true; return; }
    el.sessionStat.hidden = false;
    el.sessionMinutes.textContent = Math.max(0, Math.floor((Date.now() - state.session.startedAt) / 60000)) + '분';
    el.sessionEvents.textContent = state.session.events;
    el.sessionExceeded.textContent = state.session.exceeded;
  };

  /* ---------- 화면 꺼짐 방지 (밤새 감지) ---------- */
  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) return false;
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
      return true;
    } catch (e) {
      return false;
    }
  };
  const releaseWakeLock = () => { if (state.wakeLock) { state.wakeLock.release().catch(() => {}); state.wakeLock = null; } };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.running && !state.wakeLock) requestWakeLock();
  });

  /* ---------- 화면 어둡게 ---------- */
  const two = (n) => String(n).padStart(2, '0');
  const renderNight = (db) => {
    if (el.nightCover.hidden) return;
    const d = new Date();
    el.nightClock.textContent = two(d.getHours()) + ':' + two(d.getMinutes());
    if (typeof db === 'number') el.nightDb.textContent = Math.round(db);
    el.nightEvents.textContent = state.session.events;
  };
  const openNight = () => { el.nightCover.hidden = false; renderNight(null); };
  const closeNight = () => { el.nightCover.hidden = true; };
  el.dimBtn.addEventListener('click', openNight);
  el.nightCover.addEventListener('click', closeNight);
  el.nightCover.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNight(); });

  /* ---------- 감지 종료 요약 ---------- */
  const showSessionSummary = () => {
    const ses = state.session;
    if (!ses.startedAt) return;
    const sec = Math.round((Date.now() - ses.startedAt) / 1000);
    if (sec < 10) return;
    const mins = Math.floor(sec / 60);
    const dur = mins ? mins + '분 ' + (sec % 60) + '초' : sec + '초';
    const top = Object.entries(ses.sources).sort((a, b) => b[1] - a[1])[0];
    const topLabel = top ? (groupOf(top[0]).label + ' ' + top[1] + '건') : '없음';
    const rows = [['감지 시간', dur], ['기록된 사건', ses.events + '건'], ['기준 초과', ses.exceeded + '건'], ['가장 많은 소리', topLabel], ['가장 큰 소리', ses.maxDb !== null ? Math.round(ses.maxDb) + 'dB' : '-']];
    if (ses.vibMeasured) rows.push(['바닥 진동 동반 사건', ses.vibEvents + '건']);
    if (careOn) rows.push(['배려 알림', state.care.count + '회' + (state.care.overCount ? ' (기준 넘음 ' + state.care.overCount + '회)' : '')]);
    el.sessionKv.innerHTML = rows
      .map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');
    el.sessionNote.textContent = ses.events ? '사건은 기록 화면과 리포트에 반영되었습니다. 녹음은 저장되지 않았습니다.' : '기준을 넘어 3초 이상 이어진 소리가 없어 기록된 사건이 없습니다. 녹음은 저장되지 않았습니다.';
    openModal(el.sessionModal);
  };
  document.getElementById('sessionClose').addEventListener('click', () => closeModal(el.sessionModal));

  // 앱이 폰을 진동시키는 동안은 바닥 진동 측정을 쉰다 (자기 진동을 충격으로 오인하지 않게)
  const vibrate = (pattern) => {
    const total = (Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern) + 400;
    state.vib.suppress(total);
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  };

  /* ---------- 바닥 진동 ---------- */
  const renderVib = (v, text) => {
    if (!el.vibRow || el.vibRow.hidden) return;
    if (!v) {
      el.vibState.textContent = text;
      el.vibFill.style.transform = 'scaleX(0)';
      el.vibRow.classList.remove('is-impact');
      return;
    }
    el.vibFill.style.transform = 'scaleX(' + v.level.toFixed(3) + ')';
    el.vibRow.classList.toggle('is-impact', v.impact);
    el.vibState.textContent = v.impact ? '충격 진동 감지' : '측정 중';
  };
  const onMotion = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || typeof a.x !== 'number' || typeof a.y !== 'number' || typeof a.z !== 'number') return;
    state.vibSeen = true;
    try { state.vib.push({ x: a.x, y: a.y, z: a.z }, Date.now()); } catch (err) { /* 센서 값 이상은 무시 */ }
  };
  /** iOS는 사용자 동작 안에서 권한을 물어야 하므로 감지 시작 클릭에서 바로 부른다 */
  const requestMotion = () => {
    if (!settings.vibration_enabled || typeof window.DeviceMotionEvent === 'undefined') return Promise.resolve(false);
    if (typeof window.DeviceMotionEvent.requestPermission === 'function') {
      return window.DeviceMotionEvent.requestPermission().then((r) => r === 'granted').catch(() => false);
    }
    return Promise.resolve(true);
  };
  const startMotion = (granted) => {
    if (!settings.vibration_enabled) return;
    if (!granted) { renderVib(null, '진동 센서를 쓸 수 없어 소리만 기록합니다'); return; }
    state.vib.reset();
    state.vibSeen = false;
    state.vibStartedAt = Date.now();
    state.vibOn = true;
    window.addEventListener('devicemotion', onMotion);
    renderVib(null, '바닥 흔들림 기준을 잡는 중');
  };
  const stopMotion = () => {
    window.removeEventListener('devicemotion', onMotion);
    state.vibOn = false;
    renderVib(null, '감지를 시작하면 함께 잽니다');
  };
  const readVib = () => {
    if (!state.vibOn) return null;
    const v = state.vib.tick(Date.now());
    if (v.measured) {
      state.session.vibMeasured = true;
      renderVib(v);
      return { impact: v.impact, peak_mg: v.peak_mg };
    }
    if (v.suppressed) renderVib(null, '알림 진동 중 · 잠시 측정 쉼');
    else if (!state.vibSeen && Date.now() - state.vibStartedAt > 3000) renderVib(null, '이 기기는 진동 센서를 쓸 수 없습니다');
    return null;
  };

  /* ---------- 배려 알림 (소음을 내는 쪽) ---------- */
  const hideCare = () => {
    clearTimeout(state.careTimer);
    if (el.careBanner) el.careBanner.hidden = true;
    if (el.nightAlert) el.nightAlert.hidden = true;
  };
  const showCare = (alert, isNight) => {
    const text = CareAlert.describe(alert, { label: groupOf(alert.group).label, isNight });
    el.careTitle.textContent = text.title;
    el.careBody.textContent = text.body;
    el.careBanner.classList.toggle('is-over', alert.level === 'over');
    el.careBanner.hidden = false;
    if (el.nightAlert) { el.nightAlert.textContent = text.title + ' · ' + alert.db + 'dB'; el.nightAlert.hidden = false; }
    vibrate([80, 60, 80]);
    clearTimeout(state.careTimer);
    state.careTimer = setTimeout(hideCare, 8000);
  };

  const renderRecent = () => {
    const empty = document.getElementById('recentEmpty');
    if (state.recent.length && empty) empty.remove();
    state.recent.slice(0, 3).forEach((e) => {
      if (document.querySelector('[data-event-id="' + e.id + '"]')) return;
      const li = document.createElement('li');
      li.className = 'event-item is-new';
      li.dataset.eventId = e.id;
      setTimeout(() => li.classList.remove('is-new'), 1200);
      li.innerHTML = '<a class="event-item__link" href="/records?week=' + e.started_at.slice(0, 10) + '">' +
        '<span class="event-item__icon" aria-hidden="true">' + icon(e.source_icon) + '</span>' +
        '<span class="event-item__body"><span class="event-item__title">' + e.source_label + ' <span class="muted">' + e.date_label + ' ' + e.time_label + '</span></span>' +
        '<span class="event-item__meta">평균 ' + e.avg_db + 'dB · 최고 ' + e.max_db + 'dB · ' + e.duration_label + (e.has_vibration ? ' · 진동 동반' : '') + '</span></span>' +
        '<span class="badge ' + (e.exceeded ? 'badge--danger' : 'badge--ok') + '">' + (e.exceeded ? '기준 초과' : '기준 이내') + '</span></a>';
      el.recentList.prepend(li);
    });
    Array.from(el.recentList.querySelectorAll('.event-item')).slice(3).forEach((n) => n.remove());
  };

  /* ---------- 모델 ---------- */
  const prepareModel = async () => {
    setStatus('분류 모델 불러오는 중… (최초 1회, 약 4MB)', 'loading');
    const ok = await state.engine.load();
    if (ok) {
      setStatus('모델 준비 완료 · 감지 중', 'on');
    } else {
      const reason = state.engine.error ? state.engine.error.message : '오류';
      setStatus('분류 모델을 불러오지 못해 데시벨만 기록합니다 (' + reason + ')', 'error');
      toast('소음원 분류 모델을 불러오지 못했습니다. 데시벨 측정만 진행합니다.', { error: true, duration: 4000 });
    }
  };

  const classify = async () => {
    if (!state.running) return;
    const result = await state.engine.classify();
    if (!result) return;
    const { mapped, top } = result;
    const smoothed = state.smoother.push({ group: mapped.group, confidence: mapped.confidence });
    state.lastClass = { group: smoothed.group, confidence: smoothed.confidence, topClass: mapped.topClass };
    state.topk = top;
    renderTopk();
    el.topkMeta.textContent = state.engine.backendLabel + ' · ' + (settings.classify_interval_sec || 1) + '초마다 판별';
  };

  /* ---------- 1초 틱 ---------- */
  const tick = async () => {
    if (!state.running) return;
    const oneSec = state.engine.lastSeconds(1);
    if (oneSec.length === 0) return;
    const db = state.meter.measure(oneSec);
    state.minuteWindow.push(db);
    if (state.session.maxDb === null || db > state.session.maxDb) state.session.maxDb = db;
    renderNight(db);
    const now = new Date();
    const cls = state.lastClass;
    const group = state.engine.ready ? cls.group : 'other';
    const limit = currentLimit(group === 'other' ? 'footstep' : group, now);
    const exceeded = db > limit.limit && group !== 'other';
    const excluded = isExcluded();
    const sample = { at: now, group, db, exceeded, excluded, confidence: cls.confidence, vib: readVib() };
    if (careOn) {
      const alert = state.care.push({ at: now, group, db, limit: group === 'other' ? null : limit.limit, excluded });
      if (alert) showCare(alert, limit.is_night);
    }

    state.lastTen.push(sample);
    if (state.lastTen.length > 10) state.lastTen.shift();

    const finished = state.detector.push(sample);
    if (finished) queueEvent(finished);

    const nowExceeding = exceeded && !excluded;
    if (nowExceeding && !state.wasExceeding) vibrate(40);
    state.wasExceeding = nowExceeding;
    el.card.classList.toggle('is-exceeding', nowExceeding);
    document.body.classList.toggle('is-exceeding', nowExceeding);
    el.card.classList.toggle('is-excluded', excluded);
    renderSession();
    renderGauge(db, limit, exceeded && !excluded);
    renderBars();
    renderSource(cls, exceeded && !excluded);
    if (excluded) renderExcludeButton();
  };

  const queueEvent = (event) => {
    // 제외 구간은 판정기에서 이미 빠졌으므로 남은 소리만 저장한다. excluded_sec는 화면 안내용이라 서버로 보내지 않는다.
    const { excluded_sec: excludedSec, ...payload } = event;
    if (excludedSec) toast('우리 집 구간 ' + excludedSec + '초를 빼고 사건을 기록합니다.');
    state.session.events += 1;
    state.session.sources[event.source_group] = (state.session.sources[event.source_group] || 0) + 1;
    if (event.vibration_sec > 0) state.session.vibEvents += 1;
    vibrate([30, 60, 30]);
    state.pending.push(payload);
    flushEvents();
  };

  let flushing = false;
  const flushEvents = async () => {
    if (flushing || state.pending.length === 0) return;
    flushing = true;
    const batch = state.pending.splice(0, state.pending.length);
    try {
      const data = await api('/api/events', { method: 'POST', body: { events: batch } });
      state.recent = data.events.concat(state.recent).slice(0, 3);
      renderRecent();
      const ex = data.events.filter((e) => e.exceeded).length;
      state.session.exceeded += ex;
      renderSession();
      // 감지를 멈춘 직후에는 요약 창이 같은 내용을 보여 주므로 알림을 띄우지 않는다
      if (!state.running) return;
      toast(ex ? '사건 ' + data.count + '건 기록 · 기준 초과 ' + ex + '건' : '사건 ' + data.count + '건 기록 (기준 이내)');
    } catch (err) {
      state.pending.unshift(...batch);
      toast('사건 저장 실패: ' + err.message, { error: true });
    } finally {
      flushing = false;
    }
  };

  /* ---------- 마이크 ---------- */
  const start = async () => {
    const motionPermission = requestMotion();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('이 브라우저는 마이크를 지원하지 않습니다. 모바일 Chrome/Safari를 이용해 주세요.', { error: true, duration: 4000 });
      return;
    }
    el.recordBtn.disabled = true;
    setStatus('마이크 권한 요청 중…', 'loading');
    try {
      await state.engine.start();
    } catch (err) {
      setStatus('마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.', 'error');
      toast('마이크 권한이 필요합니다.', { error: true });
      el.recordBtn.disabled = false;
      return;
    }

    state.detector = new EventDetector({ minDurationSec: settings.min_duration_sec, quietEndSec: settings.quiet_end_sec });
    state.exclusion = new ExclusionToggle({ onChange: renderExcludeButton });
    renderExcludeButton();
    state.smoother.reset();
    state.minuteWindow.clear();
    state.lastTen = [];
    state.topk = [];
    renderTopk();
    state.session = { startedAt: Date.now(), events: 0, exceeded: 0, sources: {}, maxDb: null, vibEvents: 0, vibMeasured: false };
    state.care.reset();
    hideCare();
    renderSession();
    startMotion(await motionPermission);
    el.dimBtn.hidden = false;
    requestWakeLock().then((ok) => { if (!ok) toast('이 브라우저는 화면 꺼짐 방지를 지원하지 않습니다. 밤새 감지하려면 화면 자동 잠금을 꺼 주세요.', { duration: 4500 }); });
    state.running = true;
    el.recordBtn.classList.add('is-on');
    el.recordBtn.setAttribute('aria-pressed', 'true');
    el.recordBtn.setAttribute('aria-label', '감지 중지');
    el.recordLabel.textContent = '감지 중지';
    el.recordBtn.disabled = false;
    el.excludeBtn.disabled = el.excludeBtn.hidden;
    setStatus(settings.role === 'maker' ? '감지 중 · 우리 집 소리를 기록합니다' : '감지 중 · 폰을 바닥에 두고 기다려 주세요', 'on');

    state.tickTimer = setInterval(tick, 1000);
    if (!state.engine.ready && !state.engine.failed) await prepareModel();
    const interval = Math.max(1, settings.classify_interval_sec || 1) * 975;
    state.classifyTimer = setInterval(classify, interval);
  };

  const stop = () => {
    state.running = false;
    clearInterval(state.tickTimer);
    clearInterval(state.classifyTimer);
    if (state.detector) {
      const finished = state.detector.flush();
      if (finished) queueEvent(finished);
    }
    state.engine.stop();
    stopMotion();
    hideCare();
    releaseWakeLock();
    closeNight();
    el.dimBtn.hidden = true;
    if (state.exclusion) state.exclusion.reset();
    state.exclusion = null;
    el.recordBtn.classList.remove('is-on');
    el.recordBtn.setAttribute('aria-pressed', 'false');
    el.recordBtn.setAttribute('aria-label', '감지 시작');
    el.recordLabel.textContent = '감지 시작';
    el.excludeBtn.disabled = true;
    el.excludeBtn.classList.remove('is-on');
    el.excludeBtn.setAttribute('aria-pressed', 'false');
    el.excludeLabel.textContent = '지금은 우리 집';
    el.excludeHint.textContent = '(누르면 제외 시작)';
    el.card.classList.remove('is-exceeding', 'is-excluded');
    document.body.classList.remove('is-exceeding');
    state.wasExceeding = false;
    setStatus('감지 중지됨 · 녹음은 저장되지 않았습니다 (이번 감지 사건 ' + state.session.events + '건)', null);
    // 멈춘 뒤에는 마지막 측정값을 지우고 대기 상태로 되돌린다
    state.lastClass = { group: 'other', confidence: 0, topClass: null };
    state.lastTen = [];
    state.topk = [];
    renderGauge(null, currentLimit('footstep'), false);
    renderBars();
    renderTopk();
    el.sourceIcon.innerHTML = icon('other', 'ico--xl');
    el.sourceIcon.className = 'source-display__icon is-other';
    el.sourceLabel.textContent = '소음원';
    el.sourceMeta.textContent = '감지를 시작하면 AI가 소리를 구분합니다';
    setTimeout(showSessionSummary, 400);
  };

  /* ---------- 이벤트 바인딩 ---------- */
  const GUIDE_KEY = 'ns_guide_seen';
  el.recordBtn.addEventListener('click', () => {
    if (state.running) { stop(); return; }
    let seen = false;
    try { seen = localStorage.getItem(GUIDE_KEY) === '1'; } catch (e) { seen = false; }
    if (!seen) { openModal(el.guideModal); return; }
    start();
  });
  el.guideOk.addEventListener('click', () => {
    try { localStorage.setItem(GUIDE_KEY, '1'); } catch (e) { /* ignore */ }
    closeModal(el.guideModal);
    start();
  });

  el.excludeBtn.addEventListener('click', () => {
    if (!state.running || !state.exclusion || el.excludeBtn.hidden) return;
    const on = state.exclusion.toggle();
    toast(on ? '우리 집 소리 제외를 시작했습니다. 끝나면 다시 눌러 주세요.' : '제외를 해제했습니다. 다시 기록합니다.');
  });

  window.addEventListener('pagehide', () => { if (state.running) stop(); });
  renderGauge(null, currentLimit('footstep'), false);
})();
