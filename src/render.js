// 렌더러: 저해상도 버퍼에 픽셀 아트를 그리고 정수배 확대. 글자는 고해상도 오버레이
import { icon, slimeSprite, slimeFlash, drawFace, drawHat, renderMapCanvas, renderBushCanvas, themeOf, shade } from './sprites.js';
import { PRIMARY, MELEE, SKILL, TAUNT } from './data.js';
import { TILE, raycast } from './maps.js';
import { Pool, TAU, clamp, rand } from './util.js';

const TEAM_COL = ['#ff5d73', '#4fa8ff'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.buf = document.createElement('canvas');
    this.b = this.buf.getContext('2d');
    this.scale = 3; this.dpr = 1; this.vw = 320; this.vh = 180;
    this.camX = 0; this.camY = 0; this.shakeT = 0; this.shakeA = 0; this.sx = 0; this.sy = 0;
    this.lowSpec = false; this.shakeOn = true; this.dmgNumOn = true;
    this.parts = new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#fff', kind: 0, grav: 0, drag: 0 }), 900);
    this.nums = []; this.charges = new Map(); this.rays = []; this.rings = []; this.bubbles = new Map(); this.pigeons = [];
    this.anim = new Map(); this.time = 0; this.hurtFlash = 0; this.hitMark = 0;
    this.mobile = false; this.uiScale = 1;
    this.smokeOff = [];
    for (let i = 0; i < 9; i++) this.smokeOff.push([rand(-0.6, 0.6), rand(-0.6, 0.6), rand(0.45, 0.7), rand(0, TAU)]);
  }

  setMap(map) {
    this.map = map;
    this.mapCanvas = renderMapCanvas(map);
    this.mctx = this.mapCanvas.getContext('2d');
    this.bushCanvas = renderBushCanvas(map); this.leaps = new Map(); this._vis = [];
    this.theme = themeOf(map.theme);
    this.belts = [];
    for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) { const t = map.grid[j * map.w + i]; if (t >= 4 && t <= 7) this.belts.push([i, j, t]); }
    this.splatCount = 0;
    this.parts.clear(); this.nums.length = 0; this.rays.length = 0; this.rings.length = 0; this.bubbles.clear(); this.charges.clear(); this.anim.clear(); this.pigeons.length = 0;
  }

  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    this.dpr = this.lowSpec ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(W * this.dpr); this.canvas.height = Math.round(H * this.dpr);
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    const targetH = this.mobile ? 205 : 245;
    this.scale = Math.max(1, Math.round(this.canvas.height / targetH));
    this.vw = Math.ceil(this.canvas.width / this.scale); this.vh = Math.ceil(this.canvas.height / this.scale);
    this.buf.width = this.vw; this.buf.height = this.vh;
    this.b.imageSmoothingEnabled = false; this.ctx.imageSmoothingEnabled = false;
  }

  // ── 이펙트 API ──
  part(x, y, vx, vy, life, size, color, kind = 0, grav = 0, drag = 0) {
    const p = this.parts.get();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.size = size; p.color = color; p.kind = kind; p.grav = grav; p.drag = drag;
  }
  burst(x, y, color, n, spd, life = 0.5, size = 1, grav = 0) {
    if (this.lowSpec) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(0.3, 1) * spd; this.part(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rand(0.6, 1.2), size, color, 0, grav, 3); }
  }
  shake(a) { if (!this.shakeOn) return; this.shakeA = Math.max(this.shakeA, a); this.shakeT = 0.25; }
  ring(x, y, r, color, life = 0.35) { this.rings.push({ x, y, r, color, life, max: life }); }
  ray(kind, x0, y0, x1, y1) { this.rays.push({ kind, x0, y0, x1, y1, life: kind === 'snipe' ? 0.28 : kind === 'laser' ? 0.25 : 0.18, max: kind === 'snipe' ? 0.28 : kind === 'laser' ? 0.25 : 0.18 }); }
  num(x, y, text, color, big) {
    if (!this.dmgNumOn) return;
    // 같은 위치 근처 숫자는 합치지 않고 살짝 흩뿌림
    this.nums.push({ x: x + rand(-4, 4), y, vy: -38, life: 0.8, text: String(text), color, big: !!big });
    if (this.nums.length > 40) this.nums.shift();
  }
  charge(id, ang, dur, range) { this.charges.set(id, { ang, t: dur, max: dur, range }); }
  leap(id, x0, y0, x1, y1, dur) { this.leaps.set(id, { x0, y0, x1, y1, t: 0, dur }); }
  bubble(id, text) { this.bubbles.set(id, { text, t: 2.2 }); }
  pigeon(x, y) { this.pigeons.push({ x, y, t: 0 }); }
  splat(x, y, color) {
    const c = this.mctx; if (!c) return;
    const n = 7 + ((Math.random() * 5) | 0);
    c.fillStyle = shade(color, -0.15); c.globalAlpha = 0.55;
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), d = rand(0, 9); c.fillRect((x + Math.cos(a) * d) | 0, (y + Math.sin(a) * d * 0.7) | 0, (rand(2, 5)) | 0, (rand(1, 4)) | 0); }
    c.fillStyle = shade(color, 0.2); c.globalAlpha = 0.4;
    for (let i = 0; i < 3; i++) c.fillRect((x + rand(-5, 5)) | 0, (y + rand(-3, 3)) | 0, 2, 1);
    c.globalAlpha = 1;
    for (let i = 0; i < (this.lowSpec ? 8 : 18); i++) { const a = rand(0, TAU), s = rand(40, 150); this.part(x, y - 4, Math.cos(a) * s, Math.sin(a) * s - 40, rand(0.35, 0.7), rand(1, 3) | 0, i % 3 ? color : shade(color, 0.3), 0, 260, 2); }
  }
  explosion(x, y, r, small) {
    this.ring(x, y, r, '#fff4c2', 0.3);
    const n = small ? 10 : 26;
    for (let i = 0; i < (this.lowSpec ? n / 2 : n); i++) { const a = rand(0, TAU), s = rand(20, r * 3.2); this.part(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.55), rand(2, 4) | 0, ['#fff4c2', '#ffd23f', '#ff8f1f', '#e8434f'][i % 4], 0, 0, 4); }
    for (let i = 0; i < (small ? 3 : 8); i++) this.part(x + rand(-r / 3, r / 3), y + rand(-r / 3, r / 3), rand(-12, 12), rand(-25, -8), rand(0.6, 1.1), rand(4, 8), '#5b5566', 1, 0, 1);
    this.flash = Math.max(this.flash || 0, small ? 0.08 : 0.18);
  }

  // ── 카메라 ──
  updateCamera(tx, ty, dt, snap) {
    const m = this.map;
    let cx = tx - this.vw / 2, cy = ty - this.vh / 2;
    // 모바일은 조작 버튼에 캐릭터가 가리지 않도록 맵 밖까지 카메라가 따라감
    const mx = this.mobile ? this.vw * 0.3 : 8, my = this.mobile ? this.vh * 0.3 : 8;
    if (m.pw <= this.vw && !this.mobile) cx = (m.pw - this.vw) / 2; else cx = clamp(cx, -mx, m.pw - this.vw + mx);
    if (m.ph <= this.vh && !this.mobile) cy = (m.ph - this.vh) / 2; else cy = clamp(cy, -my, m.ph - this.vh + my);
    if (snap) { this.camX = cx; this.camY = cy; }
    else { const k = 1 - Math.exp(-dt * 9); this.camX += (cx - this.camX) * k; this.camY += (cy - this.camY) * k; }
  }
  screenToWorld(sx, sy) {
    const s = this.scale / this.dpr;
    return { x: sx / s + Math.round(this.camX), y: sy / s + Math.round(this.camY) };
  }

  // ── 메인 렌더 ──
  render(W, me, dt, opt) {
    this.time += dt;
    const b = this.b, cx = Math.round(this.camX), cy = Math.round(this.camY), vw = this.vw, vh = this.vh;
    const map = this.map;
    b.fillStyle = this.theme.bg; b.fillRect(0, 0, vw, vh);
    // 맵 (보이는 영역만)
    const sx0 = Math.max(0, cx), sy0 = Math.max(0, cy);
    const sw = Math.min(map.pw - sx0, vw - (sx0 - cx)), sh = Math.min(map.ph - sy0, vh - (sy0 - cy));
    if (sw > 0 && sh > 0) b.drawImage(this.mapCanvas, sx0, sy0, sw, sh, sx0 - cx, sy0 - cy, sw, sh);
    // 컨베이어 애니메이션
    const off = ((this.time * 26) % 8) | 0;
    b.fillStyle = '#ffd23f';
    for (const [i, j, t] of this.belts) {
      const px = i * TILE - cx, py = j * TILE - cy;
      if (px < -16 || py < -16 || px > vw || py > vh) continue;
      const horiz = t === 4 || t === 5;
      b.fillStyle = '#3c414d'; if (horiz) b.fillRect(px, py + 3, 16, 10); else b.fillRect(px + 3, py, 10, 16);
      b.fillStyle = '#4a505e'; if (horiz) { b.fillRect(px, py + 3, 16, 1); } else { b.fillRect(px + 3, py, 1, 16); }
      b.fillStyle = '#ffd23f';
      for (let k = 0; k < 2; k++) {
        const o = (k * 8 + off) % 16;
        if (horiz) { const d = t === 4 ? 1 : -1; const ax = t === 4 ? px + o : px + 15 - o; b.fillRect(ax, py + 7, 1, 2); b.fillRect(ax - d, py + 6, 1, 1); b.fillRect(ax - d, py + 9, 1, 1); b.fillRect(ax - 2 * d, py + 5, 1, 1); b.fillRect(ax - 2 * d, py + 10, 1, 1); }
        else { const d = t === 7 ? 1 : -1; const ay = t === 7 ? py + o : py + 15 - o; b.fillRect(px + 7, ay, 2, 1); b.fillRect(px + 6, ay - d, 1, 1); b.fillRect(px + 9, ay - d, 1, 1); b.fillRect(px + 5, ay - 2 * d, 1, 1); b.fillRect(px + 10, ay - 2 * d, 1, 1); }
      }
    }
    const inView = (x, y, m = 24) => x > cx - m && y > cy - m && x < cx + vw + m && y < cy + vh + m;
    const bob = Math.sin(this.time * 4) * 1.5;
    // 바닥 오브젝트
    for (const o of W.objs) {
      if (!inView(o.x, o.y)) continue;
      const x = Math.round(o.x - cx), y = Math.round(o.y - cy);
      switch (o.k) {
        case 'banana': b.drawImage(icon('banana'), x - 6, y - 6); break;
        case 'lob': this.shadow(b, x, y + 4, 5); b.drawImage(icon('jbomb'), x - 6, (y - 8 - (o.h || 0)) | 0); break;
        case 'food': this.shadow(b, x, y + 5, 5); b.drawImage(icon(o.ft === 0 ? 'pizza' : 'milk'), x - 6, (y - 8 + bob) | 0); break;
        case 'jelly': this.shadow(b, x, y + 4, 4); b.drawImage(icon('jelly'), x - 6, (y - 8 + bob) | 0); break;
        case 'strike': {
          const blink = ((this.time * 10) | 0) % 2;
          b.strokeStyle = o.meteor ? (blink ? '#ff8f1f' : '#c46bff') : blink ? '#ff3b4f' : '#ffd23f'; b.lineWidth = 1;
          const rr = (o.meteor ? 26 : 14) + (o.t || 0) * 12;
          if (o.meteor && o.t > 0) for (let k = 0; k < 2; k++) { const fx = x + 40 - o.t * 44 + k * 9, fy = y - 70 + (0.9 - o.t) * 70 + k * 5; b.fillStyle = '#ffd23f'; b.fillRect(fx | 0, fy | 0, 3, 3); b.fillStyle = '#ff8f1f'; b.fillRect((fx + 3) | 0, (fy - 3) | 0, 2, 2); }
          b.beginPath(); b.arc(x + 0.5, y + 0.5, rr, 0, TAU); b.stroke();
          b.fillStyle = b.strokeStyle; b.fillRect(x - 6, y, 13, 1); b.fillRect(x, y - 6, 1, 13);
          break;
        }
        case 'vortex': {
          const t = this.time;
          for (let k = 0; k < 4; k++) { b.strokeStyle = k % 2 ? '#9b5de5' : '#3d1a66'; b.beginPath(); b.arc(x, y, 6 + k * 5 + Math.sin(t * 8 + k) * 2, t * (3 + k) , t * (3 + k) + 4); b.stroke(); }
          b.fillStyle = '#0b0b12'; b.beginPath(); b.arc(x, y, 5, 0, TAU); b.fill();
          if (Math.random() < 0.6) { const a = rand(0, TAU), d = rand(40, 80); this.part(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, -Math.cos(a) * d * 2, -Math.sin(a) * d * 2, 0.4, 1, '#c79bff'); }
          break;
        }
        case 'drop': {
          const t = Math.max(0, o.t);
          this.shadow(b, x, y + 4, 8 - t * 1.5);
          const fy = y - 8 - t * 50;
          b.fillStyle = '#ffffff'; b.fillRect(x - 7, fy - 12, 15, 3); b.fillStyle = '#e8434f'; b.fillRect(x - 5, fy - 13, 4, 2); b.fillRect(x + 2, fy - 13, 4, 2);
          b.fillStyle = '#1a1530'; b.fillRect(x - 6, fy - 9, 1, 4); b.fillRect(x + 6, fy - 9, 1, 4);
          b.drawImage(icon('crate'), x - 6, fy - 6);
          break;
        }
        case 'crate': {
          const g = 0.5 + Math.sin(this.time * 6) * 0.25;
          b.globalAlpha = 0.3 * g; b.fillStyle = '#ffd23f'; b.fillRect(x - 3, y - 60, 6, 56); b.globalAlpha = 0.2 * g; b.fillRect(x - 6, y - 40, 12, 36); b.globalAlpha = 1;
          this.shadow(b, x, y + 5, 7); b.drawImage(icon('crate'), x - 6, y - 8);
          if (Math.random() < 0.15) this.part(o.x + rand(-6, 6), o.y - 4, 0, -20, 0.6, 1, '#ffd23f');
          break;
        }
        case 'turret': {
          if (o.big) {
            this.shadow(b, x, y + 6, 8);
            b.fillStyle = '#1a1530'; b.fillRect(x - 8, y - 5, 16, 12); b.fillStyle = '#565d72'; b.fillRect(x - 7, y - 4, 14, 10);
            b.fillStyle = '#ffd23f'; b.fillRect(x - 3, y - 9, 6, 3); b.fillStyle = W.mode === 'tdm' ? TEAM_COL[o.team] || '#fff' : '#ffd23f'; b.fillRect(x - 4, y, 8, 2);
            b.strokeStyle = '#1a1530'; b.lineWidth = 4; b.beginPath(); b.moveTo(x, y - 1); b.lineTo(x + Math.cos(o.aim) * 12, y - 1 + Math.sin(o.aim) * 12); b.stroke();
            b.strokeStyle = '#dfe5ee'; b.lineWidth = 2; b.beginPath(); b.moveTo(x, y - 1); b.lineTo(x + Math.cos(o.aim) * 11, y - 1 + Math.sin(o.aim) * 11); b.stroke();
            break;
          }
          this.shadow(b, x, y + 4, 5);
          b.fillStyle = '#1a1530'; b.fillRect(x - 5, y - 3, 10, 8); b.fillStyle = '#565d72'; b.fillRect(x - 4, y - 2, 8, 6);
          b.fillStyle = W.mode === 'tdm' ? TEAM_COL[o.team] || '#fff' : '#ffd23f'; b.fillRect(x - 2, y, 4, 2);
          b.strokeStyle = '#1a1530'; b.lineWidth = 3; b.beginPath(); b.moveTo(x, y - 1); b.lineTo(x + Math.cos(o.aim) * 8, y - 1 + Math.sin(o.aim) * 8); b.stroke();
          b.strokeStyle = '#9aa3b5'; b.lineWidth = 1; b.beginPath(); b.moveTo(x + 0.5, y - 0.5); b.lineTo(x + 0.5 + Math.cos(o.aim) * 7, y - 0.5 + Math.sin(o.aim) * 7); b.stroke();
          break;
        }
      }
    }
    // 엔티티 (y 정렬)
    const ents = this._ents || (this._ents = []); ents.length = 0;
    const meInSmoke = me && W.smokeAt(me.x, me.y);
    for (const p of W.players) {
      if (!p.alive || !inView(p.x, p.y)) continue;
      if (p !== me && W.smokeAt(p.x, p.y) && !(meInSmoke && meInSmoke === W.smokeAt(p.x, p.y)) && !(W.mode === 'tdm' && me && p.team === me.team)) continue;
      if (p !== me && W.hiddenFrom(p, me)) continue;
      ents.push(p);
    }
    for (const o of W.objs) if (o.k === 'decoy' && inView(o.x, o.y)) ents.push(o);
    ents.sort((a, c) => a.y - c.y);
    const vis = this._vis; vis.length = 0;
    for (const e of ents) {
      if (e.k === 'decoy') { const own = W.byId.get(e.owner); if (own) { const d = { ...own, x: e.x, y: e.y, aim: e.aim, r: e.r, alive: true, hurtT: 0, invulnT: 0, shieldT: 0, tauntT: 0, frozenT: 0, stunT: 0, swingT: 9, spinT: 0, decoy: true, id: 'd' + e.id }; this.drawSlime(b, d, cx, cy, dt, me, W); vis.push(d); } continue; }
      const lp = this.leaps.get(e.id);
      if (lp) {
        lp.t += dt; const k = Math.min(1, lp.t / lp.dur);
        if (k >= 1 && !e.leapT) { this.leaps.delete(e.id); }
        else {
          const d = { ...e, x: lp.x0 + (lp.x1 - lp.x0) * k, y: lp.y0 + (lp.y1 - lp.y0) * k, _lift: Math.sin(k * Math.PI) * 34, swingT: 9, _me: e === me };
          this.drawSlime(b, d, cx, cy, dt, me, W); vis.push(d); continue;
        }
      }
      this.drawSlime(b, e, cx, cy, dt, me, W); vis.push(e);
    }
    // 수풀 (캐릭터 위). 나와 아군이 들어간 수풀은 반투명하게
    {
      const sx = Math.max(0, cx), sy = Math.max(0, cy), sw = Math.min(map.pw - sx, vw - (sx - cx)), sh = Math.min(map.ph - sy, vh - (sy - cy));
      if (sw > 0 && sh > 0 && map.bushCount) {
        const holes = [];
        for (const p of W.players) if (p.alive && (p === me || (W.mode === 'tdm' && me && p.team === me.team)) && W.map && this.inBush(p)) holes.push(p);
        if (holes.length) {
          b.save(); b.beginPath(); b.rect(0, 0, vw, vh);
          for (const p of holes) { b.moveTo(p.x - cx + 15, p.y - cy - 2); b.arc(p.x - cx, p.y - cy - 2, 15, 0, TAU); }
          b.clip('evenodd');
          b.drawImage(this.bushCanvas, sx, sy, sw, sh, sx - cx, sy - cy, sw, sh);
          b.restore();
          b.save(); b.beginPath(); for (const p of holes) { b.moveTo(p.x - cx + 15, p.y - cy - 2); b.arc(p.x - cx, p.y - cy - 2, 15, 0, TAU); } b.clip();
          b.globalAlpha = 0.4; b.drawImage(this.bushCanvas, sx, sy, sw, sh, sx - cx, sy - cy, sw, sh); b.globalAlpha = 1; b.restore();
        } else b.drawImage(this.bushCanvas, sx, sy, sw, sh, sx - cx, sy - cy, sw, sh);
      }
    }
    // 탄
    for (const bl of W.bullets) {
      if (!inView(bl.x, bl.y, 8)) continue;
      this.drawBullet(b, bl, bl.x - cx, bl.y - cy);
    }
    // 즉발 무기 예고선
    for (const [id, c] of this.charges) {
      c.t -= dt; const p = W.byId.get(id);
      if (c.t <= 0 || !p || !p.alive) { this.charges.delete(id); continue; }
      const ex = p.x + Math.cos(c.ang) * c.range, ey = p.y + Math.sin(c.ang) * c.range;
      const f = raycast(this.map, p.x, p.y, ex, ey), lx = p.x + (ex - p.x) * f, ly = p.y + (ey - p.y) * f;
      const k = 1 - c.t / c.max, blink = ((this.time * 20) | 0) % 2;
      b.globalAlpha = 0.35 + k * 0.55;
      b.strokeStyle = blink && k > 0.6 ? '#ffffff' : '#ff3b4f'; b.lineWidth = k > 0.6 ? 2 : 1;
      b.beginPath(); b.moveTo(p.x - cx, p.y - cy); b.lineTo(lx - cx, ly - cy); b.stroke();
      b.fillStyle = '#ff3b4f'; b.fillRect(Math.round(lx - cx) - 1, Math.round(ly - cy) - 1, 3, 3);
      b.globalAlpha = 1;
    }
    // 모바일 조준선
    if (opt.aimLine && me) this.drawAim(b, me, cx, cy, opt.aimLine);
    // 파티클
    this.drawParticles(b, cx, cy, dt);
    // 레이
    for (let i = this.rays.length - 1; i >= 0; i--) {
      const r = this.rays[i]; r.life -= dt; if (r.life <= 0) { this.rays.splice(i, 1); continue; }
      const a = r.life / r.max, x0 = r.x0 - cx, y0 = r.y0 - cy, x1 = r.x1 - cx, y1 = r.y1 - cy;
      b.globalAlpha = Math.min(1, a * 1.5);
      if (r.kind === 'bolt' || r.kind === 'zap') {
        const segs = 7, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        for (let pass = 0; pass < 2; pass++) {
          b.strokeStyle = pass ? '#ffffff' : (r.kind === 'bolt' ? '#ffd23f' : '#4fc3ff'); b.lineWidth = pass ? 1 : 3;
          b.beginPath(); b.moveTo(x0, y0);
          for (let k = 1; k < segs; k++) { const j = rand(-5, 5); b.lineTo(x0 + dx * k / segs + nx * j, y0 + dy * k / segs + ny * j); }
          b.lineTo(x1, y1); b.stroke();
        }
      } else {
        const col = r.kind === 'laser' ? '#ff3b4f' : '#ffe9a8';
        b.strokeStyle = col; b.lineWidth = r.kind === 'laser' ? 3 * a + 1 : 2 * a + 0.5;
        b.beginPath(); b.moveTo(x0, y0); b.lineTo(x1, y1); b.stroke();
        b.strokeStyle = '#ffffff'; b.lineWidth = 1; b.beginPath(); b.moveTo(x0, y0); b.lineTo(x1, y1); b.stroke();
      }
      b.globalAlpha = 1;
    }
    // 폭발 링
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.life -= dt; if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      const k = 1 - r.life / r.max;
      b.globalAlpha = r.life / r.max; b.strokeStyle = r.color; b.lineWidth = 2;
      b.beginPath(); b.arc(r.x - cx, r.y - cy, r.r * (0.3 + 0.7 * k), 0, TAU); b.stroke();
      if (k < 0.3) { b.fillStyle = r.color; b.globalAlpha = (0.3 - k) * 2; b.beginPath(); b.arc(r.x - cx, r.y - cy, r.r * 0.6, 0, TAU); b.fill(); }
      b.globalAlpha = 1;
    }
    // 연막 (최상단)
    for (const o of W.objs) {
      if (o.k !== 'smoke' || !inView(o.x, o.y, 60)) continue;
      const fade = Math.min(1, o.life / 1.2), grow = Math.min(1, (7 - o.life) * 4 + 0.3);
      for (let i = 0; i < this.smokeOff.length; i++) {
        const s = this.smokeOff[i], a = s[3] + this.time * 0.3;
        const px = o.x - cx + s[0] * o.r + Math.cos(a) * 3, py = o.y - cy + s[1] * o.r * 0.8 + Math.sin(a) * 3;
        b.globalAlpha = 0.88 * fade; b.fillStyle = i % 3 ? '#b8bdc9' : '#d6dae3';
        b.beginPath(); b.arc(px, py, s[2] * o.r * grow, 0, TAU); b.fill();
      }
      b.globalAlpha = 1;
    }
    // 비둘기 편대
    for (let i = this.pigeons.length - 1; i >= 0; i--) {
      const pg = this.pigeons[i]; pg.t += dt; if (pg.t > 1.6) { this.pigeons.splice(i, 1); continue; }
      for (let k = 0; k < 3; k++) {
        const px = pg.x - 120 + pg.t * 160 + k * -14 - cx, py = pg.y - 70 + k * 8 - pg.t * 10 - cy;
        b.drawImage(icon('pigeon'), px | 0, (py + Math.sin(this.time * 20 + k) * 1.5) | 0);
      }
    }
    // 안개 이벤트
    if (opt.event === 'fog' && me) {
      const mx = me.x - cx, my = me.y - cy;
      const g = b.createRadialGradient(mx, my, 40, mx, my, 120);
      g.addColorStop(0, 'rgba(20,22,30,0)'); g.addColorStop(1, 'rgba(20,22,30,0.93)');
      b.fillStyle = g; b.fillRect(0, 0, vw, vh);
    }
    if (opt.event === 'ice') { b.fillStyle = 'rgba(150,220,255,0.08)'; b.fillRect(0, 0, vw, vh); }
    if (this.flash > 0) { b.fillStyle = `rgba(255,240,200,${this.flash})`; b.fillRect(0, 0, vw, vh); this.flash -= dt; }

    // ── 확대 출력 ──
    const ctx = this.ctx, S = this.scale;
    if (this.shakeT > 0) { this.shakeT -= dt; const a = this.shakeA * (this.shakeT / 0.25); this.sx = rand(-a, a) * S; this.sy = rand(-a, a) * S; if (this.shakeT <= 0) this.shakeA = 0; }
    else { this.sx = this.sy = 0; }
    ctx.fillStyle = this.theme.bg; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.buf, 0, 0, vw, vh, Math.round(this.sx), Math.round(this.sy), vw * S, vh * S);
    this.drawOverlay(ctx, W, me, cx, cy, dt, opt);
  }

  drawAim(b, me, cx, cy, A) {
    const x0 = me.x, y0 = me.y;
    const ray = (ang) => { const ex = x0 + Math.cos(ang) * A.len, ey = y0 + Math.sin(ang) * A.len; const f = A.through ? 1 : raycast(this.map, x0, y0, ex, ey); return [x0 + (ex - x0) * f, y0 + (ey - y0) * f]; };
    const col = A.superAim ? '255,210,63' : A.skill ? '120,200,255' : '255,255,255';
    const drawLine = (ang, alpha) => {
      const [ex, ey] = ray(ang), dx = ex - x0, dy = ey - y0, L = Math.hypot(dx, dy), n = Math.floor(L / 6);
      b.fillStyle = `rgba(${col},${alpha})`;
      for (let i = 1; i <= n; i++) { const t = i / (L / 6); b.fillRect(Math.round(x0 + dx * t / 1 - cx) - 1, Math.round(y0 + dy * t - cy) - 1, 2, 2); }
      return [ex, ey];
    };
    if (A.spread > 0.05) { drawLine(A.ang - A.spread, 0.35); drawLine(A.ang + A.spread, 0.35); }
    const [ex, ey] = drawLine(A.ang, 0.75);
    b.strokeStyle = `rgba(${col},0.8)`; b.lineWidth = 1;
    if (A.circle) { b.beginPath(); b.arc(Math.round(ex - cx) + 0.5, Math.round(ey - cy) + 0.5, 12, 0, TAU); b.stroke(); }
    else { b.beginPath(); b.arc(Math.round(ex - cx) + 0.5, Math.round(ey - cy) + 0.5, 3, 0, TAU); b.stroke(); }
  }

  inBush(p) { const m = this.map, tx = (p.x / TILE) | 0, ty = (p.y / TILE) | 0; return tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && m.grid[ty * m.w + tx] === 8; }

  shadow(b, x, y, w) { b.fillStyle = 'rgba(0,0,0,0.28)'; b.fillRect((x - w) | 0, y | 0, (w * 2) | 0, 2); b.fillRect((x - w + 1) | 0, (y - 1) | 0, (w * 2 - 2) | 0, 1); }

  drawSlime(b, p, cx, cy, dt, me, W) {
    let a = this.anim.get(p.id);
    if (!a) { a = { phase: 0, lx: p.x, ly: p.y, blink: rand(1, 4), sq: 0 }; this.anim.set(p.id, a); }
    const mv = Math.hypot(p.x - a.lx, p.y - a.ly) / Math.max(dt, 0.001);
    a.lx = p.x; a.ly = p.y;
    const moving = Math.min(1, mv / 70);
    a.phase += dt * (6 + moving * 10);
    a.blink -= dt; const blinking = a.blink < 0.12; if (a.blink < 0) a.blink = rand(2, 5);
    const sc = (p.r || 6) / 6;
    let sx = 1, sy = 1, hop = 0, flip = Math.cos(p.aim) < 0 ? -1 : 1, rot = 0;
    const idle = Math.sin(a.phase * 0.6) * 0.04;
    sx += idle; sy -= idle;
    if (moving > 0.1) { const s = Math.abs(Math.sin(a.phase)); hop = -s * 2.2 * moving; sy += (s - 0.5) * 0.14 * moving; sx -= (s - 0.5) * 0.1 * moving; }
    if (p.tauntT > 0) {
      const t = this.time * 10, ti = p.lo ? p.lo.t : 0;
      if (ti === 0) { sx += Math.sin(t) * 0.18; sy -= Math.sin(t) * 0.14; }
      else if (ti === 1) { hop = -Math.abs(Math.sin(t * 0.8)) * 5; }
      else if (ti === 2) { rot = Math.sin(t * 0.5) * 0.3; }
      else if (ti === 3) { sy += Math.sin(t * 0.7) * 0.25; sx -= Math.sin(t * 0.7) * 0.2; }
      else if (ti === 4) { flip = Math.sin(t * 1.4) > 0 ? 1 : -1; sx *= Math.abs(Math.sin(t * 1.4)) * 0.7 + 0.3; }
      else { hop = -Math.abs(Math.sin(t * 0.9)) * 3; sx += Math.sin(t * 1.8) * 0.06; }
    }
    if (p.frozenT > 0) { sx = 1; sy = 1; hop = 0; }
    const x = Math.round(p.x - cx), y = Math.round(p.y - cy);
    const w = 16 * sc * sx, h = 14 * sc * sy;
    const feet = y + 5 * sc;
    this.shadow(b, x, feet, 6 * sc);
    if (p._lift) { hop -= p._lift; }
    if (p.spinT > 0) { flip = Math.sin(this.time * 40) > 0 ? 1 : -1; if (Math.random() < 0.6) this.part(p.x + rand(-10, 10), p.y + rand(-4, 6), rand(-40, 40), rand(-30, 0), 0.3, 1, '#e6e9f0'); }
    const top = feet - h + hop;
    if (a.recoil > 0) a.recoil -= dt; this._rc = a.recoil > 0;
    const aimBehind = Math.sin(p.aim) < -0.35;
    const alpha = p.invulnT > 0 ? (((this.time * 12) | 0) % 2 ? 0.45 : 0.9) : 1;
    b.globalAlpha = alpha;
    if (aimBehind) this.drawWeapon(b, p, x, y + hop, sc);
    // 본체
    b.save();
    b.translate(x, feet + hop);
    if (rot) b.rotate(rot);
    b.scale(flip, 1);
    b.drawImage(p.hurtT > 0 ? slimeFlash() : slimeSprite(p.color), -w / 2, -h, w, h);
    b.restore();
    // 얼굴
    const fx = x, fy = Math.round(top + h * 0.5);
    if (sc > 0.9 && sc < 1.1) drawFace(b, p.face || 0, fx, fy, Math.cos(p.aim), Math.sin(p.aim), blinking, this.time);
    else { b.save(); b.translate(fx, fy); b.scale(sc, sc); drawFace(b, p.face || 0, 0, 0, Math.cos(p.aim), Math.sin(p.aim), blinking, this.time); b.restore(); }
    if (p.lo && p.tauntT > 0 && p.lo.t === 5) { b.fillStyle = '#e8434f'; b.fillRect(fx - 1, fy + 4, 2, 2); }
    // 모자
    if (p.hat) { if (sc > 0.9 && sc < 1.1) drawHat(b, p.hat, x, Math.round(top + 1)); else { b.save(); b.translate(x, top + 1); b.scale(sc, sc); drawHat(b, p.hat, 0, 0); b.restore(); } }
    if (!aimBehind) this.drawWeapon(b, p, x, y + hop, sc);
    b.globalAlpha = 1;
    // 상태 효과
    if (p.frozenT > 0) { b.fillStyle = 'rgba(170,230,255,0.55)'; b.fillRect(x - 9 * sc, feet - 16 * sc, 18 * sc, 17 * sc); b.fillStyle = '#ffffff'; b.fillRect(x - 6 * sc, feet - 14 * sc, 2, 1); b.fillRect(x + 4 * sc, feet - 7 * sc, 1, 2); }
    if (p.shieldT > 0) {
      b.strokeStyle = 'rgba(120,220,255,0.9)'; b.lineWidth = 2;
      b.beginPath(); b.arc(x, y, 11 * sc, p.aim - 1.2, p.aim + 1.2); b.stroke();
      b.strokeStyle = 'rgba(255,255,255,0.8)'; b.lineWidth = 1; b.beginPath(); b.arc(x, y, 12 * sc, p.aim - 0.6, p.aim + 0.2); b.stroke();
    }
    if (p.stunT > 0) { for (let k = 0; k < 3; k++) { const ang = this.time * 6 + k * 2.1; b.fillStyle = '#ffd23f'; b.fillRect(Math.round(x + Math.cos(ang) * 7), Math.round(top - 3 + Math.sin(ang) * 2), 2, 2); } }
    if (p.slowT > 0) { b.strokeStyle = 'rgba(160,230,255,0.7)'; b.lineWidth = 1; b.beginPath(); b.arc(x, feet - 6 * sc, 9 * sc, 0, TAU); b.stroke(); }
    if (p.chill > 0) { b.fillStyle = '#c8f4ff'; for (let k = 0; k < p.chill; k++) b.fillRect(x - 4 + k * 3, top - 4, 2, 2); }
    if (p.burnT > 0 && Math.random() < 0.5) this.part(p.x + rand(-5, 5), p.y + rand(-4, 2), rand(-8, 8), rand(-40, -20), 0.35, 2, Math.random() < 0.5 ? '#ff8f1f' : '#ffd23f');
    if (p.healT > 0 && Math.random() < 0.3) this.part(p.x + rand(-6, 6), p.y + 2, 0, -25, 0.6, 1, '#7dff9b');
    if (p.giantT > 0 && Math.random() < 0.2) this.part(p.x + rand(-8, 8), p.y + rand(-8, 4), 0, -15, 0.5, 1, '#ffd23f');
    if (p.slipT > 0 && Math.random() < 0.5) this.part(p.x, p.y + 5, rand(-20, 20), rand(-10, 0), 0.3, 1, '#ffd23f');
    if (p.spinT > 0) { b.strokeStyle = 'rgba(255,255,255,0.6)'; b.lineWidth = 1; b.beginPath(); b.arc(x, y, 30, this.time * 12, this.time * 12 + 4); b.stroke(); }
    if ((p === me || p._me) && me.superCh >= 1) { const g = 0.5 + Math.sin(this.time * 8) * 0.3; b.strokeStyle = `rgba(255,210,63,${g})`; b.lineWidth = 1; b.beginPath(); b.ellipse(x, feet + 1, 10 * sc, 4 * sc, 0, 0, TAU); b.stroke(); }
    p._sy = top + cy; // 이름 위치용 (월드 좌표)
  }

  drawWeapon(b, p, x, y, sc) {
    if (!p.lo) return;
    const swinging = p.swingT < 0.22;
    if (swinging && p.tauntT <= 0) {
      const mw = MELEE[p.lo.m];
      const k = Math.min(1, p.swingT / 0.15), ease = 1 - (1 - k) * (1 - k);
      const ang = p.aim - mw.arc / 2 + mw.arc * ease;
      const reach = (6 + Math.min(mw.range, 30) * 0.35) * sc;
      // 궤적
      b.strokeStyle = 'rgba(255,255,255,0.55)'; b.lineWidth = 2;
      b.beginPath(); b.arc(x, y, mw.range * sc * 0.8, p.aim - mw.arc / 2, ang); b.stroke();
      b.save(); b.translate(x + Math.cos(ang) * reach * 0.5, y + Math.sin(ang) * reach * 0.5); b.rotate(ang + Math.PI / 4);
      if (sc !== 1) b.scale(sc, sc);
      b.drawImage(icon(MELEE[p.lo.m].id), -4, -8);
      b.restore();
      return;
    }
    if (p.tauntT > 0) return;
    b.save();
    b.translate(x, y + 1);
    b.rotate(p.aim);
    if (Math.cos(p.aim) < 0) b.scale(1, -1);
    if (sc !== 1) b.scale(sc, sc);
    const recoil = this._rc ? -2 : 0;
    b.drawImage(icon(PRIMARY[p.lo.p].id), 3 + recoil, -6);
    b.restore();
  }

  drawBullet(b, bl, x, y) {
    x = Math.round(x); y = Math.round(y);
    const ang = Math.atan2(bl.vy, bl.vx), c = Math.cos(ang), s = Math.sin(ang);
    switch (bl.t) {
      case 'pea': case 'rev':
        b.fillStyle = bl.t === 'rev' ? '#ffb347' : '#c9a227'; b.fillRect(Math.round(x - c * 3), Math.round(y - s * 3), 2, 2); b.fillRect(Math.round(x - c * 5), Math.round(y - s * 5), 1, 1);
        b.fillStyle = '#fff6c9'; b.fillRect(x - 1, y - 1, 2, 2); break;
      case 'pellet': b.fillStyle = '#ffcf6b'; b.fillRect(x, y, 2, 2); b.fillStyle = '#ff8f1f'; b.fillRect(Math.round(x - c * 2), Math.round(y - s * 2), 1, 1); break;
      case 'bread': b.fillStyle = '#6b4220'; b.fillRect(x - 2, y - 1, 4, 3); b.fillStyle = '#e0a060'; b.fillRect(x - 1, y - 1, 3, 2); break;
      case 'duck': {
        b.fillStyle = '#1a1530'; b.fillRect(x - 3, y - 3, 7, 6);
        b.fillStyle = '#ffd23f'; b.fillRect(x - 2, y - 2, 5, 4); b.fillRect(x - 1, y - 4, 3, 2);
        b.fillStyle = '#ff8f1f'; b.fillRect(c >= 0 ? x + 3 : x - 4, y - 3, 2, 1);
        b.fillStyle = '#1a1530'; b.fillRect(c >= 0 ? x + 1 : x - 1, y - 4, 1, 1);
        break;
      }
      case 'bubble': {
        const r = bl.rad + Math.sin(this.time * 12 + bl.id) * 0.6;
        b.strokeStyle = 'rgba(160,230,255,0.9)'; b.lineWidth = 1; b.beginPath(); b.arc(x, y, r, 0, TAU); b.stroke();
        b.fillStyle = 'rgba(200,244,255,0.25)'; b.fill(); b.fillStyle = '#fff'; b.fillRect(x - 2, y - 2, 1, 1);
        break;
      }
      case 'ice': b.fillStyle = '#4fc3ff'; b.fillRect(Math.round(x - c * 3), Math.round(y - s * 3), 2, 2); b.fillStyle = '#e6faff'; b.fillRect(x - 1, y - 1, 3, 3); break;
      case 'flame': {
        const age = 1 - Math.max(0, bl.life) / 0.52, r = 1.5 + age * 5;
        b.globalAlpha = Math.max(0, 0.9 - age * 0.8);
        b.fillStyle = age < 0.3 ? '#fff1a8' : age < 0.6 ? '#ff9f1f' : '#e8434f';
        b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill(); b.globalAlpha = 1; break;
      }
      case 'disc': {
        const sp = this.time * 30;
        b.fillStyle = '#1a1530'; b.fillRect(x - 4, y - 2, 9, 5); b.fillStyle = '#9b5de5'; b.fillRect(x - 3, y - 1, 7, 3);
        b.fillStyle = '#ffffff'; b.fillRect(x + Math.round(Math.cos(sp) * 2), y - 1, 1, 1); break;
      }
      case 'kernel': b.fillStyle = '#1a1530'; b.fillRect(x - 2, y - 2, 4, 4); b.fillStyle = '#ffd23f'; b.fillRect(x - 1, y - 1, 2, 2); break;
      case 'pop': b.fillStyle = '#fff8e0'; b.fillRect(x - 1, y - 1, 3, 3); b.fillStyle = '#ffd23f'; b.fillRect(x, y, 1, 1); break;
      case 'hole': {
        b.save(); b.translate(x, y); b.rotate(this.time * 14);
        b.fillStyle = '#1a1530'; b.fillRect(-3, -4, 6, 8); b.fillStyle = '#3d1a66'; b.fillRect(-2, -3, 4, 6); b.fillStyle = '#9b5de5'; b.fillRect(-1, -2, 1, 3);
        b.restore(); if (Math.random() < 0.5) this.part(bl.x, bl.y, rand(-20, 20), rand(-20, 20), 0.3, 1, '#c79bff'); break;
      }
      default: b.fillStyle = '#fff'; b.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  drawParticles(b, cx, cy, dt) {
    const items = this.parts.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i]; if (!p.active) continue;
      p.life -= dt; if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.grav * dt; if (p.drag) { const f = 1 - p.drag * dt; p.vx *= f; p.vy *= f; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const x = p.x - cx, y = p.y - cy;
      if (x < -10 || y < -10 || x > this.vw + 10 || y > this.vh + 10) continue;
      const a = p.life / p.max;
      if (p.kind === 1) { b.globalAlpha = a * 0.6; b.fillStyle = p.color; b.beginPath(); b.arc(x, y, p.size * (1.4 - a * 0.4), 0, TAU); b.fill(); b.globalAlpha = 1; }
      else { if (a < 0.35) b.globalAlpha = a / 0.35; b.fillStyle = p.color; b.fillRect(x | 0, y | 0, p.size, p.size); b.globalAlpha = 1; }
    }
  }

  // ── 고해상도 오버레이 ──
  drawOverlay(ctx, W, me, cx, cy, dt, opt) {
    const S = this.scale, dpr = this.dpr, ox = this.sx, oy = this.sy;
    const fs = Math.round(10 * dpr * this.uiScale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round';
    // 이름 + 체력바 (고해상도)
    ctx.lineWidth = Math.max(2, 3 * dpr);
    const zs = S / dpr, tfs = Math.round((9 + zs) * dpr * this.uiScale);
    for (const p of this._vis) {
      if (p._sy === undefined || p.dummyHide) continue;
      const x = (p.x - cx) * S + ox, topY = (p._sy - cy - (p.hat ? 7 : 3)) * S + oy;
      if (x < -60 || topY < -40 || x > this.canvas.width + 60 || topY > this.canvas.height + 40) { p._sy = undefined; continue; }
      const isMe = p === me || p._me, ally = !isMe && W.mode === 'tdm' && me && p.team === me.team;
      const bw = Math.round((42 + 5 * zs) * dpr * this.uiScale), bh = Math.round((5 + zs * 0.6) * dpr * this.uiScale);
      const bx = Math.round(x - bw / 2), by = Math.round(topY - bh);
      const f = clamp(p.hp / p.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(20,16,36,0.92)'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#3a3448'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = isMe ? '#5ee07a' : ally ? '#4fa8ff' : '#ff4d5e'; ctx.fillRect(bx, by, Math.ceil(bw * f), bh);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx, by, Math.ceil(bw * f), Math.max(1, bh / 3) | 0);
      // 체력 숫자
      ctx.font = `bold ${tfs}px Galmuri11, monospace`; ctx.textBaseline = 'bottom';
      const hpTxt = String(Math.max(0, Math.ceil(p.hp)));
      ctx.strokeStyle = 'rgba(20,16,36,0.95)'; ctx.strokeText(hpTxt, x, by - 3);
      ctx.fillStyle = '#ffffff'; ctx.fillText(hpTxt, x, by - 3);
      // 내 탄약 칸
      if (isMe && p.lo) {
        const w = PRIMARY[p.lo.p], ay = by + bh + 4, ah = Math.max(3, Math.round(bh * 0.7));
        ctx.fillStyle = 'rgba(20,16,36,0.92)'; ctx.fillRect(bx - 2, ay - 1, bw + 4, ah + 2);
        if (opt.reloading) { ctx.fillStyle = '#7a5a10'; ctx.fillRect(bx, ay, bw, ah); ctx.fillStyle = '#ff9f1f'; ctx.fillRect(bx, ay, Math.round(bw * opt.reloadPct), ah); }
        else if (w.mag <= 12) { const seg = bw / w.mag; for (let i = 0; i < w.mag; i++) { ctx.fillStyle = i < p.ammo ? '#ffd23f' : '#4a4256'; ctx.fillRect(Math.round(bx + i * seg), ay, Math.max(1, Math.round(seg) - 1), ah); } }
        else { ctx.fillStyle = '#4a4256'; ctx.fillRect(bx, ay, bw, ah); ctx.fillStyle = '#ffd23f'; ctx.fillRect(bx, ay, Math.round(bw * p.ammo / w.mag), ah); }
      }
      // 이름
      if (!isMe) {
        ctx.font = `${fs}px Galmuri11, monospace`;
        const ny = by - 3 - tfs - 1;
        ctx.strokeStyle = 'rgba(20,16,36,0.9)'; ctx.strokeText(p.name, x, ny);
        ctx.fillStyle = W.mode === 'tdm' ? (p.team === 0 ? '#ffb3bd' : '#b3d6ff') : (p.bot ? '#e6e9f0' : '#ffffff');
        ctx.fillText(p.name, x, ny);
      }
      p._sy = undefined;
    }
    // 감정표현 말풍선
    for (const [id, bb] of this.bubbles) {
      bb.t -= dt; if (bb.t <= 0) { this.bubbles.delete(id); continue; }
      const p = W.byId.get(id); if (!p || !p.alive) continue;
      const x = (p.x - cx) * S + ox, y = (p.y - cy - 26) * S + oy - Math.sin(Math.min(1, (2.2 - bb.t) * 5) * Math.PI / 2) * 6 * dpr;
      ctx.font = `bold ${Math.round(13 * dpr * this.uiScale)}px Galmuri11, monospace`;
      const tw = ctx.measureText(bb.text).width + 12 * dpr, th = 18 * dpr * this.uiScale;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1530'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.rect(x - tw / 2, y - th, tw, th); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4 * dpr, y); ctx.lineTo(x, y + 5 * dpr); ctx.lineTo(x + 4 * dpr, y); ctx.fill();
      ctx.fillStyle = '#1a1530'; ctx.textBaseline = 'middle'; ctx.fillText(bb.text, x, y - th / 2 + dpr); ctx.textBaseline = 'bottom';
    }
    // 데미지 숫자
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.life -= dt; if (n.life <= 0) { this.nums.splice(i, 1); continue; }
      n.y += n.vy * dt; n.vy += 70 * dt;
      const x = (n.x - cx) * S + ox, y = (n.y - cy) * S + oy;
      const pop = n.life > 0.65 ? 1 + (n.life - 0.65) * 3 : 1;
      ctx.font = `${n.big ? 'bold ' : ''}${Math.round((n.big ? 15 : 12) * dpr * pop * this.uiScale)}px Galmuri11, monospace`;
      ctx.globalAlpha = Math.min(1, n.life * 3);
      ctx.lineWidth = 3 * dpr; ctx.strokeStyle = '#1a1530'; ctx.strokeText(n.text, x, y);
      ctx.fillStyle = n.color; ctx.fillText(n.text, x, y);
      ctx.globalAlpha = 1;
    }
    // 피격 비네트
    const W2 = this.canvas.width, H2 = this.canvas.height;
    if (this.hurtFlash > 0 || (me && me.alive && me.hp < me.maxHp * 0.3)) {
      const low = me && me.alive && me.hp < me.maxHp * 0.3 ? 0.25 + Math.sin(this.time * 6) * 0.12 : 0;
      const a = Math.min(0.7, this.hurtFlash + low);
      const g = ctx.createRadialGradient(W2 / 2, H2 / 2, Math.min(W2, H2) * 0.35, W2 / 2, H2 / 2, Math.max(W2, H2) * 0.7);
      g.addColorStop(0, 'rgba(232,50,70,0)'); g.addColorStop(1, `rgba(232,50,70,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W2, H2);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    }
    // 조준선 (마우스)
    if (opt.crosshair && me && me.alive) {
      const x = opt.crosshair.x * dpr, y = opt.crosshair.y * dpr, s = 6 * dpr, g = 3 * dpr;
      ctx.strokeStyle = '#1a1530'; ctx.lineWidth = 4 * dpr;
      const draw = () => { ctx.beginPath(); ctx.moveTo(x - s - g, y); ctx.lineTo(x - g, y); ctx.moveTo(x + g, y); ctx.lineTo(x + s + g, y); ctx.moveTo(x, y - s - g); ctx.lineTo(x, y - g); ctx.moveTo(x, y + g); ctx.lineTo(x, y + s + g); ctx.stroke(); };
      draw(); ctx.strokeStyle = opt.reloading ? '#ffd23f' : '#ffffff'; ctx.lineWidth = 2 * dpr; draw();
      if (opt.reloading) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(x, y, 14 * dpr, -Math.PI / 2, -Math.PI / 2 + TAU * opt.reloadPct); ctx.stroke(); }
      if (this.hitMark > 0) {
        this.hitMark -= dt; const k = 9 * dpr, i = 4 * dpr;
        ctx.strokeStyle = this.hitKill ? '#ff4d5e' : '#ffffff'; ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x - i, y - i); ctx.moveTo(x + k, y - k); ctx.lineTo(x + i, y - i); ctx.moveTo(x - k, y + k); ctx.lineTo(x - i, y + i); ctx.moveTo(x + k, y + k); ctx.lineTo(x + i, y + i); ctx.stroke();
      }
    } else if (this.hitMark > 0) this.hitMark -= dt;
  }
}
