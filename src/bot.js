// 봇 AI: 난이도별 반응속도/조준오차, 흐름장 길찾기, 무기별 교전거리
import { PRIMARY, MELEE, SKILL, SUPER } from './data.js';
import { flowField, flowDir, lineOfSight, solidPx } from './maps.js';
import { angDiff, rand, dist2, clamp } from './util.js';

const DIFF = [
  { react: 0.6, err: 0.34, lead: 0.15, turn: 5, skill: 0.25, see: 220 },
  { react: 0.33, err: 0.17, lead: 0.6, turn: 9, skill: 0.6, see: 270 },
  { react: 0.17, err: 0.07, lead: 0.95, turn: 16, skill: 1, see: 320 },
];

export function botInit(p, diff, respawn) {
  const d = DIFF[clamp(diff | 0, 0, 2)];
  if (!p.ai || !respawn) p.ai = { d, target: null, think: 0, reactT: 0, strafe: 1, strafeT: 0, noise: 0, noiseT: 0, stuckT: 0, lastX: 0, lastY: 0, unstickT: 0, ux: 0, uy: 0, goal: null, kills: 0, tauntWant: 0 };
  p.ai.d = d; p.ai.target = null; p.ai.goal = null;
}

function weaponRange(w) { return w.b.hitscan ? w.b.range : w.b.spd * w.b.life; }

export function botThink(g, p, dt) {
  const ai = p.ai; if (!ai || !p.alive) return;
  const inp = p.in, D = ai.d;
  const w = PRIMARY[p.lo.p], mw = MELEE[p.lo.m];
  const range = weaponRange(w);
  // ── 목표 선택 (0.15초마다) ──
  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = 0.12 + Math.random() * 0.08;
    let best = null, bs = Infinity;
    for (const t of g.targetList(p)) {
      const d = Math.sqrt(dist2(p.x, p.y, t.x, t.y));
      if (d > D.see) continue;
      if (t.k !== 'decoy' && g.inSmoke(t) && d > 28) continue;
      if (g.hiddenFrom(t, p)) continue;
      if (!lineOfSight(g.map, p.x, p.y, t.x, t.y)) continue;
      let s = d - (t === ai.target ? 60 : 0) + (t.hp !== undefined ? t.hp * 0.4 : 20);
      if (t.invulnT > 0) s += 80;
      if (s < bs) { bs = s; best = t; }
    }
    if (best && best !== ai.target) ai.reactT = D.react * rand(0.7, 1.3);
    ai.target = best;
    // 비전투 목표
    ai.goal = null;
    if (!best || p.hp < 40) {
      let gb = null, gd = Infinity;
      for (const o of g.objs) {
        let want = 0;
        if ((o.k === 'food' || o.k === 'jelly') && p.hp < p.maxHp * 0.65) want = 1.4;
        if (o.k === 'crate') want = 1;
        if (o.k === 'drop') want = 0.6;
        if (!want) continue;
        const d = Math.sqrt(dist2(p.x, p.y, o.x, o.y)) / want;
        if (d < gd) { gd = d; gb = o; }
      }
      if (gb && gd < 500) ai.goal = gb;
    }
    if (!best && !ai.goal) {
      // 가장 가까운 적을 사냥
      let near = null, nd = Infinity;
      for (const t of g.players) if (t.alive && g.enemies(p, t) && t !== p) { const d = dist2(p.x, p.y, t.x, t.y); if (d < nd) { nd = d; near = t; } }
      ai.hunt = near;
    } else ai.hunt = null;
  }
  const t = ai.target && (ai.target.k === 'decoy' ? ai.target.life > 0 : ai.target.alive) ? ai.target : null;
  if (!t) ai.target = null;
  ai.reactT -= dt;

  // ── 이동 ──
  let mx = 0, my = 0;
  const gotoPoint = (x, y) => {
    if (lineOfSight(g.map, p.x, p.y, x, y) && dist2(p.x, p.y, x, y) < 140 * 140) { const dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy) || 1; mx = dx / l; my = dy / l; return; }
    const f = flowField(g.map, x, y, g.clock); const d = flowDir(g.map, f, p.x, p.y); mx = d.x; my = d.y;
  };
  if (t) {
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    let pref = clamp(range * 0.55, 34, 190);
    if (p.ammo <= 0 || p.reloadT > 0) pref = 14; // 장전 중엔 근접 돌격
    if (p.hp < 30 && t.hp > p.hp) pref = Math.max(pref, 150);
    ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafeT = rand(0.5, 1.4); ai.strafe = Math.random() < 0.5 ? -1 : 1; }
    if (d > pref + 25) { mx = nx; my = ny; }
    else if (d < pref - 25) { mx = -nx; my = -ny; }
    mx += -ny * ai.strafe * 0.8; my += nx * ai.strafe * 0.8;
    // 벽 쪽 후퇴 방지
    if (solidPx(g.map, p.x + mx * 14, p.y + my * 14)) { ai.strafe *= -1; mx = nx * 0.3 - ny * ai.strafe; my = ny * 0.3 + nx * ai.strafe; }
  } else if (ai.goal) gotoPoint(ai.goal.x, ai.goal.y);
  else if (ai.hunt) gotoPoint(ai.hunt.x, ai.hunt.y);
  // 끼임 감지
  ai.stuckT += dt;
  if (ai.stuckT > 0.5) {
    const moved = Math.hypot(p.x - ai.lastX, p.y - ai.lastY);
    if (moved < 4 && (mx || my)) { ai.unstickT = 0.45; const a = rand(0, Math.PI * 2); ai.ux = Math.cos(a); ai.uy = Math.sin(a); }
    ai.stuckT = 0; ai.lastX = p.x; ai.lastY = p.y;
  }
  if (ai.unstickT > 0) { ai.unstickT -= dt; mx = ai.ux; my = ai.uy; }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  inp.mx = mx; inp.my = my;

  // ── 조준 ──
  ai.noiseT -= dt; if (ai.noiseT <= 0) { ai.noiseT = 0.25; ai.noiseTarget = rand(-D.err, D.err); }
  ai.noise += ((ai.noiseTarget || 0) - ai.noise) * Math.min(1, 6 * dt);
  inp.fire = false;
  if (t) {
    const d = Math.sqrt(dist2(p.x, p.y, t.x, t.y));
    const bs = w.b.hitscan ? 99999 : w.b.spd;
    const lt = (w.b.charge ? w.b.charge : d / bs) * D.lead;
    const tx = t.x + (t.vx || 0) * lt, ty = t.y + (t.vy || 0) * lt;
    const want = Math.atan2(ty - p.y, tx - p.x) + ai.noise;
    p.aim += angDiff(p.aim, want) * Math.min(1, D.turn * dt);
    inp.aim = p.aim;
    const facing = Math.abs(angDiff(p.aim, want)) < 0.3;
    if (ai.reactT <= 0 && facing && d < range * 1.05 && p.tauntT <= 0) inp.fire = true;
    if (ai.reactT <= 0 && d < mw.range + (t.r || 6) + 12 && p.meleeCd <= 0) inp.meleeN++;
    // 궁극기
    if (p.superCh >= 1 && ai.reactT <= 0 && Math.random() < dt * 2.5 * D.skill + dt) {
      const su = SUPER[p.lo.u];
      const ok = su.id === 'fortress' ? d < 200 : su.id === 'whirl' ? d < 45 : su.id === 'rush' ? d < 110 : d < su.range + 10 && d > (su.id === 'leap' || su.id === 'jbomb' || su.id === 'meteor' ? 30 : 0);
      if (ok) inp.superN++;
    }
    // 스킬
    if (p.skillCd <= 0 && ai.reactT <= 0 && Math.random() < D.skill * dt * 3) {
      const s = SKILL[p.lo.s].id;
      let use = false;
      switch (s) {
        case 'dash': use = d > 90 || (p.hp < 35 && d < 60); break;
        case 'smoke': use = p.hp < 45; break;
        case 'banana': use = d < 110; break;
        case 'pudding': use = p.hp < 55; break;
        case 'shield': use = g.clock - p.lastHitT < 0.6; break;
        case 'blink': use = d > 110 && d < 200; break;
        case 'turret': use = d < 170; break;
        case 'split': use = d < 160; break;
        case 'giant': use = d < 120; break;
        case 'strike': use = d < 150 && d > 40; break;
      }
      if (use) inp.skillN++;
    }
  } else {
    // 이동 방향을 바라봄
    if (mx || my) { p.aim += angDiff(p.aim, Math.atan2(my, mx)) * Math.min(1, 6 * dt); inp.aim = p.aim; }
    if (p.skillCd <= 0 && SKILL[p.lo.s].id === 'pudding' && p.hp < 60) inp.skillN++;
    if (p.ammo < PRIMARY[p.lo.p].mag * 0.3 && p.reloadT <= 0) { p.ammo = Math.min(p.ammo, 0); }
    // 처치 후 도발
    if (p.kills > ai.kills) { ai.kills = p.kills; if (Math.random() < 0.55) ai.tauntWant = 0.6; }
    if (ai.tauntWant > 0) { ai.tauntWant -= dt; if (ai.tauntWant <= 0 && p.tauntCd <= 0) inp.tauntN++; }
  }
  if (p.kills > ai.kills) ai.kills = p.kills;
}
