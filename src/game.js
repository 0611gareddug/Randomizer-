// 세션(오프라인/방장/참가자), 클라이언트 월드, 이벤트 연출
import { Game, TICK, stepMovement, stepBullet, playerScale, RESPAWN_TIME } from './sim.js';
import { getMap, MAP_LIST, bushAt } from './maps.js';
import { PRIMARY, MELEE, SKILL, TAUNT, SUPER, EVENTS, SLOTS, RARITY } from './data.js';
import { sfx } from './audio.js';
import { Host, Client, MAX_PLAYERS } from './net.js';
import { dist2, rand, filterChat, clamp } from './util.js';

const INTERP = 0.1;
const SHOT_SFX = { pea: 'pea', smg: 'smg', shotgun: 'shotgun', baguette: 'bread', revolver: 'rev', duck: 'duckshot', bubble: 'bubble', sniper: 'snipe', icecream: 'ice', dryer: 'flame', frisbee: 'disc', laser: 'laser', popcorn: 'kernel', blackhole: 'can', ukulele: 'bolt' };
const SKILL_SFX = { dash: 'dash', smoke: 'smoke', banana: 'deploy', pudding: 'heal', shield: 'block', blink: 'teleport', turret: 'deploy', split: 'headpop', giant: 'grow', strike: 'pigeon' };

export function smokeAt(objs, x, y) { for (const o of objs) if (o.k === 'smoke' && dist2(o.x, o.y, x, y) < o.r * o.r) return o; return null; }

// ── 참가자용 월드 ──
const OBJ_K = { 1: 'smoke', 2: 'banana', 3: 'turret', 4: 'decoy', 5: 'vortex', 6: 'strike', 7: 'food', 8: 'jelly', 9: 'drop', 10: 'crate', 11: 'lob', 12: 'turret', 13: 'strike' };
export class ClientWorld {
  constructor(map, settings, myId) {
    this.map = map; this.mode = settings.mode; this.settings = settings; this.myId = myId;
    this.players = []; this.byId = new Map(); this.objs = []; this.bullets = []; this.bulletById = new Map();
    this.snaps = []; this.state = 'count'; this.time = 0; this.countT = 3; this.event = null; this.eventT = 0; this.teamScore = [0, 0];
    this.me = null; this.lastSnapAt = 0; this.tmAt = 0;
  }
  smokeAt(x, y) { return smokeAt(this.objs, x, y); }
  hiddenFrom(t, viewer) {
    if (!t.alive || t.revealT > 0) return false;
    if (viewer && this.mode === 'tdm' && viewer.team === t.team) return false;
    if (!bushAt(this.map, t.x, t.y)) return false;
    return !viewer || dist2(t.x, t.y, viewer.x, viewer.y) > 44 * 44;
  }
  applyRoster(r) {
    const seen = new Set();
    for (const [id, name, color, face, hat, team, bot, dummy] of r) {
      seen.add(id);
      let p = this.byId.get(id);
      if (!p) {
        p = { id, x: 0, y: 0, vx: 0, vy: 0, aim: 0, r: 6, hp: 100, maxHp: 100, alive: false, lo: { p: 0, m: 0, s: 0, t: 0, u: 0 }, superCh: 0, revealT: 0, spinT: 0, leapT: 0, kills: 0, deaths: 0, streak: 0, dmg: 0, swingT: 9, warp: -1, warpSeen: -1,
          in: { mx: 0, my: 0 }, invulnT: 0, shieldT: 0, burnT: 0, frozenT: 0, tauntT: 0, reloadT: 0, healT: 0, hurtT: 0, stunT: 0, slowT: 0, giantT: 0, slipT: 0, chill: 0, skillCd: 0, meleeCd: 0, respawnT: 0, ammo: 0, reloadPct: 100, killedBy: -1, tauntCd: 0 };
        this.players.push(p); this.byId.set(id, p);
        if (id === this.myId) this.me = p;
      }
      Object.assign(p, { name, color, face, hat, team, bot: !!bot, dummy: !!dummy });
    }
    for (let i = this.players.length - 1; i >= 0; i--) if (!seen.has(this.players[i].id)) { this.byId.delete(this.players[i].id); this.players.splice(i, 1); }
  }
  applyScores(sc) { for (const [id, k, d, st, dmg] of sc) { const p = this.byId.get(id); if (p) { p.kills = k; p.deaths = d; p.streak = st; p.dmg = dmg; } } }
  pushSnap(s, now) {
    const pm = new Map(); for (const a of s.p) pm.set(a[0], a);
    this.snaps.push({ t: now, pm, s });
    if (this.snaps.length > 12) this.snaps.shift();
    this.lastSnapAt = now;
    this.state = s.st; this.time = s.tm; this.tmAt = now; this.countT = s.ct; this.teamScore = s.ts;
    this.event = s.ev >= 0 ? EVENTS[s.ev] : null; this.eventT = s.et;
    // 즉시 반영 상태
    for (const a of s.p) {
      const p = this.byId.get(a[0]); if (!p) continue;
      const f = a[6];
      const wasAlive = p.alive;
      p.alive = !!(f & 1); p.invulnT = f & 2 ? 1 : 0; p.shieldT = f & 4 ? 1 : 0; p.burnT = f & 8 ? 1 : 0;
      p.hurtT = f & 256 ? 0.1 : p.hurtT; p.healT = f & 128 ? 1 : 0; p.reloadT = f & 64 ? 1 : 0; p.chargeT = f & 8192 ? 1 : 0;
      p.hp = a[4]; p.maxHp = a[5]; p.warp = a[7];
      p.lo.p = a[8]; p.lo.m = a[9]; p.lo.s = a[10]; p.lo.t = a[11]; p.ammo = a[12]; p.reloadPct = a[13];
      p.skillCd = a[14]; p.meleeCd = a[15]; p.respawnT = a[16]; p.chill = a[17];
      p.slowT = a[18]; p.frozenT = a[19]; p.stunT = a[20]; p.tauntT = a[21]; p.giantT = a[22]; p.slipT = a[23]; p.killedBy = a[24]; p.tauntCd = a[25]; p.lo.u = a[26] | 0; p.superCh = (a[27] | 0) / 100;
      p.revealT = f & 16384 ? 1 : 0; p.spinT = f & 32768 ? 1 : 0; p.leapT = f & 65536 ? 1 : 0;
      p.r = 6 * playerScale(p, this.event?.id);
      if (p === this.me) {
        if (p.warp !== p.warpSeen || (!wasAlive && p.alive)) { p.x = a[1]; p.y = a[2]; p.vx = p.vy = 0; p.warpSeen = p.warp; }
      } else if (!wasAlive && p.alive) { p.x = a[1]; p.y = a[2]; }
    }
    // 오브젝트
    const prev = new Map(); for (const o of this.objs) prev.set(o.id, o);
    this.objs = s.o.map((a) => {
      const k = OBJ_K[a[0]], o = prev.get(a[1]) || { id: a[1], k };
      o.k = k; o.tx = a[2]; o.ty = a[3];
      if (o.x === undefined || (k !== 'decoy' && k !== 'lob')) { o.x = a[2]; o.y = a[3]; }
      switch (k) {
        case 'smoke': o.r = a[4]; o.life = a[5]; o.owner = a[6]; break;
        case 'banana': o.team = a[4]; o.owner = a[6]; break;
        case 'turret': o.aim = a[4]; o.life = a[5]; o.owner = a[6]; o.big = a[0] === 12; o.team = this.byId.get(a[6])?.team ?? -1; break;
        case 'lob': o.h = a[4]; o.owner = a[6]; break;
        case 'decoy': o.aim = a[4]; o.r = a[5]; o.owner = a[6]; o.team = this.byId.get(a[6])?.team ?? -1; break;
        case 'vortex': o.life = a[4]; o.owner = a[6]; break;
        case 'strike': o.t = a[4]; o.phase = a[5]; o.meteor = a[0] === 13; break;
        case 'food': o.ft = a[4]; break;
        case 'drop': o.t = a[4]; break;
      }
      return o;
    });
  }
  // 보간 + 로컬 예측
  update(dt, now) {
    const rt = now - INTERP;
    const sn = this.snaps;
    let s0 = null, s1 = null;
    for (let i = sn.length - 1; i >= 0; i--) { if (sn[i].t <= rt) { s0 = sn[i]; s1 = sn[i + 1] || null; break; } }
    if (!s0 && sn.length) s0 = sn[0];
    const k = s0 && s1 ? clamp((rt - s0.t) / (s1.t - s0.t), 0, 1) : 0;
    for (const p of this.players) {
      if (p === this.me) continue;
      const a = s0 && s0.pm.get(p.id); if (!a) continue;
      const b = s1 && s1.pm.get(p.id);
      let x = a[1], y = a[2], aim = a[3];
      if (b && b[7] === a[7]) { x += (b[1] - x) * k; y += (b[2] - y) * k; let d = b[3] - aim; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; aim += d * k; }
      else if (b && k > 0.5) { x = b[1]; y = b[2]; aim = b[3]; }
      p.vx = (x - p.x) / Math.max(dt, 0.001); p.vy = (y - p.y) / Math.max(dt, 0.001);
      p.x = x; p.y = y; p.aim = aim;
    }
    for (const o of this.objs) if (o.k === 'decoy' || o.k === 'lob') { o.x += (o.tx - o.x) * Math.min(1, dt * 12); o.y += (o.ty - o.y) * Math.min(1, dt * 12); }
    // 로컬 타이머
    for (const p of this.players) {
      p.swingT += dt; p.hurtT = Math.max(0, p.hurtT - dt);
      if (p.skillCd > 0) p.skillCd = Math.max(0, p.skillCd - dt);
      if (p.tauntCd > 0) p.tauntCd = Math.max(0, p.tauntCd - dt);
      if (!p.alive && p.respawnT > 0) p.respawnT = Math.max(0, p.respawnT - dt);
    }
    // 탄
    const bl = this.bullets;
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i]; b.life -= dt;
      const wall = stepBullet(b, this.map, dt);
      if (wall || b.life <= -0.15) { bl[i] = bl[bl.length - 1]; bl.pop(); this.bulletById.delete(b.id); }
    }
  }
  stepMe(dt, ev) {
    const me = this.me; if (!me || !me.alive) return;
    const vort = this.objs.filter((o) => o.k === 'vortex');
    stepMovement(me, this.map, dt, ev, vort);
  }
  addBullet(a) {
    const b = { id: a[1], t: a[2], x: a[3], y: a[4], vx: a[5], vy: a[6], life: a[7], owner: a[8], bounce: a[9], rad: a[10] };
    this.bullets.push(b); this.bulletById.set(b.id, b);
  }
  removeBullet(id) {
    const b = this.bulletById.get(id); if (!b) return;
    this.bulletById.delete(id); const i = this.bullets.indexOf(b); if (i >= 0) { this.bullets[i] = this.bullets[this.bullets.length - 1]; this.bullets.pop(); }
  }
}

// ── 이벤트 연출 ──
export class Presenter {
  constructor(R, hooks) { this.R = R; this.hooks = hooks; this.W = null; this.myId = -1; this.isClient = false; this.lastShot = new Map(); }
  setWorld(W, myId, isClient) { this.W = W; this.myId = myId; this.isClient = isClient; this.lastShot.clear(); }
  pos(x, y) {
    const me = this.W.byId.get(this.myId);
    const lx = me ? me.x : this.R.camX + this.R.vw / 2, ly = me ? me.y : this.R.camY + this.R.vh / 2;
    const d = Math.hypot(x - lx, y - ly);
    return [clamp(1 - d / 420, 0, 1), clamp((x - lx) / 260, -0.8, 0.8)];
  }
  s(name, x, y, vol = 1) { const [v, p] = this.pos(x, y); sfx(name, v * vol, p); }
  handle(evs) {
    const R = this.R, W = this.W, me = this.myId;
    for (const e of evs) {
      switch (e[0]) {
        case 'b+': if (this.isClient) W.addBullet(e); break;
        case 'b-': {
          if (this.isClient) W.removeBullet(e[1]);
          if (e[4] === 2) R.burst(e[2], e[3], '#c9c2b0', 3, 40, 0.25);
          else if (e[4] === 1) R.burst(e[2], e[3], '#fff6c9', 4, 60, 0.2);
          break;
        }
        case 'shot': {
          const p = W.byId.get(e[1]); if (!p) break;
          this.lastShot.set(e[1], performance.now());
          const w = PRIMARY[e[2]];
          const mx = p.x + Math.cos(p.aim) * (p.r + 8), my = p.y + Math.sin(p.aim) * (p.r + 8);
          R.part(mx, my, Math.cos(p.aim) * 30, Math.sin(p.aim) * 30, 0.06, 3, '#fff6c9');
          R.part(mx, my, Math.cos(p.aim) * 20, Math.sin(p.aim) * 20, 0.09, 2, '#ffd23f');
          const a = R.anim.get(p.id); if (a) a.recoil = 0.07;
          this.s(SHOT_SFX[w.id] || 'pea', p.x, p.y, e[1] === me ? 0.8 : 0.6);
          if (e[1] === me) { if (w.id === 'shotgun' || w.id === 'sniper' || w.id === 'blackhole') R.shake(1.5); else if (w.id !== 'dryer') R.shake(0.4); }
          break;
        }
        case 'sup': {
          const p = W.byId.get(e[1]); if (!p) break;
          const su = SUPER[e[2]];
          if (this.isClient) p.aim = e[3];
          R.ring(p.x, p.y, 26, '#ffd23f', 0.45); R.burst(p.x, p.y, '#ffd23f', 14, 90, 0.5);
          R.bubble(e[1], '★ ' + su.name);
          this.s('legend', p.x, p.y, 0.5);
          if (su.id === 'whirl') this.s('dash', p.x, p.y);
          if (su.id === 'rush') this.s('dash', p.x, p.y);
          if (su.id === 'jbomb') this.s('duckshot', p.x, p.y);
          if (su.id === 'meteor') this.s('alarm', p.x, p.y, 0.4);
          break;
        }
        case 'sready': if (e[1] === me) { this.hooks.announce('★ 궁극기 준비 완료!', '#ffd23f', 0, true); sfx('rare', 0.6); } break;
        case 'cone': {
          const [x, y, ang, len] = [e[1], e[2], e[3], e[4]];
          for (let i = 0; i < 26; i++) { const a = ang + rand(-0.6, 0.6), sp = rand(80, len * 2.4); R.part(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.55), rand(1, 3) | 0, i % 3 ? '#c8f4ff' : '#ffffff', 0, 0, 2); }
          this.s('ice', x, y); this.s('smoke', x, y, 0.6);
          break;
        }
        case 'leap': R.leap(e[1], e[2], e[3], e[4], e[5], e[6]); this.s('grow', e[2], e[3]); break;
        case 'chg': {
          const p = W.byId.get(e[1]); if (!p) break;
          R.charge(e[1], e[2], e[3], PRIMARY[e[4]].b.range || 360);
          if (this.isClient) p.aim = e[2];
          this.s('charge', p.x, p.y, e[1] === me ? 0.7 : 1);
          break;
        }
        case 'ray': R.ray(e[1], e[2], e[3], e[4], e[5]); if (e[1] === 'zap') this.s('zap', e[4], e[5]); else R.burst(e[4], e[5], e[1] === 'laser' ? '#ff6b7a' : '#fff6c9', 5, 60, 0.25); break;
        case 'hit': {
          const t = W.byId.get(e[1]); const amt = e[2];
          if (t) { t.hurtT = 0.1; R.burst(e[3], e[4] + 4, t.color, e[6] ? 1 : 4, 70, 0.35, 1, 120); }
          const crit = amt >= 40;
          if (e[5] === me && e[1] !== me) { R.num(e[3], e[4], amt, crit ? '#ffd23f' : '#ffffff', crit); if (!e[6]) { R.hitMark = 0.15; R.hitKill = false; sfx('hit', 0.6); } }
          else if (e[1] === me) { R.num(e[3], e[4], amt, '#ff6b7a', crit); R.hurtFlash = Math.min(0.6, R.hurtFlash + 0.12 + amt / 200); R.shake(Math.min(3, 0.8 + amt / 25)); if (!e[6]) sfx('hurt', 0.7); }
          else R.num(e[3], e[4], amt, '#c9cfdb', false);
          break;
        }
        case 'heal': { const p = W.byId.get(e[1]); if (p && e[2] > 0) R.num(p.x, p.y - 12, '+' + e[2], '#7dff9b', false); break; }
        case 'splat': R.splat(e[1], e[2], e[3]); this.s('death', e[1], e[2]); break;
        case 'boom': {
          if (e[4] === 2) { R.burst(e[1], e[2], '#d9c7a0', 12, 80, 0.5); R.shake(1.2); break; }
          R.explosion(e[1], e[2], e[3], e[4] === 1); this.s(e[4] === 1 ? 'headpop' : 'explode', e[1], e[2]);
          const mp = W.byId.get(me); if (mp) { const d = Math.hypot(mp.x - e[1], mp.y - e[2]); if (d < 200) R.shake((e[4] ? 1 : 3.5) * (1 - d / 200)); }
          break;
        }
        case 'sw': {
          const p = W.byId.get(e[1]); if (!p) break;
          p.swingT = 0; if (this.isClient) p.aim = e[3];
          this.s('swing', p.x, p.y);
          break;
        }
        case 'sk': {
          const p = W.byId.get(e[1]); if (!p) break;
          const sk = SKILL[e[2]];
          this.s(SKILL_SFX[sk.id] || 'deploy', p.x, p.y);
          if (sk.id === 'dash') for (let i = 0; i < 8; i++) R.part(p.x + rand(-4, 4), p.y + rand(-2, 4), rand(-30, 30), rand(-20, 0), 0.4, 2, '#e6e9f0', 1);
          if (sk.id === 'giant' || sk.id === 'pudding' || sk.id === 'shield') R.ring(p.x, p.y, 20, sk.id === 'giant' ? '#ffd23f' : sk.id === 'pudding' ? '#7dff9b' : '#4fc3ff', 0.4);
          if (sk.id === 'smoke') for (let i = 0; i < 10; i++) R.part(p.x, p.y, rand(-60, 60), rand(-60, 60), 0.7, 5, '#c6cad4', 1, 0, 3);
          break;
        }
        case 'tp': R.burst(e[1], e[2], '#c79bff', 12, 60, 0.4); R.burst(e[3], e[4], '#c79bff', 12, 60, 0.4); R.ring(e[3], e[4], 16, '#c79bff', 0.3); break;
        case 'pig': R.pigeon(e[1], e[2]); break;
        case 'emo': {
          const p = W.byId.get(e[1]); if (!p) break;
          R.bubble(e[1], TAUNT[e[2]].emote); this.s('taunt', p.x, p.y, 0.9);
          break;
        }
        case 'imp': if (this.isClient && e[1] === me && W.me) { W.me.vx += e[2]; W.me.vy += e[3]; } break;
        case 'sfx': this.s(e[1], e[2], e[3]); break;
        case 'kill': {
          const k = W.byId.get(e[1]), v = W.byId.get(e[2]);
          if (v && !v.dummy) this.hooks.killfeed(k, v, e[3], e[4]);
          if (e[1] === me && e[2] !== me && v) { R.hitMark = 0.3; R.hitKill = true; sfx('kill', 0.7); if (!v.dummy) this.hooks.announce(`${v.name} 처치!`, '#ffffff', 0); }
          if (e[2] === me && !(v && v.dummy)) this.hooks.died(k, e[3], e[4]);
          if (e[5] && e[1] === me) { for (const a of e[5]) this.hooks.announce(a[0], a[1], a[2] ? 1 : 0); if (e[5].some((a) => a[2])) sfx('multikill', 0.8); }
          else if (e[5]) for (const a of e[5]) if (a[0].includes('끊었다') || a[0] === '첫 킬!') this.hooks.announce(`${k ? k.name : ''} · ${a[0]}`, a[1], 0, true);
          break;
        }
        case 'loot': {
          const p = W.byId.get(e[1]); const slot = SLOTS.find((s) => s.key === e[2]); const it = slot.list[e[3]];
          this.hooks.announce(`${p ? p.name : '?'} · 보급품 [${it.name}] 획득!`, RARITY[it.r].color, 0, true);
          if (e[1] === me) this.hooks.loot(e[2], e[3]);
          break;
        }
        case 'ev': { const ev = EVENTS[e[1]]; if (e[2]) { this.hooks.event(ev); sfx('alarm', 0.6); } else this.hooks.eventEnd(ev); break; }
        case 'drop': this.hooks.announce('보급품 투하! 미니맵의 ★을 확인하세요', '#ffd23f', 0, true); sfx('drop', 0.5); break;
        case 'go': this.hooks.go(); break;
        case 'end': this.hooks.end(e[1]); break;
        case 'chat': { const p = W.byId.get(e[1]); this.hooks.chat(p, e[2]); break; }
        case 'join': break;
        case 'leave': this.hooks.system(`${e[2]} 님이 나갔어요.`); break;
      }
    }
  }
}

// ── 세션 공통 ──
class BaseSession {
  constructor(app) { this.app = app; this.acc = 0; this.ended = false; this.ping = 0; }
  get me() { return this.world.byId.get(this.myId); }
}

// 오프라인 / 연습장
export class OfflineSession extends BaseSession {
  constructor(app, cfg, me) {
    super(app);
    this.kind = 'offline'; this.cfg = cfg;
    const mapId = cfg.mapId === 'random' ? MAP_LIST[(Math.random() * MAP_LIST.length) | 0].id : cfg.mapId;
    this.game = new Game({ mode: cfg.mode, mapId, timeLimit: cfg.timeLimit, killLimit: cfg.killLimit, botDiff: cfg.botDiff, ff: false });
    const p = this.game.addPlayer({ ...me, team: cfg.mode === 'tdm' ? 0 : -1 });
    this.myId = p.id;
    if (cfg.mode === 'range') {
      this.game.state = 'play'; this.game.countT = 0;
      const sp = [[0.5, 0.42], [0.42, 0.48], [0.58, 0.48], [0.5, 0.56]];
      const m = this.game.map;
      p.x = m.pw * 0.5; p.y = m.ph * 0.66; p.warp++;
      for (let i = 0; i < 4; i++) {
        const d = this.game.addPlayer({ name: '허수아비 ' + (i + 1), color: '#c9b48a', face: 4, hat: i === 0 ? 2 : 0, dummy: true });
        d.x = m.pw * sp[i][0]; d.y = m.ph * sp[i][1] - 30; d.invulnT = 0; d.home = { x: d.x, y: d.y };
      }
    } else {
      this.game.fillBots(cfg.bots + 1, cfg.botDiff);
    }
    this.world = this.game;
    this.settings = { mode: cfg.mode, mapId, timeLimit: cfg.timeLimit, killLimit: cfg.killLimit };
  }
  setInput(inp) { const p = this.me; if (p) Object.assign(p.in, inp); }
  tick(dt, presenter) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      this.game.update(TICK);
      if (this.cfg.mode === 'range') for (const p of this.game.players) if (p.dummy) { p.x = p.home.x; p.y = p.home.y; p.vx = p.vy = 0; if (this.game.clock - p.lastHitT > 1.5) p.hp = p.maxHp; }
      presenter.handle(this.game.flushEvents());
    }
  }
  setSlot(slot, idx) {
    const p = this.me; if (!p) return;
    p.lo[slot] = idx;
    if (slot === 'p') { p.ammo = PRIMARY[idx].mag; p.reloadT = 0; p.burstLeft = 0; }
    if (slot === 's') p.skillCd = 0;
  }
  sendChat(text) { this.game.ev.push(['chat', this.myId, filterChat(text)]); }
  leave() {}
}

// 방장 세션: 로비 + 경기
export class HostSession extends BaseSession {
  constructor(app, me) {
    super(app);
    this.kind = 'host'; this.meInfo = me; this.myId = 1;
    this.lobby = [{ id: 1, name: me.name, color: me.color, face: me.face, hat: me.hat, host: true, ping: 0 }];
    this.nextPid = 2;
    this.settings = { mode: 'dm', mapId: 'random', timeLimit: 300, killLimit: 20, bots: 8, botDiff: 1, ff: false };
    this.game = null; this.world = null; this.pending = []; this.tickN = 0; this.inMatch = false;
    this.net = new Host({ onData: (c, d) => { c.seen = performance.now(); this.onData(c, d); }, onLeave: (c) => this.onLeave(c), onError: () => {} });
    // 응답 없는 참가자 정리 (WebRTC 끊김 감지가 늦을 때 대비)
    this.hb = setInterval(() => {
      const now = performance.now();
      for (const c of this.net.conns.values()) {
        if (c.pid === null) continue;
        if (!c.seen) c.seen = now;
        if (now - c.seen > 10000) { this.net.conns.delete(c.conn.peer); try { c.conn.close(); } catch (e) { /* 무시 */ } this.onLeave(c); }
      }
      if (!this.inMatch) this.net.broadcast({ t: 'hb' });
    }, 2000);
  }
  async open() { this.code = await this.net.open(); return this.code; }
  lobbyMsg() { return { t: 'lobby', players: this.lobby.map((p) => ({ id: p.id, name: p.name, color: p.color, face: p.face, hat: p.hat, host: !!p.host, ping: p.ping })), settings: this.settings, code: this.code, inMatch: this.inMatch }; }
  pushLobby() { this.net.broadcast(this.lobbyMsg()); this.app.lobbyUpdate(this.lobbyMsg()); }
  onData(c, d) {
    switch (d.t) {
      case 'hello': {
        if (c.pid !== null) return;
        const humans = this.lobby.length;
        if (humans >= MAX_PLAYERS) { this.net.kick(c, '방이 가득 찼어요.'); return; }
        const pid = this.nextPid++; c.pid = pid;
        const info = { id: pid, name: String(d.name || '슬라임').slice(0, 10), color: String(d.color || '#5ee07a').slice(0, 9), face: d.face | 0, hat: d.hat | 0, ping: 0, conn: c };
        this.lobby.push(info);
        this.net.send(c, { t: 'welcome', id: pid });
        this.pushLobby();
        this.app.system(`${info.name} 님이 들어왔어요.`);
        this.broadcastSys(`${info.name} 님이 들어왔어요.`, c);
        if (this.inMatch && this.game) this.joinMidMatch(info);
        break;
      }
      case 'i': if (this.game && c.pid !== null) this.game.remoteInput(c.pid, d); break;
      case 'c': {
        if (c.pid === null) return;
        const text = filterChat(d.text || ''); if (!text.trim()) return;
        if (this.inMatch && this.game) this.game.ev.push(['chat', c.pid, text]);
        else { const p = this.lobby.find((q) => q.id === c.pid); const m = { t: 'lc', name: p?.name, color: p?.color, text }; this.net.broadcast(m); this.app.lobbyChat(m); }
        break;
      }
      case 'ping': this.net.send(c, { t: 'pong', c: d.c }); { const p = this.lobby.find((q) => q.id === c.pid); if (p) p.ping = d.p | 0; } break;
    }
  }
  broadcastSys(text, except) { this.net.broadcast({ t: 'sys', text }, except); }
  onLeave(c) {
    if (c.pid === null) return;
    const i = this.lobby.findIndex((p) => p.id === c.pid); if (i < 0) return;
    const p = this.lobby[i]; this.lobby.splice(i, 1);
    if (this.game) {
      this.game.removePlayer(c.pid);
      if (this.settings.bots > 0) this.game.fillBots(Math.min(MAX_PLAYERS, Math.max(this.settings.bots, this.lobby.length)), this.settings.botDiff);
      this.net.broadcast({ t: 'roster', r: this.game.roster() });
    }
    if (!this.inMatch) this.app.system(`${p.name} 님이 나갔어요.`);
    this.pushLobby();
  }
  setSettings(s) { Object.assign(this.settings, s); this.pushLobby(); }
  start() {
    const st = this.settings;
    const mapId = st.mapId === 'random' ? MAP_LIST[(Math.random() * MAP_LIST.length) | 0].id : st.mapId;
    this.game = new Game({ mode: st.mode, mapId, timeLimit: st.timeLimit, killLimit: st.killLimit, botDiff: st.botDiff, ff: st.ff });
    this.world = this.game;
    for (const h of this.lobby) {
      const p = this.game.addPlayer({ id: h.id, name: h.name, color: h.color, face: h.face, hat: h.hat, remote: !h.host });
      p.warp = 1;
    }
    if (st.bots > 0) this.game.fillBots(Math.max(st.bots, this.lobby.length), st.botDiff);
    this.matchSettings = { mode: st.mode, mapId, timeLimit: st.timeLimit, killLimit: st.killLimit };
    this.inMatch = true; this.pending = []; this.tickN = 0; this.ended = false;
    this.net.broadcast({ t: 'start', settings: this.matchSettings, roster: this.game.roster() });
    this.app.startMatch(this);
  }
  joinMidMatch(info) {
    const g = this.game;
    if (g.players.length >= MAX_PLAYERS) { const bot = g.players.find((p) => p.bot); if (bot) g.removePlayer(bot.id); }
    const p = g.addPlayer({ id: info.id, name: info.name, color: info.color, face: info.face, hat: info.hat, remote: true });
    p.warp = 1;
    this.net.send(info.conn, { t: 'start', settings: this.matchSettings, roster: g.roster() });
    this.net.broadcast({ t: 'roster', r: g.roster() }, info.conn);
  }
  setInput(inp) { const p = this.me; if (p) Object.assign(p.in, inp); }
  tick(dt, presenter) {
    if (!this.game) return;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      this.game.update(TICK);
      const ev = this.game.flushEvents();
      presenter.handle(ev);
      for (const e of ev) this.pending.push(e);
      this.tickN++;
      if (this.tickN % 3 === 0) {
        const msg = { t: 's', s: this.game.snapshot(), e: this.pending };
        if (this.tickN % 30 === 0) msg.sc = this.game.scores();
        this.net.broadcast(msg);
        this.pending = [];
      }
    }
  }
  backToLobby() {
    this.inMatch = false; this.game = null; this.world = null;
    this.net.broadcast({ t: 'tolobby' });
    this.pushLobby();
  }
  sendChat(text) {
    const t = filterChat(text); if (!t.trim()) return;
    if (this.inMatch && this.game) this.game.ev.push(['chat', this.myId, t]);
    else { const m = { t: 'lc', name: this.meInfo.name, color: this.meInfo.color, text: t }; this.net.broadcast(m); this.app.lobbyChat(m); }
  }
  kickPlayer(id) { const p = this.lobby.find((q) => q.id === id); if (p && p.conn) this.net.kick(p.conn, '방장이 내보냈어요.'); }
  leave() { clearInterval(this.hb); this.net.close(); }
}

// 참가자 세션
export class ClientSession extends BaseSession {
  constructor(app, me) {
    super(app);
    this.kind = 'client'; this.meInfo = me; this.myId = -1; this.world = null; this.sendAcc = 0;
    this.net = new Client({ onData: (d) => this.onData(d), onClose: (r) => this.app.disconnected(r) });
    this.lastPing = 0; this.queue = [];
  }
  async join(code) {
    await this.net.connect(code); this.net.send({ t: 'hello', ...this.meInfo });
    this.seen = performance.now();
    this.hb = setInterval(() => {
      this.net.send({ t: 'ping', c: performance.now(), p: this.ping });
      if (performance.now() - this.seen > 10000) { clearInterval(this.hb); this.app.disconnected('방장의 응답이 없어 연결을 종료했어요.'); }
    }, 2000);
  }
  onData(d) {
    this.seen = performance.now();
    switch (d.t) {
      case 'welcome': this.myId = d.id; break;
      case 'lobby': this.lobbyState = d; this.app.lobbyUpdate(d); break;
      case 'lc': this.app.lobbyChat(d); break;
      case 'sys': this.app.system(d.text); break;
      case 'start': {
        const map = getMap(d.settings.mapId);
        this.settings = d.settings;
        this.world = new ClientWorld(map, d.settings, this.myId);
        this.world.applyRoster(d.roster);
        this.ended = false;
        this.app.startMatch(this);
        break;
      }
      case 'roster': if (this.world) this.world.applyRoster(d.r); break;
      case 's': {
        if (!this.world) break;
        const now = performance.now() / 1000;
        this.world.pushSnap(d.s, now);
        if (d.sc) this.world.applyScores(d.sc);
        if (d.e && d.e.length) this.queue.push(d.e);
        break;
      }
      case 'tolobby': this.world = null; this.app.toLobby(); break;
      case 'pong': this.ping = Math.round(performance.now() - d.c); break;
      case 'bye': this.net.closed = true; this.app.disconnected(d.reason || '연결이 끊어졌어요.'); break;
    }
  }
  setInput(inp) {
    const me = this.world && this.world.me; if (!me) return;
    me.in.mx = inp.mx; me.in.my = inp.my; me.aim = inp.aim;
    this.inp = inp;
  }
  tick(dt, presenter) {
    const now = performance.now() / 1000;
    if (!this.world) return;
    for (const e of this.queue) presenter.handle(e);
    this.queue.length = 0;
    const W = this.world;
    // 로컬 예측 (고정 스텝)
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      if (W.state === 'count' && W.me) { W.me.in.mx = W.me.in.my = 0; }
      W.stepMe(TICK, W.event?.id);
    }
    W.update(dt, now);
    // 입력 전송 (30Hz)
    this.sendAcc += dt;
    if (this.sendAcc >= 1 / 30 && W.me && this.inp) {
      this.sendAcc = 0;
      const me = W.me, i = this.inp;
      this.net.send({ t: 'i', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, vx: Math.round(me.vx), vy: Math.round(me.vy), mx: Math.round(i.mx * 100) / 100, my: Math.round(i.my * 100) / 100, a: Math.round(i.aim * 1000) / 1000, f: i.fire ? 1 : 0, fn: i.fireN, mn: i.meleeN, sn: i.skillN, tn: i.tauntN, rn: i.reloadN, un: i.superN, w: me.warpSeen });
    }
  }
  sendChat(text) { this.net.send({ t: 'c', text }); }
  leave() { clearInterval(this.hb); this.net.close(); }
}

export { RESPAWN_TIME };
