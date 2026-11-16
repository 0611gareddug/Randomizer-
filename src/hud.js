// 인게임 HUD: 값이 바뀔 때만 DOM 갱신 (레이아웃 스래싱 방지)
import { PRIMARY, MELEE, SKILL, TAUNT, SLOTS, RARITY, EVENTS } from './data.js';
import { iconURL, slimeSprite, drawFace, drawHat } from './sprites.js';
import { sfx } from './audio.js';
import { escapeHtml, pick } from './util.js';
import { TILE } from './maps.js';

const $ = (id) => document.getElementById(id);
const setText = (el, v) => { if (el._t !== v) { el._t = v; el.textContent = v; } };
const setStyle = (el, k, v) => { const key = '_s' + k; if (el[key] !== v) { el[key] = v; el.style.setProperty(k, v); } };
const slimeURLCache = new Map();
export function slimeURL(color, face = 0, hat = 0) {
  const key = color + face + '_' + hat;
  if (slimeURLCache.has(key)) return slimeURLCache.get(key);
  const c = document.createElement('canvas'); c.width = 20; c.height = 20;
  const x = c.getContext('2d');
  x.drawImage(slimeSprite(color), 2, 5); drawFace(x, face, 10, 12, 0, 0, false, 0); if (hat) drawHat(x, hat, 10, 6);
  const u = c.toDataURL(); slimeURLCache.set(key, u); return u;
}
export function itemOf(slot, idx) { return SLOTS.find((s) => s.key === slot).list[idx]; }

export class Hud {
  constructor() {
    this.el = $('hud');
    this.slotsEl = $('slots');
    this.slotEls = SLOTS.map((s, i) => {
      const d = document.createElement('div'); d.className = 'slot';
      d.innerHTML = `<img alt=""><span class="cd"></span><span class="cdn"></span><span class="key">${{ p: '좌클', m: 'Q', s: 'E', u: 'Space', t: 'F' }[s.key]}</span><span class="amt"></span>${i === 0 ? '<span class="rl"></span>' : ''}`;
      this.slotsEl.appendChild(d);
      return { d, img: d.querySelector('img'), cd: d.querySelector('.cd'), cdn: d.querySelector('.cdn'), amt: d.querySelector('.amt'), rl: d.querySelector('.rl') };
    });
    this.tb = { p: $('tFire'), m: $('tMelee'), s: $('tSkill'), t: $('tTaunt'), u: $('tSuper') };
    this.mm = $('minimap'); this.mmx = this.mm.getContext('2d'); this.mmBase = null; this.mmT = 0;
    this.reels = []; this.rouActive = false; this.lastLo = '';
    this.annQ = []; this.feed = [];
    this.hpLagV = 1; this.lastHp = 100;
  }

  setMap(map) {
    // 미니맵 기본 이미지
    const c = document.createElement('canvas'); c.width = map.w * 3; c.height = map.h * 3;
    const x = c.getContext('2d');
    x.fillStyle = '#1a1630'; x.fillRect(0, 0, c.width, c.height);
    for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
      const t = map.grid[j * map.w + i];
      x.fillStyle = t === 1 ? '#5b5488' : t === 2 ? '#3e3866' : t === 3 ? '#3a5d80' : t >= 4 ? '#4a4430' : '#25203f';
      x.fillRect(i * 3, j * 3, 3, 3);
    }
    this.mmBase = c; this.mm.width = c.width; this.mm.height = c.height; this.map = map;
    $('killfeed').innerHTML = ''; $('announce').innerHTML = ''; $('chatLog').innerHTML = '';
    this.feed = []; this.lastLo = ''; this.evShown = null;
  }

  // ── 매 프레임 ──
  update(S, W, me, dt, mobile) {
    const st = S.settings || {};
    // 타이머
    let tm = st.timeLimit ? Math.max(0, st.timeLimit - W.time) : W.time;
    if (S.kind === 'client' && W.state === 'play') tm = Math.max(0, st.timeLimit - (W.time + (performance.now() / 1000 - W.tmAt)));
    if (st.mode === 'range') setText($('timer'), '연습장');
    else setText($('timer'), `${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')}`);
    const tdm = st.mode === 'tdm';
    $('tsRed').classList.toggle('hidden', !tdm); $('tsBlue').classList.toggle('hidden', !tdm);
    if (tdm) { setText($('tsRed'), String(W.teamScore[0])); setText($('tsBlue'), String(W.teamScore[1])); }
    // 목표
    let goal = '';
    if (st.mode === 'range') goal = '오른쪽 패널에서 장비를 골라 허수아비에게 시험해 보세요';
    else if (tdm) goal = st.killLimit ? `팀 목표 ${st.killLimit}킬` : '시간 종료 시 많이 처치한 팀 승리';
    else {
      let lead = null; for (const p of W.players) if (!lead || p.kills > lead.kills) lead = p;
      goal = `${st.killLimit ? '목표 ' + st.killLimit + '킬 · ' : ''}1위 ${lead ? lead.name + ' ' + lead.kills : '-'}${me ? ' · 나 ' + me.kills : ''}`;
    }
    setText($('goal'), goal);
    // 이벤트 배너
    const ev = W.event;
    const eb = $('evBanner');
    if (ev) { eb.classList.remove('hidden'); setText(eb, `⚡ ${ev.name} · ${Math.max(0, Math.ceil(W.eventT))}초`); setStyle(eb, 'background', ev.color); }
    else eb.classList.add('hidden');
    if (!me) return;
    // 체력
    const hpF = Math.max(0, me.hp / me.maxHp);
    setStyle($('hpFill'), 'transform', `scaleX(${hpF.toFixed(3)})`);
    if (hpF < this.hpLagV) this.hpLagV = Math.max(hpF, this.hpLagV - dt * 0.6); else this.hpLagV = hpF;
    setStyle($('hpLag'), 'transform', `scaleX(${this.hpLagV.toFixed(3)})`);
    setStyle($('hpFill'), 'background', hpF > 0.6 ? 'linear-gradient(#7af59a,#3fbf63)' : hpF > 0.3 ? 'linear-gradient(#ffe37a,#e0b020)' : 'linear-gradient(#ff8a95,#d8344a)');
    setText($('hpText'), me.alive ? `${Math.ceil(me.hp)} / ${me.maxHp}` : '부활 대기');
    // 장비 슬롯
    const lo = me.lo, loKey = lo.p + ',' + lo.m + ',' + lo.s + ',' + lo.t + ',' + lo.u;
    if (loKey !== this.lastLo) {
      this.lastLo = loKey;
      SLOTS.forEach((s, i) => {
        const it = s.list[lo[s.key]], e = this.slotEls[i];
        e.img.src = iconURL(it.id); e.d.style.setProperty('--rc', RARITY[it.r].color); e.d.title = it.name;
        const tb = this.tb[s.key]; if (tb) { tb.querySelector('img').src = iconURL(it.id); tb.style.boxShadow = `0 0 0 3px rgba(11,9,24,.9), inset 0 0 0 3px ${RARITY[it.r].color}`; }
      });
    }
    const w = PRIMARY[lo.p];
    const reloading = me.reloadT > 0;
    const rp = S.kind === 'client' ? me.reloadPct / 100 : (reloading ? 1 - me.reloadT / w.reload : 1);
    const ammoTxt = reloading ? '장전' : `${me.ammo}/${w.mag}`;
    setText(this.slotEls[0].amt, ammoTxt);
    setStyle(this.slotEls[0].rl, 'transform', `scaleX(${reloading ? rp.toFixed(2) : (me.ammo / w.mag).toFixed(2)})`);
    setStyle(this.slotEls[0].rl, 'background', reloading ? '#ffd23f' : '#fff');
    const mcd = MELEE[lo.m].cd, scd = S.settings.mode === 'range' ? 1 : SKILL[lo.s].cd;
    const mF = Math.min(1, (me.meleeCd || 0) / mcd), sF = Math.min(1, (me.skillCd || 0) / scd), tF = Math.min(1, (me.tauntCd || 0) / 3.5);
    setStyle(this.slotEls[1].cd, '--cd', mF.toFixed(2)); setStyle(this.slotEls[2].cd, '--cd', sF.toFixed(2));
    setText(this.slotEls[2].cdn, me.skillCd > 0.05 ? String(Math.ceil(me.skillCd)) : '');
    const uI = SLOTS.findIndex((x) => x.key === 'u'), tI = SLOTS.findIndex((x) => x.key === 't');
    const sc = Math.min(1, me.superCh || 0), ready = sc >= 1;
    setStyle(this.slotEls[uI].cd, '--cd', (1 - sc).toFixed(2)); setStyle(this.slotEls[tI].cd, '--cd', tF.toFixed(2));
    this.slotEls[uI].d.classList.toggle('ready', ready);
    setText(this.slotEls[uI].cdn, ready ? '' : Math.floor(sc * 100) + '%');
    if (mobile) { setStyle(this.tb.u.querySelector('.cd'), '--cd', (1 - sc).toFixed(2)); this.tb.u.classList.toggle('ready', ready); }
    if (ready && !this._wasReady) { this.el.classList.add('superReady'); } this._wasReady = ready;
    if (mobile) {
      setText(this.tb.p.querySelector('.amt'), ammoTxt);
      setStyle(this.tb.p.querySelector('.cd'), '--cd', reloading ? (1 - rp).toFixed(2) : '0');
      setStyle(this.tb.m.querySelector('.cd'), '--cd', mF.toFixed(2));
      setStyle(this.tb.s.querySelector('.cd'), '--cd', sF.toFixed(2));
      setStyle(this.tb.t.querySelector('.cd'), '--cd', tF.toFixed(2));
    }
    this.reloadInfo = { reloading, rp };
  }

  minimap(W, me, dt, lastShot) {
    this.mmT -= dt; if (this.mmT > 0) return; this.mmT = 0.15;
    const x = this.mmx, k = 3 / TILE;
    x.drawImage(this.mmBase, 0, 0);
    const now = performance.now();
    for (const o of W.objs) {
      if (o.k === 'crate' || o.k === 'drop') { const on = ((now / 250) | 0) % 2; x.fillStyle = on ? '#ffd23f' : '#ff8f1f'; x.fillRect(o.x * k - 3, o.y * k - 3, 7, 7); x.fillStyle = '#1a1530'; x.fillRect(o.x * k - 1, o.y * k - 1, 3, 3); }
      else if (o.k === 'food') { x.fillStyle = '#7dff9b'; x.fillRect(o.x * k - 1, o.y * k - 1, 3, 3); }
    }
    for (const p of W.players) {
      if (!p.alive || p === me || p.dummy) continue;
      const ally = W.mode === 'tdm' && me && p.team === me.team;
      const shot = now - (lastShot.get(p.id) || -9999) < 1800;
      if (!ally && !shot) continue;
      x.fillStyle = ally ? '#4fa8ff' : '#ff4d5e';
      x.fillRect(p.x * k - 2, p.y * k - 2, 5, 5);
    }
    if (me && me.alive) { x.fillStyle = '#1a1530'; x.fillRect(me.x * k - 3, me.y * k - 3, 7, 7); x.fillStyle = '#ffffff'; x.fillRect(me.x * k - 2, me.y * k - 2, 5, 5); }
  }

  // ── 킬피드/알림/채팅 ──
  killfeed(k, v, slot, idx, myId) {
    const box = $('killfeed');
    const d = document.createElement('div'); d.className = 'k' + ((k && k.id === myId) || v.id === myId ? ' me' : '');
    let ico = '';
    if (slot !== 'x') { const it = itemOf(slot, idx); ico = `<img src="${iconURL(it.id)}" title="${escapeHtml(it.name)}">`; }
    else ico = '💀';
    const kn = k && k !== v ? `<span style="color:${k.color}">${escapeHtml(k.name)}</span>` : '';
    d.innerHTML = `${kn}${ico}<span style="color:${v.color}">${escapeHtml(v.name)}</span>`;
    box.appendChild(d);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add('out'), 5500); setTimeout(() => d.remove(), 6100);
  }
  announce(text, color, big, small) {
    const box = $('announce');
    const d = document.createElement('div'); d.className = 'a' + (big ? ' big' : '') + (small ? ' small' : '');
    d.textContent = text; d.style.color = color || '#fff';
    box.appendChild(d);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add('out'), big ? 2200 : 1800); setTimeout(() => d.remove(), big ? 2700 : 2300);
  }
  bigText(text, color) {
    const b = $('bigText'); b.textContent = text; b.style.color = color || ''; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    clearTimeout(this._bt); this._bt = setTimeout(() => { b.textContent = ''; }, 900);
  }
  chat(name, color, text, system) {
    const box = $('chatLog');
    const d = document.createElement('div');
    d.innerHTML = system ? `<span style="color:#ffd23f">${escapeHtml(text)}</span>` : `<span style="color:${color}">${escapeHtml(name)}</span>: ${escapeHtml(text)}`;
    box.appendChild(d);
    while (box.children.length > 6) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add('out'), 8000); setTimeout(() => d.remove(), 8700);
  }
  death(killer, slot, idx) {
    const el = $('deathInfo');
    if (!killer) { el.innerHTML = '💀 쓰러졌어요!'; }
    else {
      const it = slot !== 'x' ? itemOf(slot, idx) : null;
      el.innerHTML = `💀 <span style="color:${killer.color}">${escapeHtml(killer.name)}</span>에게 당했어요${it ? ` · <img src="${iconURL(it.id)}"> ${escapeHtml(it.name)}` : ''}`;
    }
    el.classList.remove('hidden');
  }
  hideDeath() { $('deathInfo').classList.add('hidden'); }

  // ── 룰렛 ──
  roulette(lo, title, onDone) {
    const R = $('roulette'), box = $('reels');
    $('rouTitle').textContent = title || '장비 룰렛!';
    box.innerHTML = '';
    this.reels = SLOTS.map((s, i) => {
      const it = s.list[lo[s.key]];
      const d = document.createElement('div'); d.className = 'reel';
      d.innerHTML = `<div class="lab">${s.name}</div><div class="win spin"><img alt=""></div><div class="nm">&nbsp;</div><div class="rr"></div>`;
      box.appendChild(d);
      return { d, win: d.querySelector('.win'), img: d.querySelector('img'), nm: d.querySelector('.nm'), rr: d.querySelector('.rr'), list: s.list, final: it, stopAt: 0.6 + i * 0.48, done: false, next: 0 };
    });
    R.classList.remove('hidden');
    this.rouT = 0; this.rouActive = true; this.rouDone = onDone; this.rouHold = 0;
  }
  updateRoulette(dt) {
    if (!this.rouActive) return;
    this.rouT += dt;
    let all = true;
    for (const r of this.reels) {
      if (r.done) continue;
      all = false;
      const left = r.stopAt - this.rouT;
      if (left <= 0) {
        r.done = true; r.img.src = iconURL(r.final.id);
        r.win.classList.remove('spin'); r.win.classList.add('stop');
        r.win.style.setProperty('--rc', RARITY[r.final.r].color);
        r.d.classList.add('r' + r.final.r);
        r.nm.textContent = r.final.name; r.nm.style.color = RARITY[r.final.r].color;
        r.rr.textContent = RARITY[r.final.r].name; r.rr.style.background = RARITY[r.final.r].color;
        sfx(['lock', 'rare', 'epic', 'legend'][r.final.r], 0.8);
        continue;
      }
      r.next -= dt;
      if (r.next <= 0) {
        r.next = left < 0.3 ? 0.11 : left < 0.6 ? 0.07 : 0.045;
        const it = pick(r.list); r.img.src = iconURL(it.id);
        r.win.style.setProperty('--rc', RARITY[it.r].color);
        sfx('tick', 0.5);
      }
    }
    if (all) {
      this.rouHold += dt;
      if (this.rouHold > 0.9) { this.hideRoulette(); if (this.rouDone) { const f = this.rouDone; this.rouDone = null; f(); } }
    }
  }
  hideRoulette() { this.rouActive = false; $('roulette').classList.add('hidden'); }

  lootPop(slot, idx) {
    const it = itemOf(slot, idx), el = $('lootPop');
    el.innerHTML = `<img src="${iconURL(it.id)}"><div><div style="font-size:calc(11px*var(--u));color:var(--mute)">보급품 획득! · ${SLOTS.find((s) => s.key === slot).name}</div><div style="color:${RARITY[it.r].color};font-size:calc(16px*var(--u))">${escapeHtml(it.name)}</div><div style="font-size:calc(11px*var(--u))" class="mute">${escapeHtml(it.desc)}</div></div>`;
    el.style.boxShadow = `0 0 0 3px var(--line), 0 0 24px ${RARITY[it.r].color}`;
    el.classList.remove('hidden'); clearTimeout(this._lp); this._lp = setTimeout(() => el.classList.add('hidden'), 3500);
    sfx('legend', 0.8);
  }

  // ── 점수판 ──
  scoreboard(W, me, S, show) {
    const el = $('scoreboard');
    if (!show) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const now = performance.now(); if (this._sbT && now - this._sbT < 250) return; this._sbT = now;
    const rows = W.players.filter((p) => !p.dummy).slice().sort((a, b) => (W.mode === 'tdm' ? a.team - b.team : 0) || b.kills - a.kills || a.deaths - b.deaths);
    const tdm = W.mode === 'tdm';
    let html = `<h2 style="margin-bottom:8px">🏆 점수판 ${tdm ? `<span style="color:#ff5d73">${W.teamScore[0]}</span> : <span style="color:#4fa8ff">${W.teamScore[1]}</span>` : ''}</h2><table class="sb"><tr><th>#</th><th>이름</th><th>처치</th><th>죽음</th><th>피해량</th><th>연속</th></tr>`;
    rows.forEach((p, i) => {
      html += `<tr class="${p === me ? 'me' : ''} ${tdm ? (p.team === 0 ? 'red' : 'blue') : ''}"><td>${i + 1}</td><td class="n"><img src="${slimeURL(p.color, p.face, p.hat)}">${escapeHtml(p.name)}${p.bot ? ' <span class="mute">BOT</span>' : ''}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.round(p.dmg || 0)}</td><td>${p.streak || 0}</td></tr>`;
    });
    el.innerHTML = html + '</table>';
  }

  // ── 결과 ──
  results(info, myId, opts) {
    const scr = $('scrResult'); scr.classList.remove('hidden');
    const meRank = info.rank.findIndex((r) => r.id === myId);
    const mine = info.rank[meRank];
    let head = '', col = '#ffd23f', win = false;
    if (info.mode === 'tdm') {
      if (info.winTeam < 0) { head = '무승부!'; col = '#c7ccd6'; }
      else { win = mine && mine.team === info.winTeam; head = win ? '팀 승리!' : '팀 패배…'; col = win ? '#ffd23f' : '#ff6b7a'; }
    } else { win = meRank === 0; head = win ? '🏆 1위! 승리!' : `${meRank + 1}위`; col = win ? '#ffd23f' : meRank < 3 ? '#4fc3ff' : '#c7ccd6'; }
    const h = $('resHead'); h.textContent = head; h.style.color = col;
    let body = '';
    if (info.mode === 'tdm') body += `<div style="text-align:center;font-size:calc(22px*var(--u));margin-bottom:8px"><span style="color:#ff5d73">레드 ${info.teamScore[0]}</span> : <span style="color:#4fa8ff">${info.teamScore[1]} 블루</span></div>`;
    body += '<div class="podium" id="podium"></div>';
    body += '<div class="titles">';
    const mvp = info.rank[0];
    if (mvp) body += `<div><b>👑 MVP</b>${escapeHtml(mvp.name)} · ${mvp.kills}킬 ${mvp.deaths}데스</div>`;
    for (const t of info.titles) { const p = info.rank.find((r) => r.id === t.id); if (p) body += `<div><b>${escapeHtml(t.title)}</b>${escapeHtml(p.name)} · ${escapeHtml(t.val)}</div>`; }
    if (info.topWeapon) { const it = itemOf(info.topWeapon.key[0], +info.topWeapon.key.slice(1)); if (it) body += `<div><b>🔫 최다 처치 장비</b><img src="${iconURL(it.id)}" style="width:20px;vertical-align:middle"> ${escapeHtml(it.name)} · ${info.topWeapon.n}킬</div>`; }
    body += '</div>';
    body += '<table class="sb" style="margin-top:12px"><tr><th>#</th><th>이름</th><th>처치</th><th>죽음</th><th>피해량</th><th>최고 연속</th></tr>';
    info.rank.forEach((p, i) => { body += `<tr class="${p.id === myId ? 'me' : ''} ${info.mode === 'tdm' ? (p.team === 0 ? 'red' : 'blue') : ''}"><td>${i + 1}</td><td class="n"><img src="${slimeURL(p.color, p.face, p.hat)}">${escapeHtml(p.name)}${p.bot ? ' <span class="mute">BOT</span>' : ''}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.dmg}</td><td>${p.best}</td></tr>`; });
    body += '</table>';
    $('resBody').innerHTML = body;
    // 시상대
    const pod = $('podium'); const order = [1, 0, 2];
    for (const i of order) {
      const p = info.rank[i]; if (!p) continue;
      const d = document.createElement('div'); d.className = 'pd';
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 28;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      x.save(); x.scale(1.6, 1.6); x.drawImage(slimeSprite(p.color), 2, 3); drawFace(x, i === 0 ? 1 : p.face, 10, 9, 0, 0, false, 0); drawHat(x, i === 0 ? 1 : p.hat, 10, 4); x.restore();
      d.appendChild(cv);
      const nm = document.createElement('div'); nm.textContent = p.name; d.appendChild(nm);
      const blk = document.createElement('div'); blk.className = 'blk'; blk.style.height = `calc(${[70, 50, 36][i]}px * var(--u))`; blk.textContent = i + 1; d.appendChild(blk);
      pod.appendChild(d);
    }
    $('resNote').textContent = opts.note || '';
    $('resAgain').textContent = opts.againText || '다시 하기';
    $('resAgain').classList.toggle('hidden', !opts.again);
    sfx(win ? 'win' : 'lose', 0.8);
    return { win, rank: meRank, mine };
  }
}
