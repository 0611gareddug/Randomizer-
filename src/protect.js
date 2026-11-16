// 개발자 도구 접근 차단 (단축키/우클릭 차단 + 디버거 감지)
export function protect() {
  const block = () => {
    if (document.getElementById('blocked')) return;
    try { window.__rrStop && window.__rrStop(); } catch (e) { /* 무시 */ }
    document.documentElement.innerHTML = '<head><meta charset="utf-8"><title>룰렛 러시</title></head><body style="margin:0;background:#141225;color:#f4f1ff;font-family:sans-serif"><div id="blocked" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-size:18px;line-height:1.8">🔒 개발자 도구가 감지되어 게임을 중단했어요.<br>개발자 도구를 닫고 새로고침해 주세요.</div></body>';
  };
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
  document.addEventListener('contextmenu', stop, true);
  document.addEventListener('dragstart', stop, true);
  document.addEventListener('selectstart', (e) => { const t = e.target; if (!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) stop(e); }, true);
  document.addEventListener('keydown', (e) => {
    const k = (e.key || '').toUpperCase(), c = e.code;
    if (k === 'F12' || c === 'F12') return stop(e);
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C', 'K', 'M'].includes(k)) return stop(e);
    if (e.metaKey && e.altKey && ['I', 'J', 'C', 'U'].includes(k)) return stop(e);
    if ((e.ctrlKey || e.metaKey) && ['U', 'S', 'P'].includes(k)) return stop(e);
  }, true);
  // 디버거 감지: 개발자 도구가 열려 있으면 debugger에서 멈추며 시간이 크게 벌어짐
  const check = () => {
    const t = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    if (performance.now() - t > 150) block();
  };
  setInterval(check, 1200);
}
