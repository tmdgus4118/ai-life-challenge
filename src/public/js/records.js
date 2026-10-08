/* 기록 화면: 사건 상세 시트(dB 그래프·메모·삭제), 히트맵 칸 필터, 스와이프 삭제 */
(function () {
  const { api, toast, openModal, closeModal, icon } = window.NS;
  const sheet = document.getElementById('detailSheet');
  const memoForm = document.getElementById('memoForm');
  const memoInput = document.getElementById('memoInput');
  const deleteModal = document.getElementById('deleteModal');
  const limits = { impact: { day: 39, night: 34 }, airborne: { day: 45, night: 40 } };
  const groups = window.NeighborSoundConstants.SOURCE_GROUPS;
  let current = null;
  let deleteTarget = null;

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const readEvent = (li) => { try { return JSON.parse(li.dataset.event); } catch (e) { return null; } };

  const drawSpark = (svg, series, limit, vibSeries) => {
    const W = 320; const H = 110; const padL = 28; const padR = 8; const padT = 10; const padB = 20;
    svg.innerHTML = '';
    if (!series || !series.length) {
      svg.innerHTML = '<text x="160" y="60" text-anchor="middle" font-size="12" fill="' + css('--krds-gray-60') + '">저장된 dB 시퀀스가 없는 사건입니다</text>';
      return;
    }
    const vals = series.filter((v) => typeof v === 'number');
    const min = Math.min(20, ...vals, limit || 99) - 2;
    const max = Math.max(...vals, limit || 0) + 4;
    const x = (i) => padL + (i / Math.max(1, series.length - 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    let d = ''; let area = '';
    series.forEach((v, i) => {
      if (typeof v !== 'number') { d += ' M'; return; }
      const cmd = d.endsWith('M') || d === '' ? (d === '' ? 'M' : '') : ' L';
      d += (d === '' ? 'M' : cmd) + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
    });
    d = d.replace(/ M(?= M| L|$)/g, '').replace(/ M(\d)/g, ' M$1').replace(/M M/g, 'M');
    // 영역 채우기 (null 구간 포함 단순 처리)
    const pts = series.map((v, i) => (typeof v === 'number' ? [x(i), y(v)] : null)).filter(Boolean);
    if (pts.length) {
      area = 'M' + pts[0][0].toFixed(1) + ' ' + (H - padB) + ' ' + pts.map((p) => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - padB) + ' Z';
    }
    const ns = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs) => { const e = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
    let limitLabel = null;
    [min + 2, limit, max - 4].filter((v) => typeof v === 'number').forEach((v) => {
      svg.appendChild(mk('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), stroke: v === limit ? css('--krds-danger-50') : css('--chart-grid'), 'stroke-width': v === limit ? 1.5 : 1, 'stroke-dasharray': v === limit ? '4 3' : '' }));
      const isLimit = v === limit;
      const t = mk('text', isLimit
        ? { x: W - padR, y: y(v) - 4, 'text-anchor': 'end', 'font-size': 10, 'font-weight': 700, fill: css('--krds-danger-60'), stroke: css('--krds-gray-5'), 'stroke-width': 3, 'paint-order': 'stroke' }
        : { x: padL - 4, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 10, fill: css('--krds-gray-60') });
      t.textContent = isLimit ? '기준 ' + limit + 'dB' : String(Math.round(v));
      // 기준 라벨은 선·점 위에 보이도록 마지막에 붙인다
      if (isLimit) limitLabel = t; else svg.appendChild(t);
    });
    // 바닥 진동이 함께 잡힌 초는 세로 띠로 표시
    if (Array.isArray(vibSeries)) {
      const step = (W - padL - padR) / Math.max(1, series.length - 1);
      vibSeries.forEach((v, i) => {
        if (v !== 1 || i >= series.length) return;
        svg.appendChild(mk('rect', { x: x(i) - Math.max(2, step / 2), y: padT, width: Math.max(4, step), height: H - padT - padB, fill: css('--krds-primary-10') }));
        svg.appendChild(mk('rect', { x: x(i) - 1.5, y: H - padB + 1, width: 3, height: 4, rx: 1, fill: css('--krds-primary-60') }));
      });
    }
    if (area) svg.appendChild(mk('path', { d: area, fill: css('--krds-primary-5'), 'fill-opacity': 0.7 }));
    pts.forEach((p, i) => {
      const prev = pts[i - 1];
      if (!prev) return;
      svg.appendChild(mk('line', { x1: prev[0], y1: prev[1], x2: p[0], y2: p[1], stroke: css('--krds-primary-50'), 'stroke-width': 2, 'stroke-linecap': 'round' }));
    });
    series.forEach((v, i) => {
      if (typeof v === 'number' && limit && v > limit) svg.appendChild(mk('circle', { cx: x(i), cy: y(v), r: 2.6, fill: css('--krds-danger-50') }));
      if (v === null) svg.appendChild(mk('rect', { x: x(i) - 2, y: padT, width: 4, height: H - padT - padB, fill: css('--krds-gray-30'), opacity: .6 }));
    });
    if (limitLabel) svg.appendChild(limitLabel);
    const xt = mk('text', { x: W - padR, y: H - 6, 'text-anchor': 'end', 'font-size': 10, fill: css('--krds-gray-60') });
    xt.textContent = series.length + '초';
    svg.appendChild(xt);
    const x0 = mk('text', { x: padL, y: H - 6, 'font-size': 10, fill: css('--krds-gray-60') });
    x0.textContent = '0초';
    svg.appendChild(x0);
  };

  const openDetail = (li) => {
    const e = readEvent(li);
    if (!e) return;
    current = { id: e.id, li };
    const g = groups.find((x) => x.key === e.source_group) || groups[6];
    const limitType = g.type ? limits[g.type] : null;
    const limit = limitType ? (e.is_night ? limitType.night : limitType.day) : null;
    document.getElementById('detailIcon').innerHTML = icon(e.source_icon);
    document.getElementById('detailTitle').textContent = e.source_label + ' · ' + e.time_label;
    document.getElementById('detailSub').textContent = e.date_label + ' · ' + e.duration_label + (e.is_night ? ' · 야간' : ' · 주간') + (typeof e.confidence === 'number' ? ' · 분류 신뢰도 ' + Math.round(e.confidence * 100) + '%' : '');
    const badge = document.getElementById('detailBadge');
    badge.className = 'badge ' + (e.exceeded ? 'badge--danger' : 'badge--ok');
    badge.textContent = e.exceeded ? '기준 초과' : '기준 이내';
    const hasVibSeries = Array.isArray(e.vibration_series) && e.vibration_series.some((v) => v === 1);
    drawSpark(document.getElementById('detailSpark'), e.db_series, limit, e.vibration_series);
    document.getElementById('detailSparkCaption').textContent = e.db_series && e.db_series.length
      ? '1초 단위 데시벨 · 빨간 점은 ' + (limit ? (e.is_night ? '야간' : '주간') + ' 기준 ' + limit + 'dB 초과 · ' : '') + (hasVibSeries ? '옅은 파란 띠는 바닥 진동이 함께 잡힌 초 · ' : '') + '회색은 우리 집 제외 구간 · 오디오는 저장되지 않음'
      : '분류 결과와 평균·최고 dB만 저장된 사건입니다.';
    document.getElementById('detailKv').innerHTML = [
      ['평균 dB', e.avg_db + ' dB'], ['최고 dB', e.max_db + ' dB'], ['지속 시간', e.duration_label],
      ['바닥 진동', typeof e.vibration_sec === 'number' ? (e.vibration_sec > 0 ? e.vibration_sec + '초 동반 · 최고 ' + e.vibration_peak_mg + 'mg' : '없음') : '측정 안 함'],
      ['판정', e.exceeded_rule || (limit ? '기준 ' + limit + 'dB 이내' : '판정 제외(기타)')],
    ].map(([k, v]) => '<div' + (k === '판정' ? ' class="is-wide"' : '') + '><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');
    memoInput.value = e.memo || '';
    openModal(sheet);
  };

  document.querySelectorAll('.detail-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.swipe-item');
      if (item && item.classList.contains('is-open')) { item.classList.remove('is-open'); return; }
      openDetail(item);
    });
  });
  document.getElementById('memoCancel').addEventListener('click', () => closeModal(sheet));
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeModal(sheet); });
  memoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!current) return;
    const memo = memoInput.value.trim();
    try {
      const data = await api('/api/events/' + current.id, { method: 'PATCH', body: { memo } });
      const span = current.li.querySelector('[data-role="memo"]');
      span.innerHTML = data.event.memo ? icon('pencil', 'ico--sm') + ' ' : '';
      span.appendChild(document.createTextNode(data.event.memo || '메모 추가'));
      span.classList.toggle('is-empty', !data.event.memo);
      const ev = readEvent(current.li); ev.memo = data.event.memo; current.li.dataset.event = JSON.stringify(ev);
      closeModal(sheet);
      toast(memo ? '메모를 저장했습니다. 리포트에 반영됩니다.' : '메모를 지웠습니다.');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });

  const askDelete = (id) => { deleteTarget = id; closeModal(sheet); openModal(deleteModal); };
  document.getElementById('detailDelete').addEventListener('click', () => { if (current) askDelete(current.id); });
  document.querySelectorAll('.delete-trigger').forEach((btn) => btn.addEventListener('click', () => askDelete(btn.dataset.id)));
  document.querySelectorAll('.swipe-item__action').forEach((a) => a.addEventListener('click', () => askDelete(a.closest('.swipe-item').dataset.id)));
  document.getElementById('deleteCancel').addEventListener('click', () => { closeModal(deleteModal); deleteTarget = null; });
  document.getElementById('deleteConfirm').addEventListener('click', async () => {
    if (!deleteTarget) return;
    try {
      await api('/api/events/' + deleteTarget, { method: 'DELETE' });
      const item = document.querySelector('.swipe-item[data-id="' + deleteTarget + '"]');
      if (item) item.remove();
      toast('사건을 삭제했습니다.');
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast(err.message, { error: true });
    } finally {
      closeModal(deleteModal);
      deleteTarget = null;
    }
  });

  // 히트맵 칸 필터
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const filterBar = document.getElementById('cellFilter');
  const filterLabel = document.getElementById('cellFilterLabel');
  const applyFilter = (day, hour) => {
    document.querySelectorAll('.heatmap__cell.is-selected').forEach((c) => c.classList.remove('is-selected'));
    let shown = 0;
    document.querySelectorAll('.swipe-item').forEach((li) => {
      const match = day === null || (Number(li.dataset.day) === day && Number(li.dataset.hour) === hour);
      li.hidden = !match;
      if (match) shown += 1;
    });
    document.querySelectorAll('.date-head').forEach((head) => {
      const list = head.nextElementSibling;
      const visible = list ? Array.from(list.querySelectorAll('.swipe-item')).some((li) => !li.hidden) : false;
      head.hidden = !visible;
      if (list) list.hidden = !visible;
    });
    if (day === null) { filterBar.hidden = true; return; }
    const cell = document.querySelector('.heatmap__cell[data-day="' + day + '"][data-hour="' + hour + '"]');
    if (cell) cell.classList.add('is-selected');
    filterLabel.textContent = days[day] + '요일 ' + hour + '시 사건 ' + shown + '건만 표시 중';
    filterBar.hidden = false;
    document.getElementById('listTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  document.querySelectorAll('.heatmap__cell[role="button"]').forEach((cell) => {
    const go = () => applyFilter(Number(cell.dataset.day), Number(cell.dataset.hour));
    cell.addEventListener('click', go);
    cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  document.getElementById('cellFilterClear').addEventListener('click', () => applyFilter(null));

  // 스와이프 (왼쪽으로 밀면 삭제 버튼 노출)
  document.querySelectorAll('.swipe-item').forEach((item) => {
    let startX = 0; let startY = 0; let dragging = false;
    item.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; dragging = true; }, { passive: true });
    item.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX; const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }
      if (dx < -40) { document.querySelectorAll('.swipe-item.is-open').forEach((o) => { if (o !== item) o.classList.remove('is-open'); }); item.classList.add('is-open'); }
      if (dx > 30) item.classList.remove('is-open');
    }, { passive: true });
    item.addEventListener('touchend', () => { dragging = false; });
  });
})();
