/* 리포트 요약을 1080×1350 이미지 카드로 그려 공유·저장한다 (외부 라이브러리 없음) */
(function () {
  const C = { primary: '#246BEB', primaryDark: '#083891', danger: '#EB003B', gray90: '#1E2124', gray60: '#6D7882', gray20: '#E6E8EA', bg: '#F4F5F6', white: '#FFFFFF', primary5: '#ECF2FE', night: '#EEF1F7' };
  const FONT = '"Pretendard GOV", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

  const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const text = (ctx, str, x, y, { size = 32, weight = 500, color = C.gray90, align = 'left' } = {}) => { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(str, x, y); };
  const wrap = (ctx, str, x, y, maxW, lineH, opts) => {
    ctx.font = `${opts.weight || 400} ${opts.size}px ${FONT}`;
    const words = str.split(' '); let line = ''; let yy = y;
    words.forEach((w) => { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { text(ctx, line, x, yy, opts); line = w; yy += lineH; } else line = test; });
    if (line) text(ctx, line, x, yy, opts);
    return yy + lineH;
  };

  const draw = (canvas, s, aiText, role) => {
    const ctx = canvas.getContext('2d');
    const W = canvas.width; const H = canvas.height; const P = 72;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    // 헤더
    ctx.fillStyle = C.primary; roundRect(ctx, P, P, 56, 56, 14); ctx.fill();
    text(ctx, '이웃소리', P + 72, P + 42, { size: 36, weight: 800 });
    text(ctx, role === 'maker' ? '우리 집 소음 자가 점검 리포트' : '층간소음 기록 리포트', P + 72 + 150, P + 42, { size: 26, color: C.gray60 });
    text(ctx, `${s.period.from} ~ ${s.period.to} (${s.period.days}일)`, W - P, P + 42, { size: 26, color: C.gray60, align: 'right' });
    // 요약 카드 4
    const cards = [
      ['총 사건', s.total_events + '건', C.primaryDark, s.comparison && s.comparison.has_previous ? s.comparison.total : null],
      ['기준 초과', s.exceeded_events + '건', C.danger, s.comparison && s.comparison.has_previous ? s.comparison.exceeded : null],
      ['주된 소음원', s.top_source ? s.top_source.label : '-', C.primaryDark, null],
      ['가장 많은 시간대', s.top_hour ? s.top_hour.label : '-', C.primaryDark, null],
    ];
    const cw = (W - P * 2 - 24) / 2; const ch = 180; let cy = P + 110;
    cards.forEach((c, i) => {
      const cx = P + (i % 2) * (cw + 24); const yy = cy + Math.floor(i / 2) * (ch + 24);
      ctx.fillStyle = C.white; roundRect(ctx, cx, yy, cw, ch, 20); ctx.fill();
      text(ctx, c[0], cx + 28, yy + 50, { size: 24, color: C.gray60 });
      text(ctx, c[1], cx + 28, yy + 118, { size: c[1].length > 4 ? 44 : 60, weight: 800, color: c[2] });
      if (c[3]) { const up = c[3].delta > 0; text(ctx, (c[3].delta === 0 ? '지난 기간과 같음' : '지난 기간보다 ' + Math.abs(c[3].delta) + '건 ' + (up ? '증가' : '감소')), cx + 28, yy + 158, { size: 22, weight: 600, color: c[3].delta > 0 ? C.danger : c[3].delta < 0 ? C.primary : C.gray60 }); }
    });
    cy += (ch + 24) * 2 + 16;
    // 시간대 막대
    ctx.fillStyle = C.white; roundRect(ctx, P, cy, W - P * 2, 300, 20); ctx.fill();
    text(ctx, '시간대 분포 (24시간)', P + 28, cy + 48, { size: 26, weight: 700 });
    const bx = P + 28; const bw = (W - P * 2 - 56) / 24; const by = cy + 250; const bh = 150; const mx = Math.max(1, ...s.hourly);
    s.hourly.forEach((v, h) => {
      const night = h >= 22 || h < 6;
      if (night) { ctx.fillStyle = C.night; ctx.fillRect(bx + h * bw, by - bh - 10, bw, bh + 10); }
      const hh = Math.round((v / mx) * bh);
      ctx.fillStyle = night ? C.primaryDark : C.primary; roundRect(ctx, bx + h * bw + 4, by - hh, bw - 8, Math.max(hh, 2), 4); ctx.fill();
      if (h % 6 === 0) text(ctx, String(h), bx + h * bw + bw / 2, by + 26, { size: 18, color: C.gray60, align: 'center' });
      if (v === mx && v > 0) text(ctx, String(v), bx + h * bw + bw / 2, by - hh - 8, { size: 18, weight: 700, color: C.primaryDark, align: 'center' });
    });
    cy += 324;
    // 소음원 막대
    ctx.fillStyle = C.white; roundRect(ctx, P, cy, W - P * 2, 60 + s.by_source.length * 48, 20); ctx.fill();
    text(ctx, '소음원별 사건 수', P + 28, cy + 48, { size: 26, weight: 700 });
    const maxS = Math.max(1, ...s.by_source.map((g) => g.count));
    s.by_source.forEach((g, i) => {
      const yy = cy + 90 + i * 48;
      text(ctx, g.label, P + 28, yy, { size: 22 });
      const tx = P + 220; const tw = W - P * 2 - 320;
      ctx.fillStyle = C.gray20; roundRect(ctx, tx, yy - 20, tw, 22, 11); ctx.fill();
      ctx.fillStyle = C.primary; roundRect(ctx, tx, yy - 20, Math.max(22, tw * (g.count / maxS)), 22, 11); ctx.fill();
      text(ctx, g.count + '건', W - P - 28, yy, { size: 22, weight: 700, align: 'right' });
    });
    cy += 60 + s.by_source.length * 48 + 24;
    // AI 요약
    if (aiText) {
      ctx.fillStyle = C.primary5; roundRect(ctx, P, cy, W - P * 2, 260, 20); ctx.fill();
      ctx.fillStyle = C.primary; ctx.fillRect(P, cy + 20, 6, 220);
      text(ctx, 'AI 요약', P + 28, cy + 46, { size: 22, weight: 700, color: C.primaryDark });
      wrap(ctx, aiText, P + 28, cy + 90, W - P * 2 - 56, 36, { size: 23, color: C.gray90 });
    }
    // 푸터
    text(ctx, '스마트폰 측정값으로 공인 측정이 아니며 대화를 위한 참고 기록입니다. 녹음은 저장하지 않습니다.', P, H - 60, { size: 20, color: C.gray60 });
    text(ctx, '이웃소리 · 층간소음 AI 기록·중재', W - P, H - 60, { size: 20, color: C.gray60, align: 'right' });
  };

  const share = async (canvas, filename) => {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '이웃소리 소음 리포트', text: '이웃소리로 기록한 생활소음 리포트입니다.' });
      return 'shared';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return 'downloaded';
  };

  window.NSShareCard = { draw, share };
})();
