// 게임 시뮬레이션 (오프라인/방장 전용 권한 서버)
import { PRIMARY, MELEE, SKILL, TAUNT, EVENTS, rollItem, BOT_NAMES, SLIME_COLORS } from './data.js';
import { getMap, moveCircle, tileAtPx, solidPx, raycast, lineOfSight, TILE } from './maps.js';
import { clamp, dist2, angDiff, rand, pick, shuffle, TAU } from './util.js';
import { botThink, botInit } from './bot.js';

export const TICK = 1 / 60;
export const RESPAWN_TIME = 4.2;
const BASE_SPEED = 70;
export const MAX_HP = 140;
const BULLET_LIST_MAX = 400;

// ── 공용 이동 물리 (방장과 클라이언트 예측이 동일 코드를 사용) ──
export function playerScale(p, ev) {
  let s = 1;
  if (p.giantT > 0) s *= 1.45;
  if (ev === 'giant') s *= 1.3; else if (ev === 'mini') s *= 0.72;
  return s;
}
export function stepMovement(p, map, dt, ev, vortexes) {
  const sc = playerScale(p, ev);
  p.r = 6 * sc;
  let spd = BASE_SPEED;
  if (ev === 'mini') spd *= 1.22;
  if (p.giantT > 0) spd *= 0.92;
  if (p.slowT > 0) spd *= 0.62;
  if (p.chill > 0) spd *= 1 - p.chill * 0.12;
  if (p.tauntT > 0) spd *= 0.3;
  if (p.frozenT > 0 || p.stunT > 0 || !p.alive) spd = 0;
  const tile = tileAtPx(map, p.x, p.y);
  const icy = tile === 3 || ev === 'ice' || p.slipT > 0;
  let mx = p.in.mx, my = p.in.my;
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  const tx = mx * spd, ty = my * spd;
  const accel = icy ? 160 : 1100;
  const k = Math.min(1, accel * dt / Math.max(1, Math.hypot(tx - p.vx, ty - p.vy)));
  p.vx += (tx - p.vx) * k; p.vy += (ty - p.vy) * k;
  // 넉백 등 과속 감쇠
  const sp = Math.hypot(p.vx, p.vy), cap = spd * 1.05;
  if (sp > cap) { const f = Math.max(cap / sp, 1 - (icy ? 0.6 : 5.5) * dt); p.vx *= f; p.vy *= f; }
  let dx = p.vx * dt, dy = p.vy * dt;
  // 컨베이어 벨트
  if (tile >= 4 && tile <= 7 && p.alive) {
    const bs = 52 * dt;
    if (tile === 4) dx += bs; else if (tile === 5) dx -= bs; else if (tile === 6) dy -= bs; else dy += bs;
  }
  // 블랙홀 흡입
  if (vortexes) for (let i = 0; i < vortexes.length; i++) {
    const v = vortexes[i]; if (v.owner === p.id) continue;
    const ddx = v.x - p.x, ddy = v.y - p.y, d = Math.hypot(ddx, ddy);
    if (d < 90 && d > 2) { const f = 150 * (1 - d / 90) * dt + 18 * dt; dx += ddx / d * f; dy += ddy / d * f; }
  }
  moveCircle(map, p, dx, dy, p.r);
}

// 탄 이동 (결정적). 반환: 0 계속, 1 벽에서 소멸
export function stepBullet(b, map, dt) {
  let nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
  if (solidPx(map, nx, ny)) {
    if (b.bounce > 0) {
      b.bounce--;
      const hitX = solidPx(map, nx, b.y), hitY = solidPx(map, b.x, ny);
      if (hitX || !hitY) b.vx = -b.vx;
      if (hitY || !hitX) b.vy = -b.vy;
      nx = b.x + b.vx * dt; ny = b.y + b.vy * dt;
      if (solidPx(map, nx, ny)) { nx = b.x; ny = b.y; }
      b.bounced = true;
    } else { b.x = nx; b.y = ny; return 1; }
  }
  b.x = nx; b.y = ny;
  if (b.t === 'flame') { b.vx *= 1 - 1.8 * dt; b.vy *= 1 - 1.8 * dt; }
  if (b.t === 'bubble') { b.vx *= 1 - 0.6 * dt; b.vy *= 1 - 0.6 * dt; }
  return 0;
}

function makePlayer(id, o) {
  return {
    id, name: o.name, color: o.color, face: o.face | 0, hat: o.hat | 0, team: o.team ?? -1, bot: !!o.bot, remote: !!o.remote, dummy: !!o.dummy,
    x: 0, y: 0, vx: 0, vy: 0, r: 6, aim: 0, hp: MAX_HP, maxHp: MAX_HP, alive: false, respawnT: 0, invulnT: 0,
    lo: { p: 0, m: 0, s: 0, t: 0 }, ammo: 0, reloadT: 0, fireCd: 0, burstLeft: 0, burstT: 0,
    meleeCd: 0, swingT: 9, reflectT: 0, skillCd: 0, tauntT: 0, tauntCd: 0,
    slowT: 0, chill: 0, chillT: 0, frozenT: 0, stunT: 0, burnT: 0, burnTick: 0, burnBy: -1, slipT: 0,
    shieldT: 0, giantT: 0, healT: 0, hurtT: 0,
    kills: 0, deaths: 0, streak: 0, best: 0, dmg: 0, score: 0, loots: 0, taunts: 0,
    lastHitBy: -1, lastHitT: -99, lastKiller: -1, multi: 0, multiT: -99, warp: 0,
    in: { mx: 0, my: 0, aim: 0, fire: false, fireN: 0, meleeN: 0, skillN: 0, tauntN: 0, reloadN: 0 },
    pn: { fireN: 0, meleeN: 0, skillN: 0, tauntN: 0, reloadN: 0 }, lastInputT: 0, killedBy: null, weaponKills: {},
  };
}

export class Game {
  constructor(o) {
    this.mode = o.mode || 'dm';
    this.map = getMap(o.mapId || 'factory');
    this.timeLimit = o.timeLimit ?? 300;
    this.killLimit = o.killLimit ?? 20;
    this.ff = !!o.ff;
    this.botDiff = o.botDiff ?? 1;
    this.players = [];
    this.byId = new Map();
    this.bullets = [];
    this.objs = [];
    this.ev = [];
    this.nextId = 1;
    this.nextBullet = 1;
    this.time = 0;          // 경기 경과 시간
    this.clock = 0;         // 전체 시뮬 시간
    this.state = 'count';   // count → play → end
    this.countT = 3.6;
    this.teamScore = [0, 0];
    this.totalKills = 0;
    this.event = null; this.eventT = 0; this.nextEventT = 50; this.eventTick = 0;
    this.nextDropT = 30; this.foodT = 0;
    this.endInfo = null;
  }

  addPlayer(o) {
    const id = o.id ?? this.nextId++;
    if (id >= this.nextId) this.nextId = id + 1;
    const p = makePlayer(id, o);
    if (this.mode === 'tdm' && p.team < 0) p.team = this.teamCount(0) <= this.teamCount(1) ? 0 : 1;
    if (this.mode !== 'tdm') p.team = -1;
    this.players.push(p); this.byId.set(id, p);
    if (p.bot) botInit(p, this.botDiff);
    this.rollLoadout(p);
    this.spawn(p);
    if (this.state === 'play' || this.state === 'count') this.ev.push(['join', id]);
    return p;
  }
  removePlayer(id) {
    const p = this.byId.get(id); if (!p) return;
    this.players.splice(this.players.indexOf(p), 1); this.byId.delete(id);
    this.objs = this.objs.filter((o) => o.owner !== id || o.k === 'smoke');
    this.ev.push(['leave', id, p.name]);
  }
  teamCount(t) { let n = 0; for (const p of this.players) if (p.team === t) n++; return n; }
  fillBots(total, diff) {
    const used = new Set(this.players.map((p) => p.name));
    const names = shuffle(BOT_NAMES.filter((n) => !used.has(n)));
    while (this.players.length < total) {
      this.addPlayer({ name: names.pop() || ('봇' + this.nextId), color: pick(SLIME_COLORS), face: (Math.random() * 6) | 0, hat: (Math.random() * 6) | 0, bot: true });
    }
  }

  rollLoadout(p) {
    p.lo = { p: rollItem(PRIMARY), m: rollItem(MELEE), s: rollItem(SKILL), t: rollItem(TAUNT) };
  }
  spawn(p) {
    const m = this.map;
    let pts = m.spawns;
    if (this.mode === 'tdm') { const half = pts.filter((s) => (p.team === 0 ? s.x < m.pw / 2 : s.x >= m.pw / 2)); if (half.length) pts = half; }
    let best = pts[0], bestD = -1;
    for (const s of shuffle(pts.slice())) {
      let md = 1e9;
      for (const q of this.players) if (q !== p && q.alive && (this.mode !== 'tdm' || q.team !== p.team)) md = Math.min(md, dist2(s.x, s.y, q.x, q.y));
      if (md > bestD) { bestD = md; best = s; }
    }
    p.x = best.x + rand(-3, 3); p.y = best.y + rand(-3, 3); p.vx = p.vy = 0;
    p.alive = true; p.hp = p.maxHp = MAX_HP; p.invulnT = 2; p.warp++;
    p.slowT = p.chill = p.frozenT = p.stunT = p.burnT = p.shieldT = p.giantT = p.healT = p.tauntT = p.slipT = 0;
    const w = PRIMARY[p.lo.p];
    p.ammo = w.mag; p.reloadT = 0; p.fireCd = 0.2; p.burstLeft = 0; p.meleeCd = 0; p.skillCd = 0; p.tauntCd = 0; p.swingT = 9;
    p.lastHitT = -99; p.killedBy = null;
    p.r = 6 * playerScale(p, this.event?.id);
    if (p.bot) botInit(p, this.botDiff, true);
  }

  // 원격 플레이어 입력 반영 (위치는 검증 후 신뢰)
  remoteInput(id, m) {
    const p = this.byId.get(id); if (!p) return;
    const inp = p.in;
    inp.mx = clamp(+m.mx || 0, -1, 1); inp.my = clamp(+m.my || 0, -1, 1);
    inp.aim = +m.a || 0; inp.fire = !!m.f;
    inp.fireN = m.fn | 0; inp.meleeN = m.mn | 0; inp.skillN = m.sn | 0; inp.tauntN = m.tn | 0; inp.reloadN = m.rn | 0;
    p.aim = inp.aim;
    if (m.w !== p.warp) return; // 순간이동 확인 전 위치는 무시
    if (!p.alive) return;
    const dt = Math.max(0.016, this.clock - p.lastInputT); p.lastInputT = this.clock;
    const maxD = 330 * Math.min(dt, 0.3) + 20;
    const nx = +m.x, ny = +m.y;
    if (!isFinite(nx) || !isFinite(ny)) return;
    if (dist2(nx, ny, p.x, p.y) > maxD * maxD || solidPx(this.map, nx, ny)) { p.warp++; return; }
    p.x = nx; p.y = ny; p.vx = +m.vx || 0; p.vy = +m.vy || 0;
  }

  impulse(p, ix, iy) {
    if (p.remote) this.ev.push(['imp', p.id, Math.round(ix), Math.round(iy)]);
    else { p.vx += ix; p.vy += iy; }
  }
  enemies(a, b) { return a !== b && (this.mode !== 'tdm' || a.team !== b.team || this.ff); }
  hostile(teamA, ownerA, b) { // 탄/오브젝트(소유자) 기준
    if (ownerA === b.id) return false;
    if (this.mode === 'tdm' && teamA === b.team) return this.ff;
    return true;
  }

  // ── 메인 업데이트 ──
  update(dt) {
    this.clock += dt;
    if (this.state === 'count') {
      this.countT -= dt;
      for (const p of this.players) { p.in.mx = p.in.my = 0; }
      if (this.countT <= 0) { this.state = 'play'; this.ev.push(['go']); }
    } else if (this.state === 'play') {
      this.time += dt;
      this.updateEvents(dt);
    }
    const ev = this.event?.id;
    const vort = this.objs.filter((o) => o.k === 'vortex');
    for (const p of this.players) {
      if (p.bot && this.state === 'play') botThink(this, p, dt);
      this.updatePlayer(p, dt, ev, vort);
    }
    this.updateBullets(dt);
    this.updateObjects(dt);
    if (this.state === 'play') this.checkEnd();
  }

  updatePlayer(p, dt, ev, vort) {
    // 타이머
    p.invulnT = Math.max(0, p.invulnT - dt); p.hurtT = Math.max(0, p.hurtT - dt);
    if (!p.alive) {
      if (this.state !== 'end') { p.respawnT -= dt; if (p.respawnT <= 0) this.spawn(p); }
      return;
    }
    p.slowT = Math.max(0, p.slowT - dt); p.stunT = Math.max(0, p.stunT - dt); p.slipT = Math.max(0, p.slipT - dt);
    p.frozenT = Math.max(0, p.frozenT - dt); p.shieldT = Math.max(0, p.shieldT - dt);
    if (p.chill > 0) { p.chillT -= dt; if (p.chillT <= 0) { p.chill = 0; } }
    if (p.giantT > 0) { p.giantT -= dt; if (p.giantT <= 0) { p.maxHp = MAX_HP; p.hp = Math.min(p.hp, MAX_HP); } }
    p.swingT += dt; p.reflectT = Math.max(0, p.reflectT - dt);
    p.meleeCd = Math.max(0, p.meleeCd - dt); p.skillCd = Math.max(0, p.skillCd - dt); p.tauntCd = Math.max(0, p.tauntCd - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    // 이동
    if (!p.remote) { if (this.state === 'count') { p.in.mx = p.in.my = 0; } stepMovement(p, this.map, dt, ev, vort); }
    else p.r = 6 * playerScale(p, ev);
    if (p.in.aim !== undefined && !p.bot) p.aim = p.in.aim;
    // 화상
    if (p.burnT > 0) {
      p.burnT -= dt; p.burnTick -= dt;
      if (p.burnTick <= 0) { p.burnTick = 0.33; this.damage(p, 3, this.byId.get(p.burnBy), { s: 'p', i: 9 }, 0, 0, 0, true); if (!p.alive) return; }
    }
    // 회복
    if (p.healT > 0) { p.healT -= dt; this.heal(p, 20 * dt, false); }
    if (this.clock - p.lastHitT > 5 && p.hp < p.maxHp) this.heal(p, 4 * dt, false);
    // 도발
    if (p.tauntT > 0) {
      p.tauntT -= dt;
      if (p.tauntT <= 0) { p.taunts++; this.heal(p, 10, true); }
    }
    // 재장전
    const w = PRIMARY[p.lo.p];
    if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.ammo = w.mag; } }
    if (this.state !== 'play') { this.syncPresses(p); return; }
    // 행동
    const inp = p.in, pn = p.pn;
    const busy = p.frozenT > 0 || p.stunT > 0;
    const firePressed = inp.fireN !== pn.fireN;
    if (inp.tauntN !== pn.tauntN && p.tauntCd <= 0 && !busy) { p.tauntT = 2.2; p.tauntCd = 3.5; this.ev.push(['emo', p.id, p.lo.t]); }
    if (p.tauntT > 0 && (firePressed || inp.meleeN !== pn.meleeN || inp.skillN !== pn.skillN)) p.tauntT = 0; // 공격하면 도발 취소
    if (!busy && p.tauntT <= 0) {
      // 점사 진행
      if (p.burstLeft > 0) { p.burstT -= dt; if (p.burstT <= 0 && p.ammo > 0 && p.reloadT <= 0) { this.fireOnce(p, w); p.burstLeft--; p.burstT = 0.07; } }
      else if ((w.auto ? inp.fire : firePressed || (inp.fire && p.bot)) && p.fireCd <= 0) {
        if (p.reloadT > 0) { /* 장전 중 */ }
        else if (p.ammo <= 0) this.startReload(p, w);
        else {
          p.fireCd = 1 / w.rate;
          if (w.burst) { p.burstLeft = w.burst - 1; p.burstT = 0.07; }
          this.fireOnce(p, w);
        }
      }
      if (inp.reloadN !== pn.reloadN && p.ammo < w.mag && p.reloadT <= 0) this.startReload(p, w);
      if (inp.meleeN !== pn.meleeN && p.meleeCd <= 0) this.melee(p);
      if (inp.skillN !== pn.skillN && p.skillCd <= 0) this.skill(p);
    }
    this.syncPresses(p);
    if (p.ammo <= 0 && p.reloadT <= 0 && p.burstLeft <= 0) this.startReload(p, w);
  }
  syncPresses(p) { const pn = p.pn, inp = p.in; pn.fireN = inp.fireN; pn.meleeN = inp.meleeN; pn.skillN = inp.skillN; pn.tauntN = inp.tauntN; pn.reloadN = inp.reloadN; }
  startReload(p, w) { if (p.reloadT > 0) return; p.reloadT = w.reload; p.burstLeft = 0; this.ev.push(['sfx', 'reload', p.x | 0, p.y | 0]); }

  dmgMul(p) { let m = 1; if (p.giantT > 0) m *= 1.3; if (this.event?.id === 'giant') m *= 1.15; return m; }

  fireOnce(p, w) {
    p.ammo--;
    const b = w.b, a0 = p.aim;
    const mx = p.x + Math.cos(a0) * (p.r + 4), my = p.y + Math.sin(a0) * (p.r + 4);
    // 총구가 벽 안이면 몸 중심에서 발사
    const ox = solidPx(this.map, mx, my) ? p.x : mx, oy = solidPx(this.map, mx, my) ? p.y : my;
    this.ev.push(['shot', p.id, p.lo.p]);
    if (b.hitscan) { this.hitscan(p, w, ox, oy, a0 + rand(-b.spread, b.spread)); return; }
    const n = b.count || 1, spdMul = this.event?.id === 'speedbullet' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = a0 + (n > 1 ? (i / (n - 1) - 0.5) * b.spread * 2 + rand(-0.04, 0.04) : rand(-b.spread, b.spread));
      const sp = b.spd * (n > 1 ? rand(0.85, 1.1) : 1) * spdMul;
      this.spawnBullet(p, b, ox, oy, Math.cos(a) * sp, Math.sin(a) * sp, b.life * (n > 1 ? rand(0.85, 1.15) : 1) / (spdMul > 1 ? 1.4 : 1), { s: 'p', i: p.lo.p });
    }
  }
  spawnBullet(p, b, x, y, vx, vy, life, label, team) {
    if (this.bullets.length > BULLET_LIST_MAX) return null;
    const blt = {
      id: this.nextBullet++, t: b.t, x, y, vx, vy, life, rad: b.rad, dmg: b.dmg, owner: p ? p.id : -1, team: p ? p.team : team ?? -1,
      bounce: b.bounce || 0, pierce: !!b.pierce, hits: null, label, src: b, mul: p ? this.dmgMul(p) : 1,
    };
    this.bullets.push(blt);
    this.ev.push(['b+', blt.id, blt.t, Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(vx), Math.round(vy), Math.round(life * 100) / 100, blt.owner, blt.bounce, blt.rad]);
    return blt;
  }
  removeBullet(i, fx) {
    const b = this.bullets[i];
    this.bullets[i] = this.bullets[this.bullets.length - 1]; this.bullets.pop();
    this.ev.push(['b-', b.id, Math.round(b.x), Math.round(b.y), fx]);
  }

  hitscan(p, w, x, y, a) {
    const b = w.b, mul = this.dmgMul(p);
    const ex = x + Math.cos(a) * b.range, ey = y + Math.sin(a) * b.range;
    const fr = raycast(this.map, x, y, ex, ey);
    const lx = x + (ex - x) * fr, ly = y + (ey - y) * fr;
    // 선분과 원 교차
    const hits = [];
    const targets = this.targetList(p);
    for (const t of targets) {
      const tr = t.r + 1;
      const dx = lx - x, dy = ly - y, L2 = dx * dx + dy * dy;
      let u = ((t.x - x) * dx + (t.y - y) * dy) / L2; u = clamp(u, 0, 1);
      const cx = x + dx * u, cy = y + dy * u;
      if (dist2(cx, cy, t.x, t.y) <= tr * tr) hits.push({ t, u });
    }
    hits.sort((m, n) => m.u - n.u);
    const label = { s: 'p', i: p.lo.p };
    if (b.t === 'bolt') {
      let endX = lx, endY = ly;
      if (hits.length) { endX = hits[0].t.x; endY = hits[0].t.y; }
      this.ev.push(['ray', 'bolt', x | 0, y | 0, endX | 0, endY | 0]);
      if (!hits.length) return;
      const chain = [hits[0].t]; let cur = hits[0].t;
      for (let k = 1; k < b.chain; k++) {
        let best = null, bd = b.chainR * b.chainR;
        for (const t of targets) {
          if (chain.includes(t)) continue;
          const d = dist2(cur.x, cur.y, t.x, t.y);
          if (d < bd && lineOfSight(this.map, cur.x, cur.y, t.x, t.y)) { bd = d; best = t; }
        }
        if (!best) break;
        this.ev.push(['ray', 'bolt', cur.x | 0, cur.y | 0, best.x | 0, best.y | 0]);
        chain.push(best); cur = best;
      }
      chain.forEach((t, k) => this.hitTarget(t, b.dmg * mul * (k === 0 ? 1 : 0.75), p, label, Math.cos(a), Math.sin(a), 60));
      return;
    }
    let endX = lx, endY = ly;
    if (!b.pierce && hits.length) { const u = hits[0].u; endX = x + (lx - x) * u; endY = y + (ly - y) * u; }
    this.ev.push(['ray', b.t, x | 0, y | 0, endX | 0, endY | 0]);
    for (const h of hits) {
      if (h.t.shieldT > 0 && Math.abs(angDiff(h.t.aim, a + Math.PI)) < 1.3) { this.ev.push(['sfx', 'block', h.t.x | 0, h.t.y | 0]); if (!b.pierce) break; continue; }
      this.hitTarget(h.t, b.dmg * mul, p, label, Math.cos(a), Math.sin(a), b.t === 'snipe' ? 160 : 90);
      if (!b.pierce) break;
    }
  }
  // 플레이어 + 분신 타겟 목록
  targetList(p) {
    const out = [];
    for (const q of this.players) if (q.alive && this.hostile(p.team, p.id, q)) out.push(q);
    for (const o of this.objs) if (o.k === 'decoy' && o.owner !== p.id && (this.mode !== 'tdm' || o.team !== p.team)) out.push(o);
    return out;
  }
  hitTarget(t, dmg, att, label, dx, dy, kb) {
    if (t.k === 'decoy') { this.popDecoy(t); return; }
    this.damage(t, dmg, att, label, dx, dy, kb);
  }

  damage(t, amt, att, label, dx, dy, kb, silent) {
    if (!t.alive || t.invulnT > 0 || this.state === 'end') return 0;
    if (att && att !== t && this.mode === 'tdm' && att.team === t.team && !this.ff) return 0;
    if (t.dummy) { t.lastHitT = this.clock; }
    amt = Math.max(1, Math.round(amt));
    t.hp -= amt; t.hurtT = 0.12;
    if (att && att !== t) { t.lastHitBy = att.id; att.dmg += amt; }
    t.lastHitT = this.clock;
    if (t.tauntT > 0) t.tauntT = 0;
    this.ev.push(['hit', t.id, amt, t.x | 0, (t.y - t.r) | 0, att ? att.id : -1, silent ? 1 : 0]);
    if (kb) this.impulse(t, dx * kb, dy * kb);
    if (t.hp <= 0) {
      if (t.dummy) { t.hp = t.maxHp; this.ev.push(['splat', t.x | 0, t.y | 0, t.color]); this.ev.push(['kill', att ? att.id : -1, t.id, label?.s || 'x', label?.i ?? 0]); return amt; }
      this.kill(t, att, label);
    }
    return amt;
  }
  heal(p, amt, show) {
    if (!p.alive || p.hp >= p.maxHp) return;
    const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + amt);
    if (show) this.ev.push(['heal', p.id, Math.round(p.hp - before)]);
  }

  kill(v, k, label) {
    v.alive = false; v.hp = 0; v.deaths++; v.respawnT = RESPAWN_TIME; v.tauntT = 0;
    v.killedBy = k && k !== v ? k.id : -1;
    const wasStreak = v.streak; v.streak = 0;
    this.ev.push(['splat', v.x | 0, v.y | 0, v.color]);
    // 사망 시 회복 젤리 드랍
    this.objs.push({ k: 'jelly', id: this.nextId++, x: v.x, y: v.y, life: 12 });
    const ann = [];
    if (k && k !== v) {
      k.kills++; k.streak++; k.best = Math.max(k.best, k.streak); k.score++;
      const key = (label?.s || 'x') + (label?.i ?? 0); k.weaponKills[key] = (k.weaponKills[key] || 0) + 1;
      if (this.mode === 'tdm') this.teamScore[k.team]++;
      this.heal(k, 25, true);
      k.multi = this.clock - k.multiT < 3.5 ? k.multi + 1 : 1; k.multiT = this.clock;
      if (this.totalKills === 0) ann.push(['첫 킬!', '#ff5d73']);
      if (k.lastKiller === v.id) { ann.push(['복수 성공!', '#ffc93c']); k.lastKiller = -1; }
      const mk = ['', '', '더블 킬!', '트리플 킬!', '쿼드라 킬!', '슬라임 학살!'];
      if (k.multi >= 2) ann.push([mk[Math.min(k.multi, 5)], '#ff8f1f', 1]);
      if (k.streak === 5) ann.push(['5연속 처치! 폭주 중!', '#c46bff']);
      if (k.streak === 10) ann.push(['10연속! 전설의 슬라임!', '#ffc93c']);
      if (wasStreak >= 5) ann.push([`${v.name}의 ${wasStreak}연속 처치를 끊었다!`, '#4fc3ff']);
    } else if (k === v || !k) {
      v.score = Math.max(0, v.score - 0);
    }
    v.lastKiller = k && k !== v ? k.id : -1;
    this.totalKills++;
    this.ev.push(['kill', k ? k.id : -1, v.id, label?.s || 'x', label?.i ?? 0, ann.length ? ann : 0]);
    this.rollLoadout(v);
  }

  // ── 근접 ──
  melee(p) {
    const w = MELEE[p.lo.m];
    p.meleeCd = w.cd; p.swingT = 0;
    if (w.reflect) p.reflectT = 0.22;
    this.ev.push(['sw', p.id, p.lo.m, Math.round(p.aim * 100) / 100]);
    if (w.lunge) this.impulse(p, Math.cos(p.aim) * w.lunge, Math.sin(p.aim) * w.lunge);
    const mul = this.dmgMul(p), reach = w.range * (p.giantT > 0 ? 1.3 : 1);
    let hitAny = false;
    for (const t of this.targetList(p)) {
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
      if (d > reach + t.r + 2) continue;
      if (d > 6 && Math.abs(angDiff(p.aim, Math.atan2(dy, dx))) > w.arc / 2) continue;
      if (!lineOfSight(this.map, p.x, p.y, t.x, t.y)) continue;
      hitAny = true;
      if (t.k === 'decoy') { this.popDecoy(t); continue; }
      const nx = d > 0 ? dx / d : Math.cos(p.aim), ny = d > 0 ? dy / d : Math.sin(p.aim);
      const dealt = this.damage(t, w.dmg * mul, p, { s: 'm', i: p.lo.m }, nx, ny, w.knock);
      if (w.stun && t.alive) t.stunT = w.stun;
      if (w.chill && t.alive) this.addChill(t, w.chill);
      if (w.leech && dealt) this.heal(p, dealt * w.leech, true);
      if (w.zap) {
        for (const o of this.targetList(p)) {
          if (o === t || o.k === 'decoy') continue;
          if (dist2(o.x, o.y, t.x, t.y) < 55 * 55) { this.ev.push(['ray', 'zap', t.x | 0, t.y | 0, o.x | 0, o.y | 0]); this.damage(o, w.zap * mul, p, { s: 'm', i: p.lo.m }, 0, 0, 0); }
        }
      }
    }
    if (hitAny) this.ev.push(['sfx', p.lo.m === 2 ? 'squeak' : 'melee', p.x | 0, p.y | 0]);
  }
  addChill(t, n) {
    t.chill += n; t.chillT = 2.2;
    if (t.chill >= 3) { t.chill = 0; t.frozenT = 1.1; this.ev.push(['sfx', 'ice', t.x | 0, t.y | 0]); }
  }

  // ── 스킬 ──
  skill(p) {
    const s = SKILL[p.lo.s];
    p.skillCd = this.mode === 'range' ? 1 : s.cd;
    const ax = Math.cos(p.aim), ay = Math.sin(p.aim);
    this.ev.push(['sk', p.id, p.lo.s]);
    switch (s.id) {
      case 'dash': {
        let dx = p.in.mx, dy = p.in.my; const l = Math.hypot(dx, dy);
        if (l < 0.2) { dx = ax; dy = ay; } else { dx /= l; dy /= l; }
        this.impulse(p, dx * 330, dy * 330); p.invulnT = Math.max(p.invulnT, 0.15);
        break;
      }
      case 'smoke': this.objs.push({ k: 'smoke', id: this.nextId++, x: p.x, y: p.y, r: 44, life: 7, owner: p.id }); break;
      case 'banana':
        for (let i = 0; i < 3; i++) {
          const a = p.aim + Math.PI + (i - 1) * 0.9;
          let bx = p.x + Math.cos(a) * 16, by = p.y + Math.sin(a) * 16;
          if (solidPx(this.map, bx, by)) { bx = p.x; by = p.y; }
          this.objs.push({ k: 'banana', id: this.nextId++, x: bx, y: by, life: 30, owner: p.id, team: p.team, arm: 0.6 });
        }
        break;
      case 'pudding': p.healT = 3; break;
      case 'shield': p.shieldT = 3; break;
      case 'blink': {
        const x0 = p.x, y0 = p.y; let d = 90;
        const fr = raycast(this.map, p.x, p.y, p.x + ax * d, p.y + ay * d); d = Math.max(0, d * fr - p.r - 2);
        let nx = p.x + ax * d, ny = p.y + ay * d;
        const probe = { x: nx, y: ny }; moveCircle(this.map, probe, 0, 0, p.r);
        p.x = probe.x; p.y = probe.y; p.warp++; p.invulnT = Math.max(p.invulnT, 0.1);
        this.ev.push(['tp', x0 | 0, y0 | 0, p.x | 0, p.y | 0]);
        break;
      }
      case 'turret': {
        let tx = p.x + ax * 12, ty = p.y + ay * 12; if (solidPx(this.map, tx, ty)) { tx = p.x; ty = p.y; }
        this.objs.push({ k: 'turret', id: this.nextId++, x: tx, y: ty, life: 8, owner: p.id, team: p.team, cd: 0.5, aim: p.aim });
        break;
      }
      case 'split':
        for (let i = 0; i < 2; i++) {
          const a = p.aim + (i ? 1 : -1) * 1.1;
          this.objs.push({ k: 'decoy', id: this.nextId++, x: p.x, y: p.y, vx: Math.cos(a) * 85, vy: Math.sin(a) * 85, life: 5, owner: p.id, team: p.team, r: p.r, aim: p.aim, turnT: rand(0.4, 1) });
        }
        break;
      case 'giant': p.giantT = 6; p.maxHp = MAX_HP + 60; p.hp = Math.min(p.maxHp, p.hp + 60); break;
      case 'strike': {
        const fr = raycast(this.map, p.x, p.y, p.x + ax * 150, p.y + ay * 150);
        const tx = p.x + ax * 150 * fr * 0.92, ty = p.y + ay * 150 * fr * 0.92;
        this.objs.push({ k: 'strike', id: this.nextId++, x: tx, y: ty, t: 1.2, owner: p.id, team: p.team, phase: 0 });
        this.ev.push(['pig', tx | 0, ty | 0]);
        break;
      }
    }
  }

  popDecoy(o) {
    o.life = 0;
    this.ev.push(['splat', o.x | 0, o.y | 0, this.byId.get(o.owner)?.color || '#fff']);
    this.explode(o.x, o.y, 26, 16, this.byId.get(o.owner), { s: 's', i: 7 }, o.team, true);
  }

  explode(x, y, r, dmg, owner, label, team, small) {
    this.ev.push(['boom', x | 0, y | 0, r, small ? 1 : 0]);
    const oid = owner ? owner.id : -1, oteam = owner ? owner.team : team;
    for (const t of this.players) {
      if (!t.alive || !this.hostile(oteam, oid, t)) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d > r + t.r) continue;
      if (raycast(this.map, x, y, t.x, t.y) < 0.98 && d > 10) continue;
      const f = 1 - clamp((d - t.r) / r, 0, 1) * 0.55;
      const nx = d > 0.1 ? (t.x - x) / d : 0, ny = d > 0.1 ? (t.y - y) / d : -1;
      this.damage(t, dmg * f * (owner ? this.dmgMul(owner) : 1), owner, label, nx, ny, 220 * f);
    }
    for (const o of this.objs) if (o.k === 'decoy' && o.life > 0 && o.owner !== oid && Math.hypot(o.x - x, o.y - y) < r) { o.life = 0; this.ev.push(['splat', o.x | 0, o.y | 0, '#ffffff']); }
  }

  // ── 탄 ──
  updateBullets(dt) {
    const bl = this.bullets;
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i];
      b.life -= dt;
      const prevBounce = b.bounce;
      const wall = stepBullet(b, this.map, dt);
      if (b.t === 'duck' && b.bounce !== prevBounce) this.ev.push(['sfx', 'quack', b.x | 0, b.y | 0]);
      if (wall || b.life <= 0) {
        if (b.src.boom && !b.src.hole) { this.explode(b.x, b.y, b.src.boomR, b.src.boom, this.byId.get(b.owner), b.label, b.team); }
        if (b.src.hole) this.objs.push({ k: 'vortex', id: this.nextId++, x: b.x - b.vx * dt * 2, y: b.y - b.vy * dt * 2, life: 1.6, owner: b.owner, team: b.team, label: b.label, boom: b.src.boom, boomR: b.src.boomR, tick: 0 });
        if (b.src.split && b.life <= 0) {
          const owner = this.byId.get(b.owner); const sp = Math.hypot(b.vx, b.vy), a0 = Math.atan2(b.vy, b.vx);
          for (let k = 0; k < b.src.split; k++) {
            const a = a0 + (k - 1) * 0.45;
            this.spawnBullet(owner, { t: 'pop', dmg: b.dmg, rad: 2, bounce: 0 }, b.x, b.y, Math.cos(a) * sp * 1.15, Math.sin(a) * sp * 1.15, 0.32, b.label, b.team);
          }
          this.ev.push(['sfx', 'popcorn', b.x | 0, b.y | 0]);
        }
        this.removeBullet(i, wall ? 2 : 0);
        continue;
      }
      // 반사 (프라이팬)
      let reflected = false;
      for (const p of this.players) {
        if (p.reflectT <= 0 || !p.alive || !this.hostile(b.team, b.owner, p)) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < 26 && Math.abs(angDiff(p.aim, Math.atan2(b.y - p.y, b.x - p.x))) < 1.2) {
          const sp = Math.hypot(b.vx, b.vy) * 1.2;
          const nb = this.spawnBullet(p, b.src, b.x, b.y, Math.cos(p.aim) * sp, Math.sin(p.aim) * sp, Math.max(0.4, b.life + 0.3), { s: 'm', i: 3 });
          if (nb) { nb.dmg = b.dmg * 1.2; nb.mul = 1; }
          this.ev.push(['sfx', 'clang', b.x | 0, b.y | 0]);
          this.removeBullet(i, 1); reflected = true; break;
        }
      }
      if (reflected) continue;
      // 플레이어 충돌
      let removed = false;
      const owner = this.byId.get(b.owner);
      for (const t of this.players) {
        if (!t.alive || !this.hostile(b.team, b.owner, t)) continue;
        const rr = t.r + b.rad;
        if (dist2(b.x, b.y, t.x, t.y) > rr * rr) continue;
        if (b.pierce) { if (!b.hits) b.hits = []; if (b.hits.includes(t.id)) continue; b.hits.push(t.id); }
        // 방패
        if (t.shieldT > 0 && Math.abs(angDiff(t.aim, Math.atan2(b.y - t.y, b.x - t.x))) < 1.3) {
          this.ev.push(['sfx', 'block', t.x | 0, t.y | 0]);
          if (!b.pierce) { this.removeBullet(i, 1); removed = true; break; }
          continue;
        }
        if (b.src.boom && !b.src.hole) { this.explode(b.x, b.y, b.src.boomR, b.src.boom, owner, b.label, b.team); this.removeBullet(i, 0); removed = true; break; }
        if (b.src.hole) { this.objs.push({ k: 'vortex', id: this.nextId++, x: b.x, y: b.y, life: 1.6, owner: b.owner, team: b.team, label: b.label, boom: b.src.boom, boomR: b.src.boomR, tick: 0 }); this.removeBullet(i, 0); removed = true; break; }
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const dealt = this.damage(t, b.dmg * b.mul, owner, b.label, b.vx / sp, b.vy / sp, b.t === 'pellet' ? 28 : b.t === 'flame' ? 4 : 45);
        if (t.alive) {
          if (b.src.slow) t.slowT = 1.2;
          if (b.src.chill) this.addChill(t, b.src.chill);
          if (b.src.burn) { t.burnT = 2.4; t.burnBy = b.owner; }
        }
        if (b.t === 'bubble') this.ev.push(['sfx', 'pop', b.x | 0, b.y | 0]);
        if (!b.pierce) { this.removeBullet(i, dealt ? 1 : 0); removed = true; break; }
      }
      if (removed) continue;
      // 분신 충돌
      for (const o of this.objs) {
        if (o.k !== 'decoy' || o.life <= 0 || o.owner === b.owner || (this.mode === 'tdm' && o.team === b.team)) continue;
        if (dist2(b.x, b.y, o.x, o.y) < (o.r + b.rad) ** 2) { this.popDecoy(o); if (!b.pierce) { this.removeBullet(i, 1); removed = true; } break; }
      }
    }
  }

  // ── 오브젝트 ──
  updateObjects(dt) {
    const objs = this.objs;
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (o.life !== undefined) o.life -= dt;
      switch (o.k) {
        case 'turret': {
          o.cd -= dt;
          const owner = this.byId.get(o.owner);
          let best = null, bd = 170 * 170;
          for (const t of this.players) {
            if (!t.alive || !this.hostile(o.team, o.owner, t)) continue;
            const d = dist2(o.x, o.y, t.x, t.y);
            if (d < bd && !this.inSmoke(t) && lineOfSight(this.map, o.x, o.y, t.x, t.y)) { bd = d; best = t; }
          }
          if (best) {
            const want = Math.atan2(best.y - o.y, best.x - o.x);
            o.aim += angDiff(o.aim, want) * Math.min(1, 12 * dt);
            if (o.cd <= 0 && Math.abs(angDiff(o.aim, want)) < 0.2 && owner && this.state === 'play') {
              o.cd = 0.32;
              this.spawnBullet(owner, { t: 'pea', dmg: 7, rad: 2 }, o.x + Math.cos(o.aim) * 7, o.y + Math.sin(o.aim) * 7, Math.cos(o.aim) * 300, Math.sin(o.aim) * 300, 0.6, { s: 's', i: 6 });
              this.ev.push(['sfx', 'smg', o.x | 0, o.y | 0]);
            }
          }
          break;
        }
        case 'decoy': {
          if (o.life <= 0) break;
          o.turnT -= dt;
          if (o.turnT <= 0) { o.turnT = rand(0.5, 1.2); const a = Math.atan2(o.vy, o.vx) + rand(-1.2, 1.2); o.vx = Math.cos(a) * 85; o.vy = Math.sin(a) * 85; o.aim = a; }
          const bx = o.x, by = o.y;
          moveCircle(this.map, o, o.vx * dt, o.vy * dt, o.r);
          if (Math.abs(o.x - bx) < 0.3 * 85 * dt && Math.abs(o.y - by) < 0.3 * 85 * dt) o.turnT = 0;
          if (o.life <= 0.05) { this.popDecoy(o); }
          break;
        }
        case 'banana': {
          o.arm -= dt; if (o.arm > 0) break;
          for (const t of this.players) {
            if (!t.alive || !this.hostile(o.team, o.owner, t)) continue;
            if (dist2(o.x, o.y, t.x, t.y) < (t.r + 5) ** 2) {
              o.life = 0;
              const sp = Math.hypot(t.vx, t.vy); const a = sp > 5 ? Math.atan2(t.vy, t.vx) : rand(0, TAU);
              t.slipT = 1.0; t.stunT = 0.5;
              this.impulse(t, Math.cos(a) * 260, Math.sin(a) * 260);
              this.damage(t, 18, this.byId.get(o.owner), { s: 's', i: 2 }, 0, 0, 0);
              this.ev.push(['sfx', 'slip', o.x | 0, o.y | 0]);
              break;
            }
          }
          break;
        }
        case 'vortex': {
          if (o.life <= 0) this.explode(o.x, o.y, o.boomR, o.boom, this.byId.get(o.owner), o.label, o.team);
          else {
            o.tick -= dt;
            if (o.tick <= 0) { o.tick = 0.25; for (const t of this.players) if (t.alive && this.hostile(o.team, o.owner, t) && dist2(t.x, t.y, o.x, o.y) < 30 * 30) this.damage(t, 4, this.byId.get(o.owner), o.label, 0, 0, 0, true); }
            // 탄도 빨아들임 (오프라인 시각효과용이 아니라 실제 이동은 결정적이어야 하므로 탄은 제외)
          }
          break;
        }
        case 'strike': {
          o.t -= dt;
          if (o.t <= 0) {
            const offs = [[0, 0], [-22, -10], [20, 12], [-6, 22], [10, -22]];
            const k = o.phase;
            if (k < offs.length) {
              this.explode(o.x + offs[k][0], o.y + offs[k][1], k === 0 ? 40 : 28, k === 0 ? 60 : 32, this.byId.get(o.owner), { s: 's', i: 9 }, o.team);
              o.phase++; o.t = 0.12;
            } else o.life = 0;
          }
          if (o.life === undefined) o.life = 5;
          break;
        }
        case 'food': case 'jelly': {
          for (const t of this.players) {
            if (!t.alive || t.hp >= t.maxHp) continue;
            if (dist2(o.x, o.y, t.x, t.y) < (t.r + 6) ** 2) {
              this.heal(t, o.k === 'jelly' ? 20 : o.ft === 0 ? 45 : 30, true); o.life = 0; o.taken = true;
              this.ev.push(['sfx', 'heal', o.x | 0, o.y | 0]);
              break;
            }
          }
          break;
        }
        case 'drop': {
          o.t -= dt;
          if (o.t <= 0) { o.k = 'crate'; o.life = 40; this.ev.push(['sfx', 'land', o.x | 0, o.y | 0]); this.ev.push(['boom', o.x | 0, o.y | 0, 18, 2]); }
          break;
        }
        case 'crate': {
          for (const t of this.players) {
            if (!t.alive) continue;
            if (dist2(o.x, o.y, t.x, t.y) < (t.r + 8) ** 2) {
              o.life = 0; this.giveLoot(t); break;
            }
          }
          break;
        }
      }
      if (o.life !== undefined && o.life <= 0) {
        if (o.k === 'decoy' && !o.popped) { o.popped = true; }
        objs[i] = objs[objs.length - 1]; objs.pop();
      }
    }
  }
  smokeAt(x, y) { for (const o of this.objs) if (o.k === 'smoke' && dist2(o.x, o.y, x, y) < o.r * o.r) return o; return null; }
  inSmoke(t) { for (const o of this.objs) if (o.k === 'smoke' && dist2(o.x, o.y, t.x, t.y) < o.r * o.r) return true; return false; }

  giveLoot(p) {
    const r = Math.random();
    const slot = r < 0.6 ? 'p' : r < 0.8 ? 'm' : 's';
    const list = slot === 'p' ? PRIMARY : slot === 'm' ? MELEE : SKILL;
    const idx = rollItem(list, 3);
    p.lo[slot] = idx; p.loots++;
    if (slot === 'p') { p.ammo = PRIMARY[idx].mag; p.reloadT = 0; p.burstLeft = 0; }
    if (slot === 's') p.skillCd = 0;
    this.ev.push(['loot', p.id, slot, idx]);
  }

  // ── 맵 이벤트, 보급, 음식 ──
  updateEvents(dt) {
    // 음식 리스폰
    this.foodT -= dt;
    if (this.foodT <= 0) {
      this.foodT = 18;
      for (const h of this.map.heals) {
        if (!this.objs.some((o) => o.k === 'food' && o.hx === h.x && o.hy === h.y)) this.objs.push({ k: 'food', id: this.nextId++, x: h.x, y: h.y, hx: h.x, hy: h.y, ft: (Math.random() * 2) | 0, life: 999 });
      }
    }
    // 랜덤 이벤트
    if (this.mode !== 'range') {
      if (this.event) {
        this.eventT -= dt;
        if (this.event.id === 'heal') {
          this.eventTick -= dt;
          if (this.eventTick <= 0) {
            this.eventTick = 0.7;
            const f = this.map.floors[(Math.random() * this.map.floors.length) | 0];
            this.objs.push({ k: 'jelly', id: this.nextId++, x: (f % this.map.w + 0.5) * TILE, y: (((f / this.map.w) | 0) + 0.5) * TILE, life: 8 });
          }
        }
        if (this.eventT <= 0) { this.ev.push(['ev', EVENTS.indexOf(this.event), 0]); this.event = null; this.nextEventT = this.time + 50; }
      } else if (this.time >= this.nextEventT) {
        this.event = pick(EVENTS); this.eventT = 20; this.eventTick = 0;
        this.ev.push(['ev', EVENTS.indexOf(this.event), 1]);
      }
      // 보급품
      if (this.time >= this.nextDropT) {
        this.nextDropT = this.time + 55;
        const m = this.map;
        let f, tries = 0;
        do { f = m.floors[(Math.random() * m.floors.length) | 0]; tries++; }
        while (tries < 40 && (tileAtPx(m, (f % m.w + 0.5) * TILE, (((f / m.w) | 0) + 0.5) * TILE) !== 0));
        const x = (f % m.w + 0.5) * TILE, y = (((f / m.w) | 0) + 0.5) * TILE;
        this.objs.push({ k: 'drop', id: this.nextId++, x, y, t: 3.5, life: 99 });
        this.ev.push(['drop', x | 0, y | 0]);
      }
    }
  }

  checkEnd() {
    if (this.mode === 'range') return;
    let done = this.timeLimit > 0 && this.time >= this.timeLimit;
    if (this.killLimit > 0) {
      if (this.mode === 'tdm') { if (this.teamScore[0] >= this.killLimit || this.teamScore[1] >= this.killLimit) done = true; }
      else if (this.players.some((p) => p.kills >= this.killLimit)) done = true;
    }
    if (!done) return;
    this.state = 'end';
    for (const p of this.players) { p.tauntT = 0; }
    this.endInfo = this.results();
    this.ev.push(['end', this.endInfo]);
  }

  results() {
    const ranked = this.players.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || b.dmg - a.dmg);
    const titles = [];
    const pickMax = (fn, title, fmt) => {
      let best = null, bv = 0; for (const p of this.players) { const v = fn(p); if (v > bv) { bv = v; best = p; } }
      if (best) titles.push({ id: best.id, title, val: fmt(bv) });
    };
    pickMax((p) => p.best, '연속 처치왕', (v) => `${v}연속`);
    pickMax((p) => p.dmg, '딜량 괴물', (v) => `${Math.round(v)} 피해`);
    pickMax((p) => p.deaths, '불사조(?)', (v) => `${v}번 부활`);
    pickMax((p) => p.taunts, '도발 장인', (v) => `${v}번 춤`);
    pickMax((p) => p.loots, '보급 사냥꾼', (v) => `${v}개 획득`);
    // 가장 많이 처치한 무기
    const wk = {};
    for (const p of this.players) for (const k in p.weaponKills) wk[k] = (wk[k] || 0) + p.weaponKills[k];
    let topW = null, tv = 0; for (const k in wk) if (wk[k] > tv) { tv = wk[k]; topW = k; }
    let winTeam = -1;
    if (this.mode === 'tdm') winTeam = this.teamScore[0] === this.teamScore[1] ? -1 : this.teamScore[0] > this.teamScore[1] ? 0 : 1;
    return {
      mode: this.mode, winTeam, teamScore: this.teamScore.slice(),
      rank: ranked.map((p) => ({ id: p.id, name: p.name, color: p.color, face: p.face, hat: p.hat, team: p.team, kills: p.kills, deaths: p.deaths, dmg: Math.round(p.dmg), best: p.best, bot: p.bot })),
      mvp: ranked[0] ? ranked[0].id : -1, titles, topWeapon: topW ? { key: topW, n: tv } : null,
    };
  }

  // ── 네트워크 직렬화 ──
  snapshot() {
    const ps = this.players.map((p) => {
      let f = 0;
      if (p.alive) f |= 1; if (p.invulnT > 0) f |= 2; if (p.shieldT > 0) f |= 4; if (p.burnT > 0) f |= 8;
      if (p.frozenT > 0) f |= 16; if (p.tauntT > 0) f |= 32; if (p.reloadT > 0) f |= 64; if (p.healT > 0) f |= 128;
      if (p.hurtT > 0) f |= 256; if (p.stunT > 0) f |= 512; if (p.slowT > 0) f |= 1024; if (p.giantT > 0) f |= 2048; if (p.slipT > 0) f |= 4096;
      const w = PRIMARY[p.lo.p];
      return [p.id, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.aim * 100) / 100, Math.ceil(p.hp), p.maxHp, f, p.warp,
        p.lo.p, p.lo.m, p.lo.s, p.lo.t, p.ammo, p.reloadT > 0 ? Math.round((1 - p.reloadT / w.reload) * 100) : 100,
        Math.round(p.skillCd * 10) / 10, Math.round(p.meleeCd * 100) / 100, Math.round(Math.max(0, p.respawnT) * 10) / 10, p.chill,
        Math.round(p.slowT * 10) / 10, Math.round(p.frozenT * 10) / 10, Math.round(p.stunT * 10) / 10, Math.round(p.tauntT * 10) / 10,
        Math.round(p.giantT * 10) / 10, Math.round(p.slipT * 10) / 10, p.killedBy ?? -1, Math.round(p.tauntCd * 10) / 10];
    });
    const os = [];
    for (const o of this.objs) {
      switch (o.k) {
        case 'smoke': os.push([1, o.id, o.x | 0, o.y | 0, o.r, Math.round(o.life * 10) / 10, o.owner]); break;
        case 'banana': os.push([2, o.id, o.x | 0, o.y | 0, o.team, 0, o.owner]); break;
        case 'turret': os.push([3, o.id, o.x | 0, o.y | 0, Math.round(o.aim * 100) / 100, Math.round(o.life * 10) / 10, o.owner]); break;
        case 'decoy': os.push([4, o.id, Math.round(o.x), Math.round(o.y), Math.round(o.aim * 100) / 100, o.r, o.owner]); break;
        case 'vortex': os.push([5, o.id, o.x | 0, o.y | 0, Math.round(o.life * 10) / 10, 0, o.owner]); break;
        case 'strike': os.push([6, o.id, o.x | 0, o.y | 0, Math.round(o.t * 10) / 10, o.phase, o.owner]); break;
        case 'food': os.push([7, o.id, o.x | 0, o.y | 0, o.ft, 0, -1]); break;
        case 'jelly': os.push([8, o.id, o.x | 0, o.y | 0, Math.round(o.life), 0, -1]); break;
        case 'drop': os.push([9, o.id, o.x | 0, o.y | 0, Math.round(o.t * 10) / 10, 0, -1]); break;
        case 'crate': os.push([10, o.id, o.x | 0, o.y | 0, 0, 0, -1]); break;
      }
    }
    return { st: this.state, tm: Math.round(this.time * 10) / 10, ct: Math.round(this.countT * 10) / 10, ev: this.event ? EVENTS.indexOf(this.event) : -1, et: Math.round(this.eventT), ts: this.teamScore, p: ps, o: os };
  }
  scores() { return this.players.map((p) => [p.id, p.kills, p.deaths, p.streak, Math.round(p.dmg)]); }
  roster() { return this.players.map((p) => [p.id, p.name, p.color, p.face, p.hat, p.team, p.bot ? 1 : 0, p.dummy ? 1 : 0]); }
  flushEvents() { const e = this.ev; this.ev = []; return e; }
}
