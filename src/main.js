// 룰렛 러시 - 앱 진입점
import { protect } from './protect.js';
import { initAudio, sfx, playMusic, setVolumes } from './audio.js';
import { input, initInput, initTouch, clearInput } from './input.js';
import { Renderer } from './render.js';
import { Hud, slimeURL, itemOf } from './hud.js';
import { Presenter, OfflineSession, HostSession, ClientSession, smokeAt } from './game.js';
import { errText } from './net.js';
import { getMap, MAP_LIST, lineOfSight } from './maps.js';
import { PRIMARY, MELEE, SKILL, TAUNT, SLOTS, RARITY, SLIME_COLORS, FACES, HATS, QUICK_CHAT } from './data.js';
import { slimeSprite, drawFace, drawHat, iconURL } from './sprites.js';
import { store, escapeHtml, isTouch, clamp, dist2 } from './util.js';

protect();

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const R = new Renderer(canvas);
const hud = new Hud();
const mobile = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (isTouch() && !(window.matchMedia && matchMedia('(pointer: fine)').matches));
if (mobile) document.body.classList.add('mobile');
R.mobile = mobile;

// ── 저장 데이터 ──
const profile = store.get('profile', null) || { name: '슬라임' + ((Math.random() * 9000 + 1000) | 0), color: SLIME_COLORS[(Math.random() * SLIME_COLORS.length) | 0], face: 0, hat: 0 };
const settings = Object.assign({ sfx: 70, music: 45, shake: true, dmgNum: true, lowSpec: false, fps: false, btnSize: 1, aimAssist: true }, store.get('settings', {}));
const codex = Object.assign({ p: [], m: [], s: [], t: [] }, store.get('codex', {}));
const stats = Object.assign({ matches: 0, wins: 0, kills: 0, deaths: 0, dmg: 0, best: 0, legend: 0, loots: 0, wk: {} }, store.get('stats', {}));
let offlineCfg = Object.assign({ mode: 'dm', mapId: 'random', bots: 5, botDiff: 1, timeLimit: 300, killLimit: 20 }, store.get('offlineCfg', {}));
const saveProfile = () => store.set('profile', profile);
const saveSettings = () => store.set('settings', settings);

function applySettings() {
  setVolumes(settings.sfx / 100, settings.music / 100);
  R.shakeOn = settings.shake; R.dmgNumOn = settings.dmgNum;
  if (R.lowSpec !== settings.lowSpec) { R.lowSpec = settings.lowSpec; R.resize(); }
  document.documentElement.style.setProperty('--btn', settings.btnSize);
}
function codexAdd(slot, idx) {
  if (!codex[slot].includes(idx)) { codex[slot].push(idx); store.set('codex', codex); return true; }
  return false;
}

// ── 화면 전환 ──
const SCREENS = ['scrTitle', 'scrSetup', 'scrJoin', 'scrLobby', 'scrCodex', 'scrStats', 'scrSettings', 'scrHelp'];
let curScreen = 'scrTitle', returnTo = 'scrTitle';
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  curScreen = id;
  if (id === 'scrCodex') renderCodex();
  if (id === 'scrStats') renderStats();
  if (id === 'scrSettings') syncSettingsUI();
}
function hideScreens() { for (const s of SCREENS) $(s).classList.add('hidden'); curScreen = null; }
let toastT = 0;
function toast(text, ms = 2600) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms); }

// ── 타이틀 커스터마이즈 ──
const pv = $('preview'), pvx = pv.getContext('2d'); pvx.imageSmoothingEnabled = false;
function buildTitle() {
  $('nick').value = profile.name;
  const sw = $('swatches'); sw.innerHTML = '';
  for (const c of SLIME_COLORS) {
    const b = document.createElement('button'); b.style.background = c; b.className = c === profile.color ? 'on' : '';
    b.onclick = () => { profile.color = c; saveProfile(); buildTitle(); sfx('click'); };
    sw.appendChild(b);
  }
  $('faceName').textContent = FACES[profile.face]; $('hatName').textContent = HATS[profile.hat];
}
document.querySelectorAll('[data-cyc]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.cyc, n = k === 'face' ? FACES.length : HATS.length;
  profile[k] = (profile[k] + (+b.dataset.d) + n) % n; saveProfile(); buildTitle(); sfx('click');
}));
$('nick').addEventListener('input', () => { profile.name = $('nick').value.trim().slice(0, 10) || '슬라임'; saveProfile(); });
let pvT = 0;
function drawPreview(dt) {
  pvT += dt;
  pvx.clearRect(0, 0, 150, 130);
  const s = 6, sq = Math.sin(pvT * 5) * 0.06, hop = Math.abs(Math.sin(pvT * 2.5)) * 3;
  pvx.fillStyle = 'rgba(0,0,0,.3)'; pvx.fillRect(75 - 40, 118, 80, 6);
  pvx.save(); pvx.translate(75, 120 - hop * s * 0.5); pvx.scale(s * (1 + sq), s * (1 - sq));
  pvx.drawImage(slimeSprite(profile.color), -8, -14);
  drawFace(pvx, profile.face, 0, -7, Math.sin(pvT * 0.7), 0, (pvT % 3.5) < 0.12, pvT);
  if (profile.hat) drawHat(pvx, profile.hat, 0, -13);
  pvx.restore();
}
(function bgfx() { const b = $('bgfx'); for (let i = 0; i < 26; i++) { const e = document.createElement('i'); e.style.left = Math.random() * 100 + '%'; e.style.animationDuration = 6 + Math.random() * 10 + 's'; e.style.animationDelay = -Math.random() * 16 + 's'; e.style.background = ['#3a2f6e', '#4a2f5e', '#2f4a6e', '#5e4a2f'][i % 4]; const s = 4 + Math.random() * 8; e.style.width = e.style.height = s + 'px'; b.appendChild(e); } })();

// ── 세그먼트 버튼 ──
function bindSeg(root, attr, get, set) {
  root.querySelectorAll(`[${attr}]`).forEach((seg) => {
    const key = seg.getAttribute(attr);
    seg.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => { if (seg.getAttribute('aria-disabled') === 'true') return; set(key, b.dataset.v); sfx('click'); sync(); });
    });
    seg._sync = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(get(key)) === b.dataset.v));
  });
  const sync = () => root.querySelectorAll(`[${attr}]`).forEach((s) => s._sync());
  sync(); return sync;
}
function mapButtons(sel) {
  const seg = document.querySelector(sel);
  seg.innerHTML = '<button data-v="random">랜덤</button>' + MAP_LIST.map((m) => `<button data-v="${m.id}" title="${escapeHtml(m.desc)}">${escapeHtml(m.name)}</button>`).join('');
}
mapButtons('#scrSetup [data-key="mapId"]'); mapButtons('#scrLobby [data-lkey="mapId"]');
const numKeys = ['bots', 'botDiff', 'timeLimit', 'killLimit'];
const syncSetup = bindSeg($('scrSetup'), 'data-key', (k) => offlineCfg[k], (k, v) => { offlineCfg[k] = numKeys.includes(k) ? +v : v; store.set('offlineCfg', offlineCfg); });
let lobbySettingsCache = {};
const syncLobby = bindSeg($('scrLobby'), 'data-lkey', (k) => lobbySettingsCache[k], (k, v) => {
  if (!S || S.kind !== 'host') return;
  const val = numKeys.includes(k) ? +v : k === 'ff' ? v === 'true' : v;
  S.setSettings({ [k]: val });
});
const syncSettingsUI = (() => {
  const s = bindSeg($('scrSettings'), 'data-skey', (k) => settings[k], (k, v) => { settings[k] = k === 'btnSize' ? +v : v === 'true'; saveSettings(); applySettings(); });
  return () => { $('setSfx').value = settings.sfx; $('setMusic').value = settings.music; s(); };
})();
$('setSfx').addEventListener('input', (e) => { settings.sfx = +e.target.value; saveSettings(); applySettings(); });
$('setSfx').addEventListener('change', () => sfx('pickup'));
$('setMusic').addEventListener('input', (e) => { settings.music = +e.target.value; saveSettings(); applySettings(); });

// ── 메뉴 버튼 ──
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
  sfx('click');
  const g = b.dataset.go;
  if (g === 'title') show('scrTitle');
  else if (g === 'setup') { show('scrSetup'); syncSetup(); }
  else if (g === 'join') { show('scrJoin'); setTimeout(() => $('joinCode').focus(), 50); }
  else if (g === 'host') hostRoom();
  else if (g === 'range') startOffline({ mode: 'range', mapId: 'factory', bots: 0, botDiff: 0, timeLimit: 0, killLimit: 0 });
  else if (g === 'codex') show('scrCodex');
  else if (g === 'stats') show('scrStats');
  else if (g === 'settings') { returnTo = 'scrTitle'; show('scrSettings'); }
  else if (g === 'help') { returnTo = 'scrTitle'; show('scrHelp'); }
}));
$('settingsBack').onclick = () => { sfx('click'); if (returnTo === 'pause') { hideScreens(); $('scrPause').classList.remove('hidden'); } else show(returnTo); };
$('helpBack').onclick = () => { sfx('click'); store.set('seenHelp', true); if (returnTo === 'pause') { hideScreens(); $('scrPause').classList.remove('hidden'); } else if (returnTo === 'start') { hideScreens(); pendingStart && pendingStart(); } else show(returnTo); };
$('startOffline').onclick = () => { sfx('click'); startOffline(Object.assign({}, offlineCfg)); };
$('joinBtn').onclick = () => joinRoom($('joinCode').value.trim().toUpperCase());
$('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });

// ── 세션 ──
let S = null, inMatch = false, paused = false;
const presenter = new Presenter(R, {
  killfeed: (k, v, slot, idx) => {
    hud.killfeed(k, v, slot, idx, S.myId);
    if (k && k.id === S.myId && v.id !== S.myId) { const key = slot + idx; stats.wk[key] = (stats.wk[key] || 0) + 1; }
  },
  announce: (t, c, big, small) => hud.announce(t, c, big, small),
  died: (k, slot, idx) => { hud.death(k, slot, idx); pendingRou = { t: performance.now() + 1000, title: '다음 장비 룰렛!' }; deathAt = performance.now(); },
  loot: (slot, idx) => { hud.lootPop(slot, idx); codexAdd(slot, idx); stats.loots++; },
  event: (ev) => hud.announce(`⚡ ${ev.name}! ${ev.desc}`, ev.color, 1),
  eventEnd: (ev) => hud.announce(`${ev.name} 종료`, '#a9a3c9', 0, true),
  go: () => { hud.bigText('GO!', '#5ee07a'); sfx('go', 0.8); },
  end: (info) => onMatchEnd(info),
  chat: (p, text) => { if (!p) return; hud.chat(p.name, p.color, text); R.bubble(p.id, text.length > 16 ? text.slice(0, 15) + '…' : text); sfx('chat', 0.6); },
  system: (t) => hud.chat(null, null, t, true),
});
let pendingRou = null, deathAt = 0, wasAlive = false, lastCount = -1, lastShake = 0, pendingStart = null;

const app = {
  lobbyUpdate(m) { renderLobby(m); },
  lobbyChat(m) { const box = $('lobbyChat'); const d = document.createElement('div'); d.innerHTML = `<span style="color:${escapeHtml(m.color || '#fff')}">${escapeHtml(m.name || '?')}</span>: ${escapeHtml(m.text)}`; box.appendChild(d); box.scrollTop = 1e9; while (box.children.length > 60) box.removeChild(box.firstChild); if (inMatch) hud.chat(m.name, m.color, m.text); },
  system(text) { if (inMatch) hud.chat(null, null, text, true); else { const box = $('lobbyChat'); const d = document.createElement('div'); d.style.color = '#ffd23f'; d.textContent = text; box.appendChild(d); box.scrollTop = 1e9; } },
  startMatch(sess) { beginMatch(sess); },
  toLobby() { endMatchUI(); show('scrLobby'); playMusic('menu'); },
  disconnected(reason) { if (!S) return; toast(reason, 3500); exitToTitle(true); },
};

function profileInfo() { return { name: profile.name || '슬라임', color: profile.color, face: profile.face, hat: profile.hat }; }

function startOffline(cfg) {
  const go = () => {
    leaveSession();
    S = new OfflineSession(app, cfg, profileInfo());
    beginMatch(S);
  };
  if (!store.get('seenHelp', false) && cfg.mode !== 'range') { pendingStart = go; returnTo = 'start'; show('scrHelp'); return; }
  go();
}

async function hostRoom() {
  leaveSession();
  const h = new HostSession(app, profileInfo());
  S = h;
  $('lobbyChat').innerHTML = '';
  show('scrLobby'); $('roomCode').textContent = '·····'; $('lobbyStatus').textContent = '방을 만드는 중…';
  renderLobby(h.lobbyMsg());
  try {
    await h.open();
    if (S !== h) { h.leave(); return; }
    renderLobby(h.lobbyMsg());
    $('lobbyStatus').textContent = '친구에게 코드를 알려 주세요!';
  } catch (e) {
    if (S === h) { S = null; toast(errText(e), 4000); show('scrTitle'); }
  }
}
async function joinRoom(code) {
  if (!/^[A-Z0-9]{5}$/.test(code)) { toast('5자리 방 코드를 입력해 주세요.'); return; }
  leaveSession();
  const c = new ClientSession(app, profileInfo());
  S = c;
  $('joinBtn').disabled = true; $('joinBtn').textContent = '연결 중…';
  try {
    await c.join(code);
    $('lobbyChat').innerHTML = '';
    show('scrLobby'); $('lobbyStatus').textContent = '방장이 시작하기를 기다리는 중…';
  } catch (e) {
    if (S === c) { S = null; toast(errText(e), 4000); }
  }
  $('joinBtn').disabled = false; $('joinBtn').textContent = '참가';
}

function renderLobby(m) {
  if (!S) return;
  const isHost = S.kind === 'host';
  $('roomCode').textContent = m.code || '·····';
  const pl = $('plist'); pl.innerHTML = '';
  for (const p of m.players) {
    const d = document.createElement('div'); d.className = 'p';
    d.innerHTML = `<img src="${slimeURL(p.color, p.face, p.hat)}"><span>${escapeHtml(p.name)}</span>${p.host ? ' 👑' : ''}${p.id === S.myId ? ' <span class="mute">(나)</span>' : ''}<span class="tag">${p.host ? '방장' : (p.ping ? p.ping + 'ms' : '')}</span>`;
    if (isHost && !p.host) { const k = document.createElement('button'); k.className = 'btn s r'; k.textContent = '추방'; k.style.marginLeft = '6px'; k.onclick = () => S.kickPlayer(p.id); d.appendChild(k); }
    pl.appendChild(d);
  }
  $('pCount').textContent = `${m.players.length}/8`;
  lobbySettingsCache = m.settings;
  document.querySelectorAll('#scrLobby .seg').forEach((s) => s.setAttribute('aria-disabled', isHost ? 'false' : 'true'));
  $('hostOnly').textContent = isHost ? '' : '(방장만 변경 가능)';
  $('startOnline').classList.toggle('hidden', !isHost);
  $('startOnline').disabled = !m.code;
  if (!isHost) $('lobbyStatus').textContent = m.inMatch ? '경기 진행 중… 곧 합류해요!' : '방장이 시작하기를 기다리는 중…';
  syncLobby();
}
$('copyCode').onclick = () => { const c = $('roomCode').textContent; navigator.clipboard?.writeText(c).then(() => toast('코드를 복사했어요: ' + c), () => toast('코드: ' + c)); };
$('copyLink').onclick = () => { const c = $('roomCode').textContent; const u = location.origin + location.pathname + '?room=' + c; navigator.clipboard?.writeText(u).then(() => toast('초대 링크를 복사했어요!'), () => toast(u, 5000)); };
$('startOnline').onclick = () => { if (S && S.kind === 'host') { sfx('click'); S.start(); } };
$('leaveLobby').onclick = () => { sfx('click'); exitToTitle(); };
const sendLobbyChat = () => { const v = $('lobbyChatIn').value.trim(); if (v && S) S.sendChat(v); $('lobbyChatIn').value = ''; };
$('lobbyChatSend').onclick = sendLobbyChat;
$('lobbyChatIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendLobbyChat(); });

function leaveSession() { if (S) { try { S.leave(); } catch (e) { /* 무시 */ } } S = null; inMatch = false; }
function exitToTitle(silent) {
  leaveSession(); endMatchUI(); show('scrTitle'); playMusic('menu');
  if (!silent) sfx('click');
}

// ── 경기 시작/종료 ──
function beginMatch(sess) {
  S = sess; inMatch = true; paused = false;
  const W = sess.world;
  R.setMap(W.map); R.resize(); hud.setMap(W.map);
  presenter.setWorld(W, sess.myId, sess.kind === 'client');
  hideScreens(); $('scrResult').classList.add('hidden'); $('scrPause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  document.body.classList.add('ingame'); canvas.classList.toggle('play', !mobile);
  $('touch').classList.toggle('hidden', !mobile);
  $('btnChat').classList.toggle('hidden', sess.kind === 'offline' && !mobile);
  hud.hideDeath(); hud.hideRoulette();
  clearInput(); input.enabled = true;
  pendingRou = sess.settings.mode === 'range' ? null : { t: performance.now() + 150, title: '장비 룰렛!' };
  wasAlive = false; lastCount = -1; camSnap = true;
  playMusic(Math.random() < 0.5 ? 'battle' : 'battle2');
  if (sess.settings.mode === 'range') buildRangePanel(); else $('rangePanel').classList.add('hidden');
  ['p', 'm', 's', 't'].forEach((k) => { const me = W.byId.get(sess.myId); if (me && sess.settings.mode === 'range') codexAdd(k, me.lo[k]); });
}
function endMatchUI() {
  inMatch = false; input.enabled = false; clearInput();
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('rangePanel').classList.add('hidden');
  $('scrResult').classList.add('hidden'); $('scrPause').classList.add('hidden'); $('scoreboard').classList.add('hidden');
  hud.hideRoulette(); $('lootPop').classList.add('hidden');
  document.body.classList.remove('ingame'); canvas.classList.remove('play');
  closeChat(); clearTimeout(lobbyTimer);
}
let lobbyTimer = 0;
function onMatchEnd(info) {
  input.enabled = false; clearInput(); closeChat();
  hud.hideRoulette(); $('scoreboard').classList.add('hidden');
  const isHost = S.kind === 'host', isClient = S.kind === 'client';
  setTimeout(() => {
    if (!S || !inMatch) return;
    const r = hud.results(info, S.myId, {
      again: !isClient, againText: isHost ? '대기실로' : '다시 하기',
      note: isHost ? '15초 후 자동으로 대기실로 돌아가요' : isClient ? '방장이 다음 판을 준비 중이에요…' : '',
    });
    playMusic('result');
    stats.matches++; if (r.win) stats.wins++;
    if (r.mine) { stats.kills += r.mine.kills; stats.deaths += r.mine.deaths; stats.dmg += r.mine.dmg; stats.best = Math.max(stats.best, r.mine.best); }
    store.set('stats', stats);
    if (isHost) { clearTimeout(lobbyTimer); lobbyTimer = setTimeout(() => { if (S && S.kind === 'host' && inMatch) { S.backToLobby(); app.toLobby(); } }, 15000); }
  }, 1200);
  hud.bigText('경기 종료!', '#ffd23f');
}
$('resAgain').onclick = () => {
  sfx('click');
  if (S && S.kind === 'host') { clearTimeout(lobbyTimer); S.backToLobby(); app.toLobby(); }
  else if (S && S.kind === 'offline') startOffline(S.cfg);
};
$('resMenu').onclick = () => exitToTitle();

// ── 일시정지 메뉴 ──
function openPause() { if (!inMatch) return; $('scrPause').classList.remove('hidden'); paused = S.kind === 'offline'; clearInput(); input.enabled = false; }
function closePause() { $('scrPause').classList.add('hidden'); paused = false; if (inMatch && $('scrResult').classList.contains('hidden') && !chatOpen) input.enabled = true; }
$('btnMenu').onclick = () => { sfx('click'); openPause(); };
$('resume').onclick = () => { sfx('click'); closePause(); };
$('pauseHelp').onclick = () => { sfx('click'); $('scrPause').classList.add('hidden'); returnTo = 'pause'; show('scrHelp'); };
$('pauseSettings').onclick = () => { sfx('click'); $('scrPause').classList.add('hidden'); returnTo = 'pause'; show('scrSettings'); };
$('quit').onclick = () => { if (S && S.kind === 'client') exitToTitle(); else if (S && S.kind === 'host') { if (confirm('방장이 나가면 방이 닫혀요. 나갈까요?')) exitToTitle(); } else exitToTitle(); };

// ── 채팅 ──
let chatOpen = false, quickOpen = false;
function openChat() { if (!inMatch || chatOpen) return; chatOpen = true; input.enabled = false; clearInput(); $('chatInputWrap').classList.remove('hidden'); if (mobile) openQuick(); $('chatIn').focus(); }
function closeChat() { chatOpen = false; $('chatInputWrap').classList.add('hidden'); $('chatIn').value = ''; $('chatIn').blur(); closeQuick(); if (inMatch && $('scrPause').classList.contains('hidden') && $('scrResult').classList.contains('hidden')) input.enabled = true; }
function sendChat(text) { text = (text || '').trim(); if (text && S) S.sendChat(text); }
function openQuick() {
  quickOpen = true; const q = $('quick'); q.innerHTML = '';
  QUICK_CHAT.forEach((t, i) => { const b = document.createElement('button'); b.className = 'btn s'; b.textContent = `${mobile ? '' : (i + 1) + '. '}${t}`; b.onclick = () => { sendChat(t); closeChat(); }; q.appendChild(b); });
  q.classList.remove('hidden');
}
function closeQuick() { quickOpen = false; $('quick').classList.add('hidden'); }
$('chatSend').onclick = () => { sendChat($('chatIn').value); closeChat(); };
$('btnChat').onclick = () => { sfx('click'); chatOpen ? closeChat() : openChat(); };
let boardHeld = false, boardToggle = false;
$('btnBoard').onclick = () => { sfx('click'); boardToggle = !boardToggle; };

input.onKey = (e, inField, isUp) => {
  if (isUp) { if (e.code === 'Tab') boardHeld = false; return; }
  if (inField) {
    if (e.target.id === 'chatIn') { if (e.key === 'Enter') { sendChat(e.target.value); closeChat(); e.preventDefault(); } else if (e.key === 'Escape') closeChat(); }
    return;
  }
  if (!inMatch) return false;
  if (e.code === 'Tab') { boardHeld = true; return true; }
  if (e.key === 'Enter' && !chatOpen && $('scrResult').classList.contains('hidden')) { openChat(); return true; }
  if (e.key === 'Escape') { if (chatOpen) closeChat(); else if (quickOpen) closeQuick(); else if (!$('scrPause').classList.contains('hidden')) closePause(); else openPause(); return true; }
  if (e.code === 'KeyV' && input.enabled) { quickOpen ? closeQuick() : openQuick(); return true; }
  if (quickOpen && /^Digit[1-8]$/.test(e.code)) { sendChat(QUICK_CHAT[+e.code.slice(5) - 1]); closeQuick(); return true; }
  return false;
};

// ── 연습장 패널 ──
let rangeTab = 'p';
function buildRangePanel() {
  const el = $('rangePanel'); el.classList.remove('hidden');
  const me = S.world.byId.get(S.myId);
  el.innerHTML = `<div class="tabs">${SLOTS.map((s) => `<button class="btn s ${s.key === rangeTab ? 'y' : ''}" data-rt="${s.key}">${s.name}</button>`).join('')}</div><div class="grid scroll" style="flex:1"></div>`;
  const grid = el.querySelector('.grid');
  const slot = SLOTS.find((s) => s.key === rangeTab);
  slot.list.forEach((it, i) => {
    const c = document.createElement('div'); c.className = 'cell' + (me && me.lo[rangeTab] === i ? ' on' : ''); c.style.setProperty('--rc', RARITY[it.r].color); c.title = it.name;
    c.innerHTML = `<img src="${iconURL(it.id)}">`;
    c.onclick = () => { S.setSlot(rangeTab, i); codexAdd(rangeTab, i); sfx('lock'); hud.announce(`${it.name} 장착`, RARITY[it.r].color, 0, true); buildRangePanel(); };
    grid.appendChild(c);
  });
  el.querySelectorAll('[data-rt]').forEach((b) => b.onclick = () => { rangeTab = b.dataset.rt; sfx('click'); buildRangePanel(); });
}

// ── 도감/전적 ──
let codexTab = 'p', codexSel = 0;
function renderCodex() {
  const total = SLOTS.reduce((a, s) => a + s.list.length, 0), found = SLOTS.reduce((a, s) => a + codex[s.key].length, 0);
  $('codexProg').textContent = `발견 ${found} / ${total}`;
  $('codexTabs').innerHTML = SLOTS.map((s) => `<button class="btn s ${s.key === codexTab ? 'y' : ''}" data-ct="${s.key}">${s.name} ${codex[s.key].length}/${s.list.length}</button>`).join('');
  $('codexTabs').querySelectorAll('[data-ct]').forEach((b) => b.onclick = () => { codexTab = b.dataset.ct; codexSel = 0; sfx('click'); renderCodex(); });
  const slot = SLOTS.find((s) => s.key === codexTab), grid = $('codexGrid'); grid.innerHTML = '';
  slot.list.forEach((it, i) => {
    const got = codex[codexTab].includes(i);
    const c = document.createElement('div'); c.className = 'cell' + (got ? '' : ' lock') + (i === codexSel ? ' sel' : ''); c.style.setProperty('--rc', got ? RARITY[it.r].color : '#3a3448');
    c.innerHTML = `<img src="${iconURL(it.id)}">`;
    c.onclick = () => { codexSel = i; sfx('click'); renderCodex(); };
    grid.appendChild(c);
  });
  const it = slot.list[codexSel], got = codex[codexTab].includes(codexSel);
  let st = '';
  if (got) {
    if (codexTab === 'p') { const b = it.b; st = `<span>피해 ${b.dmg || '폭발'}${b.count ? ' ×' + b.count : ''}</span><span>연사 ${it.rate}/초</span><span>탄창 ${it.mag}</span><span>재장전 ${it.reload}초</span>${b.boom ? `<span>폭발 ${b.boom}</span>` : ''}`; }
    else if (codexTab === 'm') st = `<span>피해 ${it.dmg}</span><span>쿨다운 ${it.cd}초</span><span>사거리 ${it.range}</span><span>넉백 ${it.knock}</span>`;
    else if (codexTab === 's') st = `<span>쿨다운 ${it.cd}초</span>`;
    else st = `<span>끝까지 추면 체력 +10</span>`;
  }
  const kills = stats.wk[codexTab + codexSel] || 0;
  $('codexDetail').innerHTML = got
    ? `<img src="${iconURL(it.id)}"><div><div class="nm" style="color:${RARITY[it.r].color}">${escapeHtml(it.name)}<span class="rtag" style="background:${RARITY[it.r].color}">${RARITY[it.r].name}</span></div><div class="ds">${escapeHtml(it.desc)}</div><div class="stats">${st}${codexTab !== 't' ? `<span>내 처치 ${kills}</span>` : ''}</div></div>`
    : `<img src="${iconURL(it.id)}" style="filter:brightness(0) invert(.32)"><div><div class="nm">???</div><div class="ds">룰렛에서 뽑거나 연습장에서 장착하면 기록돼요.<br>등급: <span style="color:${RARITY[it.r].color}">${RARITY[it.r].name}</span></div></div>`;
}
function renderStats() {
  let fav = null, fv = 0; for (const k in stats.wk) if (stats.wk[k] > fv) { fv = stats.wk[k]; fav = k; }
  const favIt = fav ? itemOf(fav[0], +fav.slice(1)) : null;
  const kd = stats.deaths ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
  const found = SLOTS.reduce((a, s) => a + codex[s.key].length, 0), total = SLOTS.reduce((a, s) => a + s.list.length, 0);
  const cells = [['경기 수', stats.matches], ['승리', stats.wins], ['승률', stats.matches ? Math.round(stats.wins / stats.matches * 100) + '%' : '-'], ['총 처치', stats.kills], ['총 죽음', stats.deaths], ['K/D', kd], ['총 피해량', stats.dmg], ['최고 연속 처치', stats.best], ['전설 뽑기', stats.legend], ['보급품 획득', stats.loots], ['도감', `${found}/${total}`], ['애용 장비', favIt ? `<img src="${iconURL(favIt.id)}" style="width:22px;vertical-align:middle"> ${escapeHtml(favIt.name)}` : '-']];
  $('statGrid').innerHTML = cells.map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('');
}
$('resetStats').onclick = () => { if (confirm('전적을 초기화할까요? (도감은 유지돼요)')) { Object.assign(stats, { matches: 0, wins: 0, kills: 0, deaths: 0, dmg: 0, best: 0, legend: 0, loots: 0, wk: {} }); store.set('stats', stats); renderStats(); } };

// ── 전체화면 ──
$('fsBtn').onclick = async () => {
  sfx('click');
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) { await (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { toast('이 기기는 전체화면을 지원하지 않아요. 공유 → 홈 화면에 추가로 앱처럼 실행해 보세요!', 4000); return; }
    await req.call(el, { navigationUI: 'hide' });
    if (window.screen && window.screen.orientation && window.screen.orientation.lock) window.screen.orientation.lock('landscape').catch(() => {});
  } catch (e) { toast('전체화면을 열 수 없어요.'); }
};

// ── 입력 → 조준 ──
let camSnap = true, lastAim = 0, fpsAcc = 0, fpsN = 0, fpsV = 60;
function computeAim(W, me) {
  if (!me || !me.alive) return lastAim;
  if (mobile) {
    if (input.atk.aiming) return input.atk.ang;
    if (input.skl.aiming) return input.skl.ang;
    if (input.aimHold && performance.now() < input.aimHold.until) return input.aimHold.ang;
  }
  if (!mobile && input.usedMouse) {
    const wpt = R.screenToWorld(input.mouseX * R.dpr, input.mouseY * R.dpr);
    return Math.atan2(wpt.y - me.y, wpt.x - me.x);
  }
  if (settings.aimAssist) {
    const w = PRIMARY[me.lo.p];
    const range = Math.min(300, (w.b.hitscan ? w.b.range : w.b.spd * w.b.life) * 1.15);
    let best = null, bd = range * range;
    const consider = (t, isDecoy) => {
      const d = dist2(me.x, me.y, t.x, t.y); if (d >= bd) return;
      if (!isDecoy && W.smokeAt(t.x, t.y) && d > 900) return;
      if (!lineOfSight(W.map, me.x, me.y, t.x, t.y)) return;
      bd = d; best = t;
    };
    for (const p of W.players) if (p.alive && p !== me && !(W.mode === 'tdm' && p.team === me.team)) consider(p, false);
    for (const o of W.objs) if (o.k === 'decoy' && o.owner !== me.id && !(W.mode === 'tdm' && o.team === me.team)) consider(o, true);
    if (best) {
      const spd = w.b.hitscan ? 1e9 : w.b.spd, t = Math.sqrt(bd) / spd * 0.6;
      return Math.atan2(best.y + (best.vy || 0) * t - me.y, best.x + (best.vx || 0) * t - me.x);
    }
  }
  if (Math.hypot(input.mx, input.my) > 0.2) return Math.atan2(input.my, input.mx);
  return lastAim;
}

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (curScreen === 'scrTitle') drawPreview(dt);
  if (S && inMatch && S.world) {
    const W = S.world, me = W.byId.get(S.myId);
    const aim = computeAim(W, me); lastAim = aim;
    const act = input.enabled && !paused;
    const autoW = me && PRIMARY[me.lo.p].auto;
    const touchFire = mobile && ((input.atk.aiming && autoW) || now < input.tapFireUntil);
    S.setInput({ mx: act ? input.mx : 0, my: act ? input.my : 0, aim, fire: act && (input.fire || touchFire), fireN: input.fireN, meleeN: input.meleeN, skillN: input.skillN, tauntN: input.tauntN, reloadN: input.reloadN });
    if (!paused) S.tick(dt, presenter);
    if (!inMatch || !S || !S.world) { requestAnimationFrame(frame); return; }
    // 카운트다운
    if (W.state === 'count') { const c = Math.ceil(W.countT); if (c !== lastCount && c > 0 && c <= 3) { lastCount = c; hud.bigText(String(c)); sfx('beep', 0.7); } }
    // 부활 처리
    if (me) {
      if (me.alive && !wasAlive) { hud.hideDeath(); if (hud.rouActive && performance.now() - deathAt > 500) hud.hideRoulette(); camSnap = true; }
      wasAlive = me.alive;
      if (pendingRou && now >= pendingRou.t && (S.kind !== 'client' || W.snaps.length)) {
        const lo = { ...me.lo }, title = pendingRou.title; pendingRou = null;
        hud.roulette(lo, title, () => { for (const k of ['p', 'm', 's', 't']) { const it = itemOf(k, lo[k]); if (codexAdd(k, lo[k]) && inMatch) hud.announce(`📖 도감 등록: ${it.name}`, RARITY[it.r].color, 0, true); if (it.r === 3) stats.legend++; } store.set('stats', stats); });
      }
    }
    hud.updateRoulette(dt);
    // 카메라
    let tx, ty;
    const killer = me && !me.alive && me.killedBy >= 0 ? W.byId.get(me.killedBy) : null;
    if (me && me.alive) {
      tx = me.x; ty = me.y;
      if (!mobile && input.usedMouse) { const wp = R.screenToWorld(input.mouseX * R.dpr, input.mouseY * R.dpr); let ox = (wp.x - me.x) * 0.22, oy = (wp.y - me.y) * 0.22; const l = Math.hypot(ox, oy); if (l > 55) { ox *= 55 / l; oy *= 55 / l; } tx += ox; ty += oy; }
      else { tx += Math.cos(aim) * 16; ty += Math.sin(aim) * 16; }
    } else if (killer && killer.alive) { tx = killer.x; ty = killer.y; }
    else if (me) { tx = me.x; ty = me.y; }
    else { tx = W.map.pw / 2; ty = W.map.ph / 2; }
    R.updateCamera(tx, ty, dt, camSnap); camSnap = false;
    const ri = hud.reloadInfo || { reloading: false, rp: 1 };
    let aimLine = null;
    if (mobile && me && me.alive && (input.atk.aiming || input.skl.aiming)) {
      const isSk = !input.atk.aiming, w = PRIMARY[me.lo.p], sk = SKILL[me.lo.s].id;
      const len = isSk ? ({ blink: 90, strike: 140, dash: 70, turret: 14, banana: 18 }[sk] || 40) : Math.min(260, w.b.hitscan ? w.b.range : w.b.spd * w.b.life);
      aimLine = { ang: aim, len, skill: isSk, spread: isSk ? 0 : (w.b.count ? w.b.spread : 0), circle: isSk && (sk === 'strike' || sk === 'blink') };
    }
    R.render(W, me, dt, { aimLine, event: W.event?.id, crosshair: !mobile && input.usedMouse ? { x: input.mouseX, y: input.mouseY } : null, reloading: ri.reloading, reloadPct: ri.rp });
    hud.update(S, W, me, dt, mobile);
    hud.minimap(W, me, dt, presenter.lastShot);
    hud.scoreboard(W, me, S, (boardHeld || boardToggle) && $('scrResult').classList.contains('hidden'));
    // 핑/FPS
    fpsAcc += dt; fpsN++; if (fpsAcc >= 0.5) { fpsV = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const pt = (S.kind === 'client' ? `핑 ${S.ping}ms` : S.kind === 'host' ? `방 ${S.code}` : '') + (settings.fps ? ` · ${fpsV}FPS` : '');
    if ($('ping')._t !== pt) { $('ping')._t = pt; $('ping').textContent = pt; }
  }
  requestAnimationFrame(frame);
}

// ── 시작 ──
function boot() {
  initInput(canvas);
  initTouch($('touch'));
  R.resize();
  window.addEventListener('resize', () => { R.resize(); camSnap = true; });
  applySettings(); buildTitle();
  const unlock = () => { initAudio(); applySettings(); if (!inMatch) playMusic('menu'); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
  window.addEventListener('beforeunload', () => leaveSession());
  window.__rrStop = () => leaveSession();
  const room = new URLSearchParams(location.search).get('room');
  if (room && /^[A-Za-z0-9]{5}$/.test(room)) { show('scrJoin'); $('joinCode').value = room.toUpperCase(); toast('초대받은 방이에요! 닉네임을 확인하고 참가를 눌러 주세요.'); }
  else show('scrTitle');
  const done = () => { $('loading').classList.add('hidden'); };
  if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('12px Galmuri11'), new Promise((r) => setTimeout(r, 2500))]).then(done, done); else done();
  requestAnimationFrame(frame);
}
boot();
