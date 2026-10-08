/**
 * 선 아이콘 세트 (UMD, 서버·브라우저 공용). 24×24, 선 1.8px, 둥근 끝.
 * 이모지·특수문자 대신 이 세트만 쓴다. 서버는 스프라이트를 한 번 출력하고, 화면은 <use href="#i-이름">으로 참조한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundIcons = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const PATHS = {
    footstep: '<path d="M8.5 3.2c1.6 0 2.4 1.9 2.4 4.3S10 11.8 8.5 11.8 6.1 9.9 6.1 7.5 6.9 3.2 8.5 3.2z"/><path d="M6.6 14.2h3.8v1.6a1.9 1.9 0 0 1-3.8 0z"/><path d="M15.5 7.2c1.6 0 2.4 1.9 2.4 4.3s-.9 4.3-2.4 4.3-2.4-1.9-2.4-4.3.8-4.3 2.4-4.3z"/><path d="M13.6 18.2h3.8v1.4a1.9 1.9 0 0 1-3.8 0z"/>',
    furniture: '<path d="M7 3v8M17 3v8M7 7h10"/><path d="M5 11h14v3.5H5z"/><path d="M6.5 14.5V21M17.5 14.5V21"/>',
    hammer: '<path d="M14.2 3.8l5.9 5.9-2.1 2.1-5.9-5.9z"/><path d="M13.1 7.9L4.2 16.8a1.6 1.6 0 0 0 0 2.2l.8.8a1.6 1.6 0 0 0 2.2 0l8.9-8.9"/>',
    pet: '<path d="M12 12.6c-2.8 0-4.9 2.4-4.9 4.5 0 1.5 1.2 2.6 2.6 2.6.9 0 1.5-.5 2.3-.5s1.4.5 2.3.5c1.4 0 2.6-1.1 2.6-2.6 0-2.1-2.1-4.5-4.9-4.5z"/><circle cx="5.6" cy="10.2" r="1.7"/><circle cx="9.1" cy="6.2" r="1.7"/><circle cx="14.9" cy="6.2" r="1.7"/><circle cx="18.4" cy="10.2" r="1.7"/>',
    music: '<path d="M9 17.5V5.5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    voice: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M8.5 2.5L12 6l3.5-3.5"/>',
    other: '<path d="M3 12h2.5l2-4.5 3 9 3-12 3 10.5 1.8-3H21"/>',
    home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
    phone: '<path d="M5.2 3.8h3.4l1.8 4.6-2.2 1.4a11 11 0 0 0 6 6l1.4-2.2 4.6 1.8v3.4a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 3.2 6a2 2 0 0 1 2-2.2z"/>',
    pencil: '<path d="M4 20h4.2L19.4 8.8a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8z"/><path d="M13.6 6.2l4.2 4.2"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    'chevron-left': '<path d="M15 5l-7 7 7 7"/>',
    'chevron-right': '<path d="M9 5l7 7-7 7"/>',
    'trend-up': '<path d="M6 15l6-6 6 6"/>',
    'trend-down': '<path d="M6 9l6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    share: '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 13v6.5h14V13"/>',
    download: '<path d="M12 4v11.5M7.5 11L12 15.5 16.5 11"/><path d="M5 20h14"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.4"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    vibration: '<rect x="8" y="4" width="8" height="16" rx="1.6"/><path d="M4.8 8.5v7M2 10.5v3M19.2 8.5v7M22 10.5v3"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.8a2 2 0 0 0 4 0"/>',
    flask: '<path d="M9.5 3h5M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.5 14.5h9"/>',
    send: '<path d="M21 3L10 14"/><path d="M21 3l-6.5 18-4.5-7-7-4.5z"/>',
    scale: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  };

  const names = Object.keys(PATHS);

  /** 문서에 한 번 넣는 SVG 스프라이트 */
  function sprite() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' +
      names.map((n) => '<symbol id="i-' + n + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + PATHS[n] + '</symbol>').join('') +
      '</svg>';
  }

  /** 아이콘 하나 (스프라이트 참조) */
  function icon(name, cls) {
    if (!PATHS[name]) throw new RangeError('unknown icon: ' + name);
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>';
  }

  return { names, sprite, icon, has: (n) => Boolean(PATHS[n]) };
});
