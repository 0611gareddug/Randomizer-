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
  atk: { active: false, aiming: false, ang: 0, id: -1 },
  skl: { active: false, aiming: false, ang: 0, id: -1 },
  aimHold: null, tapFireUntil: 0,
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
// 왼쪽: 고정 이동 스틱 / 오른쪽: 공격·스킬 조준 스틱 (끌어서 조준, 떼면 발동, 탭하면 자동 조준)
export function initTouch(root) {
  const zone = root.querySelector('#stickZone');
  const base = root.querySelector('#stickBase');
  const knob = root.querySelector('#stickKnob');
  const mv = { id: -1 };
  const center = () => { const r = base.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * 0.42 }; };
  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
  const moveTo = (x, y) => {
    const c = center(); let dx = x - c.x, dy = y - c.y; const l = Math.hypot(dx, dy);
    if (l > c.R) { dx *= c.R / l; dy *= c.R / l; }
    setKnob(dx, dy);
    input.mx = l > 6 ? dx / c.R : 0; input.my = l > 6 ? dy / c.R : 0;
  };
  const resetMove = () => { mv.id = -1; input.stick.active = false; input.mx = input.my = 0; setKnob(0, 0); base.classList.remove('on'); };
  zone.addEventListener('touchstart', (e) => {
    e.preventDefault(); if (mv.id !== -1) return;
    const t = e.changedTouches[0]; mv.id = t.identifier; input.stick.active = true; base.classList.add('on'); moveTo(t.clientX, t.clientY);
  }, { passive: false });
  zone.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === mv.id) moveTo(t.clientX, t.clientY); }, { passive: false });
  const endMv = (e) => { for (const t of e.changedTouches) if (t.identifier === mv.id) resetMove(); };
  zone.addEventListener('touchend', endMv); zone.addEventListener('touchcancel', endMv);
  window.addEventListener('resize', resetMove);

  const aimStick = (el, st, onTap, onRelease) => {
    const k = el.querySelector('.knob');
    let cx = 0, cy = 0, R = 1, dead = 14, lastL = 0;
    const set = (dx, dy) => { k.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
    const move = (x, y) => {
      let dx = x - cx, dy = y - cy; const l = Math.hypot(dx, dy); lastL = l;
      if (l > dead) { st.aiming = true; st.ang = Math.atan2(dy, dx); }
      el.classList.toggle('cancel', st.aiming && l <= dead);
      if (l > R) { dx *= R / l; dy *= R / l; }
      set(dx, dy);
    };
    el.addEventListener('touchstart', (e) => {
      e.preventDefault(); if (st.id !== -1) return;
      const t = e.changedTouches[0], r = el.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width * 0.5; dead = Math.max(12, r.width * 0.16);
      st.id = t.identifier; st.active = true; st.aiming = false; lastL = 0; el.classList.add('down');
      move(t.clientX, t.clientY);
    }, { passive: false });
    el.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === st.id) move(t.clientX, t.clientY); }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === st.id) {
        e.preventDefault();
        if (!st.aiming) onTap();
        else if (lastL > dead && e.type === 'touchend') { input.aimHold = { ang: st.ang, until: performance.now() + 220 }; onRelease(); }
        st.id = -1; st.active = false; st.aiming = false; set(0, 0); el.classList.remove('down', 'cancel');
      }
    };
    el.addEventListener('touchend', end, { passive: false }); el.addEventListener('touchcancel', end, { passive: false });
  };
  aimStick(root.querySelector('#tFire'), input.atk, () => { input.fireN++; input.tapFireUntil = performance.now() + 320; }, () => { input.fireN++; });
  aimStick(root.querySelector('#tSkill'), input.skl, () => { input.skillN++; }, () => { input.skillN++; });

  const bind = (sel, down) => {
    const el = root.querySelector(sel); if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); el.classList.add('down'); down(); }, { passive: false });
    const u = (e) => { e.preventDefault(); el.classList.remove('down'); };
    el.addEventListener('touchend', u, { passive: false }); el.addEventListener('touchcancel', u, { passive: false });
  };
  bind('#tMelee', () => { input.meleeN++; });
  bind('#tTaunt', () => { input.tauntN++; });
  bind('#tReload', () => { input.reloadN++; });
}

export function clearInput() {
  input.keys.clear(); input.fire = false; input.mx = input.my = 0; input.touchFire = false; input.aimHold = null; input.tapFireUntil = 0;
}
