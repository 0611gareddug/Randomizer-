// 공용 수학/유틸리티
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const lerpAngle = (a, b, t) => a + angDiff(a, b) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };

// 가중치 랜덤
export function weighted(items, weightFn) {
  let total = 0;
  for (let i = 0; i < items.length; i++) total += weightFn(items[i]);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weightFn(items[i]); if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// 고정 크기 오브젝트 풀 (GC 끊김 방지)
export class Pool {
  constructor(factory, size) {
    this.items = new Array(size);
    for (let i = 0; i < size; i++) { const o = factory(); o.active = false; this.items[i] = o; }
    this.cursor = 0;
  }
  get() {
    const items = this.items, n = items.length;
    for (let k = 0; k < n; k++) {
      const i = (this.cursor + k) % n;
      if (!items[i].active) { this.cursor = (i + 1) % n; items[i].active = true; return items[i]; }
    }
    // 가득 차면 가장 오래된 것 재사용
    const o = items[this.cursor]; this.cursor = (this.cursor + 1) % n; o.active = true; return o;
  }
  forEach(fn) { const it = this.items; for (let i = 0; i < it.length; i++) if (it[i].active) fn(it[i]); }
  clear() { const it = this.items; for (let i = 0; i < it.length; i++) it[i].active = false; }
}

export const store = {
  get(key, def) { try { const v = localStorage.getItem('rrush_' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(key, val) { try { localStorage.setItem('rrush_' + key, JSON.stringify(val)); } catch (e) { /* 저장 불가 환경 */ } },
};

export const isTouch = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 기본 욕설 필터
const BAD = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅂㅅ', '좆', '개새', '새끼', '지랄', 'ㅈㄹ', '느금', '니애미', '애미', 'fuck', 'shit', 'bitch'];
export function filterChat(s) {
  let out = String(s).slice(0, 60);
  for (const w of BAD) {
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, (m) => '♥'.repeat(m.length));
  }
  return out;
}
