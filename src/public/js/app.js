/* 공통: 익명 사용자 ID, API 호출, 토스트 */
(function () {
  const COOKIE = 'nsid';

  const readCookie = (name) => {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  };

  const getUserId = () => {
    let id = readCookie(COOKIE);
    if (!id) {
      try { id = localStorage.getItem(COOKIE); } catch (e) { id = null; }
    }
    if (!id && window.crypto && crypto.randomUUID) {
      id = crypto.randomUUID();
      document.cookie = COOKIE + '=' + id + '; path=/; max-age=31536000; samesite=lax';
    }
    try { if (id) localStorage.setItem(COOKIE, id); } catch (e) { /* ignore */ }
    return id;
  };

  const api = async (path, { method = 'GET', body = null } = {}) => {
    const headers = { Accept: 'application/json' };
    const userId = getUserId();
    if (userId) headers['X-User-Id'] = userId;
    if (body !== null) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, { method, headers, body: body !== null ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const message = data && data.error ? data.error.message : '요청에 실패했습니다 (' + res.status + ')';
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  let toastTimer = null;
  const toast = (message, { error = false, duration = 2600 } = {}) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-error', Boolean(error));
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), duration);
  };

  const hideToast = () => {
    const el = document.getElementById('toast');
    clearTimeout(toastTimer);
    if (el) el.classList.remove('is-visible');
  };

  // 모달이 열리면 떠 있던 토스트가 모달 위를 가리지 않게 먼저 치운다
  const openModal = (el) => { if (el) { hideToast(); el.hidden = false; const f = el.querySelector('input, button'); if (f) setTimeout(() => f.focus(), 30); } };
  const closeModal = (el) => { if (el) el.hidden = true; };

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  };

  const icon = (name, cls) => (window.NeighborSoundIcons ? window.NeighborSoundIcons.icon(name, cls) : '');

  window.NS = { getUserId, api, toast, hideToast, openModal, closeModal, copyText, icon };

  // 앱 설치(PWA): HTTPS 또는 localhost에서만 등록
  if ('serviceWorker' in navigator && (window.isSecureContext || location.hostname === 'localhost')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
  getUserId();
})();
