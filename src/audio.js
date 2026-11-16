// WebAudio로 직접 합성하는 칩튠 효과음/BGM (외부 음원 없음)
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let sfxVol = 0.7, musicVol = 0.45;
const lastPlay = new Map();

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicVol; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolumes(s, m) {
  sfxVol = s; musicVol = m;
  if (sfxBus) sfxBus.gain.value = s;
  if (musicBus) musicBus.gain.value = m;
}

function env(g, t, a, d, v) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function osc(type, f0, f1, t, dur, vol, pan, bus) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  env(g, t, 0.004, dur, vol);
  let node = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
  o.connect(g); node.connect(bus || sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, vol, ftype, f0, f1, pan, bus, q) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  if (q) f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.003, dur, vol);
  s.connect(f); f.connect(g);
  let node = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
  node.connect(bus || sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

// name, vol(0~1, 거리감쇠 포함), pan(-1~1)
export function sfx(name, vol = 1, pan = 0) {
  if (!ctx || vol < 0.03) return;
  const now = ctx.currentTime;
  const lp = lastPlay.get(name) || 0;
  if (now - lp < 0.035) return;
  lastPlay.set(name, now);
  const t = now + 0.005, v = vol;
  switch (name) {
    case 'pea': osc('square', 900, 300, t, 0.06, 0.18 * v, pan); noise(t, 0.04, 0.12 * v, 'highpass', 2000, 0, pan); break;
    case 'smg': osc('square', 700, 250, t, 0.045, 0.12 * v, pan); noise(t, 0.03, 0.1 * v, 'highpass', 2500, 0, pan); break;
    case 'shotgun': noise(t, 0.22, 0.5 * v, 'lowpass', 3000, 300, pan); osc('square', 180, 60, t, 0.15, 0.25 * v, pan); break;
    case 'bread': osc('triangle', 600, 200, t, 0.07, 0.25 * v, pan); noise(t, 0.05, 0.12 * v, 'bandpass', 1500, 0, pan); break;
    case 'rev': noise(t, 0.16, 0.35 * v, 'lowpass', 5000, 600, pan); osc('square', 300, 80, t, 0.12, 0.2 * v, pan); break;
    case 'duckshot': osc('sawtooth', 500, 900, t, 0.08, 0.12 * v, pan); osc('square', 150, 100, t, 0.1, 0.15 * v, pan); break;
    case 'quack': osc('sawtooth', 420, 300, t, 0.09, 0.18 * v, pan); osc('square', 640, 380, t + 0.01, 0.07, 0.07 * v, pan); break;
    case 'bubble': osc('sine', 500, 1100, t, 0.07, 0.15 * v, pan); break;
    case 'pop': osc('sine', 1200, 300, t, 0.05, 0.16 * v, pan); break;
    case 'snipe': noise(t, 0.35, 0.5 * v, 'lowpass', 6000, 400, pan); osc('square', 1200, 90, t, 0.25, 0.22 * v, pan); break;
    case 'ice': osc('triangle', 1800, 1200, t, 0.06, 0.12 * v, pan); osc('sine', 2600, 2200, t, 0.05, 0.06 * v, pan); break;
    case 'flame': noise(t, 0.08, 0.13 * v, 'bandpass', 900, 500, pan, null, 0.8); break;
    case 'disc': osc('triangle', 400, 1000, t, 0.12, 0.18 * v, pan); break;
    case 'laser': osc('sawtooth', 1600, 200, t, 0.22, 0.2 * v, pan); osc('square', 2400, 400, t, 0.18, 0.08 * v, pan); break;
    case 'kernel': osc('square', 800, 500, t, 0.05, 0.12 * v, pan); break;
    case 'popcorn': osc('square', 1400, 900, t, 0.03, 0.12 * v, pan); noise(t, 0.03, 0.12 * v, 'highpass', 3000, 0, pan); break;
    case 'can': osc('sine', 200, 900, t, 0.2, 0.2 * v, pan); noise(t, 0.2, 0.15 * v, 'highpass', 4000, 0, pan); break;
    case 'vortex': osc('sawtooth', 60, 30, t, 1.2, 0.18 * v, pan); noise(t, 1.2, 0.2 * v, 'lowpass', 400, 150, pan); break;
    case 'bolt': noise(t, 0.25, 0.4 * v, 'bandpass', 3000, 800, pan, null, 2); osc('square', 1600, 200, t, 0.18, 0.15 * v, pan); osc('triangle', 330, 330, t, 0.25, 0.12 * v, pan); break;
    case 'explode': noise(t, 0.6, 0.8 * v, 'lowpass', 2200, 80, pan); osc('sine', 120, 35, t, 0.45, 0.5 * v, pan); break;
    case 'swing': noise(t, 0.12, 0.25 * v, 'bandpass', 800, 2400, pan, null, 1.2); break;
    case 'melee': osc('square', 220, 70, t, 0.1, 0.3 * v, pan); noise(t, 0.08, 0.35 * v, 'lowpass', 1800, 300, pan); break;
    case 'squeak': osc('square', 1300, 1900, t, 0.06, 0.15 * v, pan); osc('square', 1900, 1300, t + 0.06, 0.06, 0.15 * v, pan); break;
    case 'clang': osc('square', 900, 880, t, 0.25, 0.15 * v, pan); osc('triangle', 1350, 1340, t, 0.3, 0.12 * v, pan); break;
    case 'zap': noise(t, 0.12, 0.3 * v, 'highpass', 3000, 0, pan); osc('sawtooth', 900, 1500, t, 0.08, 0.1 * v, pan); break;
    case 'hit': osc('square', 520, 260, t, 0.05, 0.16 * v, pan); break;
    case 'hurt': osc('square', 300, 120, t, 0.12, 0.25 * v, pan); noise(t, 0.08, 0.2 * v, 'lowpass', 1500, 200, pan); break;
    case 'headpop': osc('sine', 300, 900, t, 0.08, 0.3 * v, pan); osc('square', 1200, 1800, t + 0.04, 0.05, 0.08 * v, pan); break;
    case 'death': noise(t, 0.35, 0.4 * v, 'lowpass', 1200, 100, pan); osc('sine', 500, 60, t, 0.35, 0.35 * v, pan); break;
    case 'kill': [0, 4, 7, 12].forEach((s, i) => osc('square', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), t + i * 0.05, 0.08, 0.13 * v, 0)); break;
    case 'multikill': [0, 4, 7, 12, 16, 19].forEach((s, i) => osc('square', 587 * Math.pow(2, s / 12), 587 * Math.pow(2, s / 12), t + i * 0.045, 0.09, 0.13 * v, 0)); break;
    case 'pickup': osc('square', 660, 660, t, 0.06, 0.15 * v, pan); osc('square', 990, 990, t + 0.06, 0.08, 0.15 * v, pan); break;
    case 'heal': [0, 4, 7].forEach((s, i) => osc('triangle', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), t + i * 0.06, 0.12, 0.2 * v, pan)); break;
    case 'tick': osc('square', 1500, 1500, t, 0.02, 0.07 * v, 0); break;
    case 'lock': osc('square', 880, 880, t, 0.05, 0.13 * v, 0); osc('square', 1320, 1320, t + 0.03, 0.06, 0.1 * v, 0); break;
    case 'rare': [0, 7, 12].forEach((s, i) => osc('square', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), t + i * 0.06, 0.12, 0.14 * v, 0)); break;
    case 'epic': [0, 4, 7, 11, 14].forEach((s, i) => osc('square', 587 * Math.pow(2, s / 12), 587 * Math.pow(2, s / 12), t + i * 0.06, 0.14, 0.14 * v, 0)); break;
    case 'legend':
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { const f = 523 * Math.pow(2, s / 12); osc('square', f, f, t + i * 0.07, 0.18, 0.13 * v, 0); osc('triangle', f / 2, f / 2, t + i * 0.07, 0.2, 0.12 * v, 0); });
      noise(t + 0.45, 0.6, 0.15 * v, 'highpass', 6000, 0, 0); break;
    case 'drop': osc('sine', 1200, 200, t, 0.8, 0.15 * v, pan); break;
    case 'land': noise(t, 0.3, 0.5 * v, 'lowpass', 800, 100, pan); osc('sine', 90, 40, t, 0.3, 0.4 * v, pan); break;
    case 'alarm': for (let i = 0; i < 3; i++) { osc('square', 880, 880, t + i * 0.22, 0.1, 0.12 * v, 0); osc('square', 660, 660, t + i * 0.22 + 0.11, 0.1, 0.12 * v, 0); } break;
    case 'beep': osc('square', 660, 660, t, 0.12, 0.15 * v, 0); break;
    case 'go': osc('square', 990, 990, t, 0.35, 0.16 * v, 0); osc('square', 1320, 1320, t, 0.35, 0.08 * v, 0); break;
    case 'charge': osc('sine', 300, 1400, t, 0.32, 0.12 * v, pan); osc('square', 600, 2400, t + 0.05, 0.25, 0.03 * v, pan); break;
    case 'click': osc('square', 1100, 1100, t, 0.025, 0.08 * v, 0); break;
    case 'slip': osc('sine', 300, 1500, t, 0.25, 0.2 * v, pan); break;
    case 'teleport': osc('sine', 300, 2400, t, 0.18, 0.2 * v, pan); osc('square', 2400, 300, t + 0.1, 0.12, 0.06 * v, pan); break;
    case 'dash': noise(t, 0.18, 0.3 * v, 'bandpass', 600, 2000, pan, null, 1); break;
    case 'block': osc('triangle', 800, 400, t, 0.08, 0.2 * v, pan); break;
    case 'reload': osc('square', 400, 400, t, 0.03, 0.08 * v, pan); osc('square', 600, 600, t + 0.09, 0.03, 0.08 * v, pan); break;
    case 'empty': osc('square', 200, 200, t, 0.03, 0.08 * v, pan); break;
    case 'deploy': osc('square', 300, 600, t, 0.12, 0.15 * v, pan); osc('square', 600, 900, t + 0.12, 0.1, 0.12 * v, pan); break;
    case 'grow': osc('square', 150, 600, t, 0.4, 0.18 * v, pan); break;
    case 'smoke': noise(t, 0.6, 0.3 * v, 'lowpass', 1200, 300, pan); break;
    case 'pigeon': for (let i = 0; i < 3; i++) osc('sine', 700 - i * 40, 500, t + i * 0.12, 0.1, 0.12 * v, pan); break;
    case 'chat': osc('sine', 1200, 1500, t, 0.05, 0.08 * v, 0); break;
    case 'win': [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => osc('square', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), t + i * 0.12, 0.16, 0.14 * v, 0)); break;
    case 'lose': [7, 4, 0, -5].forEach((s, i) => osc('triangle', 440 * Math.pow(2, s / 12), 440 * Math.pow(2, s / 12), t + i * 0.18, 0.2, 0.18 * v, 0)); break;
    case 'taunt': {
      const mel = [0, 4, 7, 9, 7, 4, 7, 12];
      mel.forEach((s, i) => osc('square', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), t + i * 0.13, 0.1, 0.09 * v, pan));
      [0, 0.26, 0.52, 0.78].forEach((d) => noise(t + d, 0.05, 0.12 * v, 'highpass', 5000, 0, pan));
      break;
    }
  }
}

// ── BGM: 코드 진행 기반 절차적 칩튠 ──
const SONGS = {
  menu: { bpm: 104, prog: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]], root: 60, seed: 3, lead: 'triangle', drums: 1 },
  battle: { bpm: 142, prog: [[-3, 0, 4], [-7, -3, 0], [-5, -1, 2], [-8, -5, -1]], root: 57, seed: 11, lead: 'square', drums: 2 },
  battle2: { bpm: 150, prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], root: 57, seed: 23, lead: 'square', drums: 2 },
  result: { bpm: 118, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], root: 60, seed: 5, lead: 'triangle', drums: 1 },
};
let song = null, songName = '', nextNoteT = 0, step = 0, timer = null, melody = null;
function mrand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function buildMelody(def) {
  const r = mrand(def.seed * 7919 + 1);
  const scale = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];
  const mel = [];
  for (let bar = 0; bar < 8; bar++) {
    const ch = def.prog[bar % 4];
    for (let s = 0; s < 16; s++) {
      if (bar % 4 === 3 && s >= 12) { mel.push(null); continue; }
      const strong = s % 4 === 0;
      if (!strong && r() < 0.45) { mel.push(null); continue; }
      const n = strong ? ch[(r() * 3) | 0] + 12 : scale[(r() * scale.length) | 0] + (def.root === 57 ? 0 : 0);
      mel.push(n);
    }
  }
  return mel;
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function schedule() {
  if (!ctx || !song) return;
  const spb = 60 / song.bpm / 4;
  while (nextNoteT < ctx.currentTime + 0.15) {
    const s = step % 128, bar = (s / 16) | 0, ss = s % 16, ch = song.prog[bar % 4], t = nextNoteT;
    // 베이스
    if (ss % 2 === 0) { const n = song.root - 24 + ch[0] + (ss % 8 === 6 ? 12 : 0); osc('triangle', mtof(n), mtof(n), t, spb * 1.6, 0.22, 0, musicBus); }
    // 아르페지오
    if (song.drums === 2 || ss % 2 === 0) { const n = song.root + ch[ss % 3] + (ss % 6 < 3 ? 0 : 12); osc('square', mtof(n), mtof(n), t, spb * 0.7, 0.035, -0.2, musicBus); }
    // 멜로디 (8마디 중 후반 4마디에서만)
    const m = melody[s];
    if (m != null && bar >= 4) osc(song.lead, mtof(song.root + m), mtof(song.root + m), t, spb * 1.8, 0.06, 0.2, musicBus);
    // 드럼
    if (ss % 4 === 0) { osc('sine', 150, 40, t, 0.12, 0.35, 0, musicBus); }
    if (ss % 8 === 4) noise(t, 0.12, 0.2, 'bandpass', 1800, 900, 0, musicBus, 0.8);
    if (song.drums === 2 && ss % 2 === 1) noise(t, 0.03, 0.06, 'highpass', 7000, 0, 0.3, musicBus);
    if (song.drums === 1 && ss % 4 === 2) noise(t, 0.03, 0.05, 'highpass', 7000, 0, 0.3, musicBus);
    nextNoteT += spb; step++;
  }
}
export function playMusic(name) {
  if (!ctx || songName === name) return;
  stopMusic();
  songName = name; song = SONGS[name]; if (!song) return;
  melody = buildMelody(song); step = 0; nextNoteT = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 40);
}
export function stopMusic() { if (timer) clearInterval(timer); timer = null; song = null; songName = ''; }
export function audioReady() { return !!ctx; }
