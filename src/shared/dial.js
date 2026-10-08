/**
 * 24시간 소음 다이얼 (UMD, 서버·브라우저 공용). 이웃소리의 대표 화면 요소.
 * 0시가 위, 시계 방향. 야간 구간은 음영 호, 시간별 사건 수는 바깥으로 뻗는 막대(기준 초과분은 안쪽부터 빨강).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundDial = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const SIZE = 320;
  const C = SIZE / 2;
  const R_BASE = 76;
  const R_MAXLEN = 66;
  const R_NIGHT_IN = 73;
  const R_NIGHT_OUT = 145;
  const R_LABEL = 160;

  const round = (n) => Math.round(n * 100) / 100;

  /** 시각(0~24, 소수 허용) → 라디안 (0시가 위) */
  function angleOf(hour) {
    if (typeof hour !== 'number' || Number.isNaN(hour)) throw new TypeError('hour must be a number');
    return (hour / 24) * Math.PI * 2 - Math.PI / 2;
  }

  function point(r, a) {
    return [round(C + r * Math.cos(a)), round(C + r * Math.sin(a))];
  }

  /** 고리 모양 부채꼴 경로 */
  function annularSector(r0, r1, a0, a1) {
    if (!(r1 > r0)) throw new RangeError('r1 must be greater than r0');
    let sweep = a1 - a0;
    while (sweep <= 0) sweep += Math.PI * 2;
    const large = sweep > Math.PI ? 1 : 0;
    const end = a0 + sweep;
    const [x0, y0] = point(r1, a0);
    const [x1, y1] = point(r1, end);
    const [x2, y2] = point(r0, end);
    const [x3, y3] = point(r0, a0);
    return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
  }

  /**
   * @param {{hourly:number[], hourlyExceeded?:number[], nightStart?:number, nightEnd?:number, total?:number, exceeded?:number, unit?:string}} data
   * @returns {string} SVG 문자열
   */
  function build(data) {
    if (!data || !Array.isArray(data.hourly) || data.hourly.length !== 24) throw new TypeError('hourly must be an array of 24 numbers');
    const hourly = data.hourly;
    const ex = Array.isArray(data.hourlyExceeded) && data.hourlyExceeded.length === 24 ? data.hourlyExceeded : new Array(24).fill(0);
    const nightStart = data.nightStart ?? 22;
    const nightEnd = data.nightEnd ?? 6;
    const max = Math.max(1, ...hourly);
    const total = data.total ?? hourly.reduce((a, b) => a + b, 0);
    const exceeded = data.exceeded ?? ex.reduce((a, b) => a + b, 0);
    const peak = hourly.indexOf(Math.max(...hourly));
    const parts = [];

    // 막대가 놓이는 고리 바탕 (야간 구간은 그 위에 띠로 겹친다)
    parts.push(`<circle class="dial__ring" cx="${C}" cy="${C}" r="${(R_BASE + R_BASE + R_MAXLEN) / 2}" stroke-width="${R_MAXLEN + 6}"/>`);
    // 야간 구간
    if (nightStart !== nightEnd) {
      parts.push(`<path class="dial__night" d="${annularSector(R_NIGHT_IN, R_NIGHT_OUT, angleOf(nightStart), angleOf(nightEnd))}"/>`);
    }
    // 바탕 원과 6시간 눈금
    parts.push(`<circle class="dial__base" cx="${C}" cy="${C}" r="${R_BASE - 3}"/>`);
    for (let h = 0; h < 24; h += 1) {
      const a = angleOf(h);
      const [x0, y0] = point(R_BASE - 3, a);
      const [x1, y1] = point(R_BASE - (h % 6 === 0 ? 10 : 6), a);
      parts.push(`<line class="dial__tick${h % 6 === 0 ? ' is-major' : ''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`);
    }
    // 시간별 막대
    const gap = ((Math.PI * 2) / 24) * 0.2;
    for (let h = 0; h < 24; h += 1) {
      const count = hourly[h];
      if (!count) continue;
      const a0 = angleOf(h) + gap / 2;
      const a1 = angleOf(h + 1) - gap / 2;
      const len = Math.max(4, (count / max) * R_MAXLEN);
      const exLen = count ? Math.min(len, (Math.min(ex[h], count) / count) * len) : 0;
      const title = `<title>${h}시 ${count}건${ex[h] ? `, 기준 초과 ${ex[h]}건` : ''}</title>`;
      if (exLen > 0.5) parts.push(`<path class="dial__bar is-exceeded${h === peak ? ' is-peak' : ''}" d="${annularSector(R_BASE, R_BASE + exLen, a0, a1)}">${title}</path>`);
      if (len - exLen > 0.5) parts.push(`<path class="dial__bar${h === peak ? ' is-peak' : ''}" d="${annularSector(R_BASE + exLen, R_BASE + len, a0, a1)}">${title}</path>`);
    }
    // 시각 라벨
    [0, 6, 12, 18].forEach((h) => {
      const [x, y] = point(R_LABEL, angleOf(h));
      parts.push(`<text class="dial__label" x="${x}" y="${round(y + 4)}" text-anchor="middle">${h}시</text>`);
    });
    // 가운데 숫자
    parts.push(`<text class="dial__total" x="${C}" y="${C + 6}" text-anchor="middle">${total}</text>`);
    parts.push(`<text class="dial__unit" x="${C}" y="${C + 28}" text-anchor="middle">${data.unit || '건 기록'}</text>`);
    if (total) parts.push(`<text class="dial__ex" x="${C}" y="${C - 30}" text-anchor="middle">기준 초과 ${exceeded}</text>`);

    const label = total
      ? `24시간 소음 다이얼: 총 ${total}건, 기준 초과 ${exceeded}건, 가장 많은 시간 ${peak}시, 야간 ${nightStart}시부터 ${nightEnd}시까지 음영`
      : '24시간 소음 다이얼: 기록된 사건 없음';
    return `<svg class="dial" viewBox="-14 -14 ${SIZE + 28} ${SIZE + 28}" role="img" aria-label="${label}">${parts.join('')}</svg>`;
  }

  return { build, angleOf, annularSector, SIZE };
});
