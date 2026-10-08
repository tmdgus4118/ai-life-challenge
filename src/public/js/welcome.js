/* 첫 방문: 데모 기록을 넣고 리포트로 이동 */
(function () {
  const { api, toast } = window.NS;
  const btn = document.getElementById('demoStart');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.lastChild.textContent = '데모 기록을 불러오는 중';
    try {
      const data = await api('/api/data/demo', { method: 'POST' });
      toast('데모 기록 ' + data.inserted + '건을 불러왔습니다.');
      window.location.href = '/report?days=7';
    } catch (err) {
      toast(err.message, { error: true });
      btn.disabled = false;
      btn.lastChild.textContent = '데모 기록으로 둘러보기';
    }
  });
})();
