// 키보드/마우스 + 모바일 터치 입력
import { isTouch } from './util.js';

export const input = {
  touch: isTouch(),
  keys: new Set(),
  mx: 0, my: 0,             // 이동 벡터
  mouseX: 0, mouseY: 0,     // 화면 좌표 (CSS px)
  fire: false,
  fireN: 0, meleeN: 0, skillN: 0, tauntN: 0, reloadN: 0,
  usedMouse: false,
  enabled: false,
  stick: { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 },
  touchFire: false,
  onKey: null,              // 메뉴용 키 콜백
};

const KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };

function recompute() {
  if (input.stick.active) return;
  const k = input.keys;
  let x = 0, y = 0;
  if (k.has('l')) x -= 1; if (k.has('r')) x += 1; if (k.has('u')) y -= 1; if (k.has('d')) y += 1;
  const l = Math.hypot(x, y); input.mx = l ? x / l : 0; input.my = l ? y / l : 0;
}

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') { if (input.onKey) input.onKey(e, true); return; }
    if (input.onKey && input.onKey(e, false) === true) { e.preventDefault(); return; }
    if (!input.enabled) return;
    const m = KEYMAP[e.code];
    if (m) { input.keys.add(m); recompute(); e.preventDefault(); return; }
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyQ': input.meleeN++; break;
      case 'KeyE': case 'Space': input.skillN++; e.preventDefault(); break;
      case 'KeyF': input.tauntN++; break;
      case 'KeyR': input.reloadN++; break;
    }
  });
  window.addEventListener('keyup', (e) => {
    const m = KEYMAP[e.code];
    if (m) { input.keys.delete(m); recompute(); }
    if (input.onKey) input.onKey(e, false, true);
  });
  window.addEventListener('blur', () => { input.keys.clear(); input.fire = false; recompute(); });
  canvas.addEventListener('mousemove', (e) => { input.mouseX = e.clientX; input.mouseY = e.clientY; input.usedMouse = true; });
  canvas.addEventListener('mousedown', (e) => {
    if (!input.enabled) return;
    input.usedMouse = true; input.mouseX = e.clientX; input.mouseY = e.clientY;
    if (e.button === 0) { input.fire = true; input.fireN++; }
    else if (e.button === 2) input.meleeN++;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 모바일 컨트롤 ──
export function initTouch(root) {
  const zone = root.querySelector('#stickZone');
  const base = root.querySelector('#stickBase');
  const knob = root.querySelector('#stickKnob');
  const R = () => base.offsetWidth * 0.42;
  const place = () => {
    const s = input.stick;
    base.style.transform = `translate(${s.ox - base.offsetWidth / 2}px, ${s.oy - base.offsetHeight / 2}px)`;
    const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), r = R();
    const k = l > r ? r / l : 1;
    knob.style.transform = `translate(${s.ox + dx * k - knob.offsetWidth / 2}px, ${s.oy + dy * k - knob.offsetHeight / 2}px)`;
    input.mx = l > 4 ? (dx * k) / r : 0; input.my = l > 4 ? (dy * k) / r : 0;
  };
  const resetStick = () => {
    const s = input.stick; s.active = false; s.id = -1; input.mx = input.my = 0;
    const rect = zone.getBoundingClientRect();
    s.ox = s.x = rect.width * 0.32; s.oy = s.y = rect.height * 0.62; place();
    base.classList.remove('on');
  };
  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0], s = input.stick, rect = zone.getBoundingClientRect();
    s.active = true; s.id = t.identifier; s.ox = s.x = t.clientX - rect.left; s.oy = s.y = t.clientY - rect.top; place();
    base.classList.add('on');
  }, { passive: false });
  zone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const s = input.stick, rect = zone.getBoundingClientRect();
    for (const t of e.changedTouches) if (t.identifier === s.id) {
      s.x = t.clientX - rect.left; s.y = t.clientY - rect.top;
      // 손가락이 멀리 가면 원점이 따라감
      const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), r = R() * 1.6;
      if (l > r) { s.ox = s.x - dx / l * r; s.oy = s.y - dy / l * r; }
      place();
    }
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === input.stick.id) resetStick(); };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
  setTimeout(resetStick, 50);
  window.addEventListener('resize', () => setTimeout(resetStick, 100));

  const bind = (sel, down, up) => {
    const el = root.querySelector(sel); if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); el.classList.add('down'); down(); }, { passive: false });
    const u = (e) => { e.preventDefault(); el.classList.remove('down'); if (up) up(); };
    el.addEventListener('touchend', u, { passive: false }); el.addEventListener('touchcancel', u, { passive: false });
  };
  bind('#tFire', () => { input.touchFire = true; input.fire = true; input.fireN++; }, () => { input.touchFire = false; input.fire = false; });
  bind('#tMelee', () => { input.meleeN++; });
  bind('#tSkill', () => { input.skillN++; });
  bind('#tTaunt', () => { input.tauntN++; });
  bind('#tReload', () => { input.reloadN++; });
}

export function clearInput() {
  input.keys.clear(); input.fire = false; input.mx = input.my = 0; input.touchFire = false;
}
