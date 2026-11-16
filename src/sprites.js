// 코드로 생성하는 픽셀 아트 (외부 이미지 없음)
const PAL = {
  k: '#1a1530', w: '#ffffff', g: '#9aa3b5', d: '#565d72', b: '#8b5a2b', B: '#d08b47', y: '#ffd23f', o: '#ff8f1f',
  r: '#e8434f', p: '#ff8fb1', G: '#3fb950', l: '#a6e22e', c: '#4fc3ff', C: '#c8f4ff', u: '#4a78d6', v: '#9b5de5',
  n: '#0b0b12', s: '#dfe5ee', e: '#f3d9a4', h: '#6b4220', P: '#3d1a66', f: '#ffd6b0',
};

const ICONS = {
  // 주무기 (오른쪽을 향함)
  pea: ['............', '............', '..kkkkkkkkk.', '..kGGGGGGGGk', '..kGlGGGGGGk', '..kkkGGkkkk.', '....kGGk....', '....kGGk....', '....kGGk....', '....kkkk....', '............', '............'],
  smg: ['............', '.......kk...', '.kkkkkkkkkkk', '.kddddddddsk', '.kdgddddddkk', '.kkkdkkdkk..', '...kdk.kdk..', '...kdk.kdk..', '...kkk.kdk..', '.......kkk..', '............', '............'],
  shotgun: ['............', '............', '............', 'kkkkkkkkkkkk', 'kbbbkgggggsk', 'kbbbkddddddk', 'kbbkkkkkkkkk', 'kbbk.kk.....', 'kkkk........', '............', '............', '............'],
  baguette: ['............', '............', '............', '.kkkkkkkkkk.', 'kBBeBBeBBeBk', 'kBBBBBBBBBBk', '.kbbbbbbbbk.', '..kkkkkkkk..', '....kbk.....', '....kbk.....', '....kkk.....', '............'],
  revolver: ['............', '............', '.kkkkkkkkkk.', '.ksssssssssk', '.ksgggkkkkk.', '.kkkgggk....', '...kbbk.....', '...kbbk.....', '...kbbk.....', '...kkkk.....', '............', '............'],
  duck: ['............', '.......kkk..', '......kyyyk.', '......kywykk', '......kyyyok', '..kkkkkyyykk', '.kgggggkyyyk', '.kddddddkkk.', '.kkkdkkkk...', '...kdk......', '...kkk......', '............'],
  bubble: ['.........kk.', '........kCwk', '........kCCk', '.kkkkkkk.kk.', 'kcccccccck..', 'kcwccccccck.', 'kccccccccck.', '.kkkkcckkk..', '....kcck....', '....kcck....', '....kkkk....', '............'],
  sniper: ['............', '...kkkk.....', '...kddk.....', 'kkkkkkkkkkkk', 'kbbbbddddddk', 'kbbkkkkkkkkk', 'kbk.........', 'kkk.........', '............', '............', '............', '............'],
  icecream: ['............', '..kkk.......', '.kpppk......', 'kppwppk.....', 'kpppppkkkkkk', '.kkkkkeeeeek', '..keekekekk.', '..keeeeekk..', '...keekk....', '...kekk.....', '...kkk......', '............'],
  dryer: ['............', '....kkkkk...', '...krrrrrkkk', '..krrwrrrrok', '..krrrrrrrok', '...krrrrrkkk', '....kkrrk...', '.....krrk...', '.....krrk...', '.....kddk...', '.....kkkk...', '............'],
  frisbee: ['............', '...kkkkkk...', '..kvvvvvvk..', '.kvvwwvvvvk.', '.kvvvvvvvvk.', '..kkkkkkkk..', '.kdddddddk..', '.kgggggggsk.', '.kkkdkkkkk..', '...kdk......', '...kkk......', '............'],
  laser: ['............', '............', '.kkkkkkkk...', '.kssssssskkk', '.kssrsssskrr', '.kssssssskkk', '.kkkkdkkk...', '....kdk.....', '....kdk.....', '....kkk.....', '............', '............'],
  popcorn: ['..kk.kk.....', '.kwwkwwk....', '.kweewwk....', '.krwrwrkkkkk', '.krwrwrkgggk', '.krwrwrkkkkk', '.krwrwrk....', '.kkkkkkk....', '...kdk......', '...kdk......', '...kkk......', '............'],
  blackhole: ['............', '...kkkkk....', '...ksssk....', '..kPPPPPk...', '..kPvwPPk...', '..kPvvPPkkkk', '..kPPPPPkggk', '..kPvvvPkkkk', '..kPPPPPk...', '..kPPPPPk...', '...kkkkk....', '............'],
  ukulele: ['.........kk.', '........kyk.', '.......kyk..', '..kkk.kbk...', '.kBBBkbk....', 'kBBhBBk.....', 'kBhhhBk.....', 'kBBhBBk.....', '.kBBBk......', '..kkk.......', '............', '............'],
  // 근접 (오른쪽 위 대각선)
  onion: ['.........kk.', '........kGk.', '.......kGlk.', '......kGGk..', '.....kGlk...', '....kGGk....', '...kwwk.....', '..kwwwk.....', '.kwwwk......', '.kwek.......', '..kk........', '............'],
  bat: ['..........kk', '.........ksk', '........kssk', '.......kssk.', '......kssk..', '.....kssk...', '....kgsk....', '...kggk.....', '..kdgk......', '.kddk.......', '.kkk........', '............'],
  hammer: ['......kkkk..', '.....krrrrk.', '....krwrrrrk', '....krrrrrrk', '.....krrrrk.', '.....kkyyk..', '....kyyk....', '...kyyk.....', '..kyyk......', '.kyyk.......', '.kkk........', '............'],
  pan: ['.....kkkk...', '....kddddk..', '...kddgdddk.', '...kdgddddk.', '...kddddddk.', '....kddddk..', '....kkkkk...', '...kbk......', '..kbk.......', '.kbk........', '.kk.........', '............'],
  tuna: ['..........kk', '........kkuk', '......kkuusk', '.....kuusuk.', '....kuwuuk..', '...kuuuuk...', '..kusuuk....', '.kuuuk......', 'kkuk........', 'kuk.........', 'kk..........', '............'],
  straw: ['.........k..', '........kpk.', '.......kpk..', '......kpk...', '....kkpkk...', '...kCCCCCk..', '...kCcCCCk..', '...kCCCcCk..', '...kCcCCCk..', '....kCCCk...', '....kkkkk...', '............'],
  greatsword: ['..........kk', '.........kBk', '........kBek', '.......kBek.', '......kBek..', '.....kBek...', '..k.kBek....', '..kkBek.....', '...kbk......', '..kbkk......', '.kkk.k......', '............'],
  swatter: ['.......kkkk.', '......kycyck', '......kcyyck', '......kycyck', '......kkcyk.', '.....kgkkk..', '....kgk.....', '...kgk......', '..kdk.......', '.kdk........', '.kk.........', '............'],
  sausage: ['............', '......kkk...', '.....kroork.', '....kroork..', '...kroork...', '..kroork....', '.kroork.....', '.krrrk......', '..kkk.......', '............', '............', '............'],
  saber: ['...........k', '..........kC', '.........kCw', '........kCwk', '.......kCwk.', '......kCwk..', '.....kCwk...', '....kgsk....', '...kdgk.....', '..kddk......', '..kkk.......', '............'],
  // 스킬
  dash: ['............', '......kk....', '......kck...', '.kkkk.kcck..', '......kccck.', '.kkkkkkcccck', '......kccck.', '.kkkk.kcck..', '......kck...', '......kk....', '............', '............'],
  smoke: ['............', '....kkk.....', '...kgggk.kk.', '..kgsssgkggk', '.kgsssssgsgk', 'kgssssssssgk', 'kgsssssssssk', '.kggssssggk.', '..kkkggkkk..', '.....kk.....', '............', '............'],
  banana: ['............', '.........kk.', '........kyk.', '.......kyyk.', '......kyyyk.', '.kk..kyyyk..', '.kykkyyyyk..', '..kyyyyyk...', '...kyyyk....', '....kkk.....', '............', '............'],
  pudding: ['............', '....kkkk....', '...khhhhk...', '..khhrhhhk..', '..kyyyyyyk..', '..kyywyyyk..', '.kyyyyyyyyk.', '.kyyyyyyyyk.', 'kssssssssssk', '.kkkkkkkkkk.', '............', '............'],
  shield: ['............', '..kkkkkkkk..', '.kCCCCCCCck.', '.kCwCCCCcck.', '.kCCCCCCcck.', '.kCCCCCccck.', '..kCCCccck..', '..kCCcccck..', '...kCccck...', '....kcck....', '.....kk.....', '............'],
  blink: ['............', '.....kk.....', '....kvvk....', '.kkkvwvvkkk.', '.kvvvvvvvvk.', '..kkvvvvkk..', '...kvvvvk...', '..kvvkkvvk..', '..kvk..kvk..', '..kk....kk..', '............', '............'],
  turret: ['............', '............', '....kkkk....', '...kggggkkkk', '...kgrggsssk', '...kggggkkkk', '....kddk....', '...kddddk...', '..kddddddk..', '..kkkkkkkk..', '............', '............'],
  split: ['............', '............', '..kkk.......', '.kllGk..kk..', 'kGwkGGk.kGk.', 'kGGkGGkkGlGk', 'kGGGGGkkGwkk', '.kkkkkkkGGGk', '........kkk.', '............', '............', '............'],
  giant: ['.....kk.....', '....kook....', '...kooook...', '..kkkookkk..', '....kook....', '...kkkkkk...', '..kGGGGGGk..', '.kGwkGGkGGk.', '.kGGkGGkGGk.', '.kGGGGGGGGk.', '..kkkkkkkk..', '............'],
  strike: ['............', '..kkk.......', '.kgggk......', 'kgwnggkkkk..', '.kgggggsssk.', '..kgggggsk..', '...kkkkkk...', '......kk....', '.....knnk...', '.....knnk...', '......kk....', '............'],
  // 도발
  wiggle: ['............', '......kkkkk.', '......kvvvk.', '......kvkkk.', '......kvk...', '......kvk...', '...kkkkvk...', '..kvvvvvk...', '..kvvvvvk...', '...kkkkk....', '............', '............'],
  clap: ['............', '...k...k....', '.k..k.k..k..', '....kkk.....', '...keeek....', '..keeeeek...', '..keekeek...', '..keekeek...', '...keeek....', '....kkk.....', '............', '............'],
  point: ['............', '............', '.........k..', '.kkkkkkkkek.', 'keeeeeeeeek.', 'keeeeekkkk..', 'keeeeek.....', 'keeeeek.....', '.kkkkkk.....', '............', '............', '............'],
  wave: ['............', '............', '..kk....kk..', '.kcck..kcck.', 'kcwcck.kccck', 'kccccckccck.', '.kccccccck..', '..kkccckk...', '....kkk.....', '............', '............', '............'],
  spin: ['............', '...kkkkkk...', '..kooooook..', '.kok....kok.', '.kok.kk.kok.', '.kok.kok.ok.', '.kok.koo.ok.', '.kok..kkok..', '..kooooook..', '...kkkkkk...', '............', '............'],
  tongue: ['............', '...kkkkkk...', '..kyyyyyyk..', '.kyykyykyyk.', '.kyyyyyyyyk.', '.kykkkkkkyk.', '.kyyyrryyyk.', '..kyyrryyk..', '...kkkkkk...', '............', '............', '............'],
  // 궁극기
  jbomb: ['............', '......kk....', '.....kyk....', '....kok.....', '...kkkkk....', '..kGGGGGk...', '.kGwlGGGGk..', '.kGlGGGGGk..', '.kGGGGGGGk..', '.kGGGGGGGk..', '..kGGGGGk...', '...kkkkk....'],
  rush: ['............', '..kk...kkk..', '.kook.kGGGk.', '..kk.kGwGGGk', 'kk...kGGkGGk', 'kook.kGGGGGk', '.kk..kGGkGGk', '..kk.kGGGGGk', '.kook.kGGGk.', '..kk...kkk..', '............', '............'],
  barrage: ['.....kk.....', '..k..kk..k..', '..kk.yy.kk..', '...kyyyyk...', '.kkyywwyykk.', 'kyyywwwwyyyk', 'kyyywwwwyyyk', '.kkyywwyykk.', '...kyyyyk...', '..kk.yy.kk..', '..k..kk..k..', '.....kk.....'],
  whirl: ['............', '...kkkkkk...', '..kccccCCk..', '.kck....kCk.', '.kc..kkk.kk.', '.kc.kcck....', '.kc.kc.ck...', '.kCk..kck...', '..kCCcck....', '...kkkk.....', '............', '............'],
  blizzard: ['.....kk.....', '..k.kCCk.k..', '.kCkkwwkkCk.', '..kCCwwCCk..', '.kkkCwwCkkk.', 'kCwwwwwwwwCk', 'kCwwwwwwwwCk', '.kkkCwwCkkk.', '..kCCwwCCk..', '.kCkkwwkkCk.', '..k.kCCk.k..', '.....kk.....'],
  fortress: ['....kkkk....', '...kyyyyk...', '...kgggkkkkk', '..kggrggsssk', '..kgggggkkkk', '..kkddddk...', '.kddddddddk.', '.kdgdddgddk.', 'kddddddddddk', 'kkkkkkkkkkkk', '............', '............'],
  meteor: ['k...........', '.k.k........', '..kok.......', '.kooyk......', '..kyyyk.....', '...kyyok.kk.', '....kooookok', '......kookyk', '.....kyyyyk.', '.....kywyyk.', '......kyyk..', '.......kk...'],
  leap: ['.....kk.....', '....kook....', '...kooook...', '....kook....', '...kkkkkk...', '..kGGGGGGk..', '.kGwkGGkGGk.', '.kGGGGGGGGk.', '..kkkkkkkk..', '............', 'k.kk.kk.kk.k', '.k..k..k..k.'],
  // 월드 오브젝트
  pizza: ['............', '.kkkkkkkkkk.', '.kBBBBBBBBk.', '..kyyryyyk..', '..kyyyyryk..', '...kyryyk...', '...kyyyyk...', '....kyrk....', '....kyyk....', '.....kk.....', '............', '............'],
  milk: ['....kkkk....', '...kwwwwk...', '...kkkkkk...', '..kwwwwwwk..', '..kwccccwk..', '..kwcwwcwk..', '..kwccccwk..', '..kwwwwwwk..', '..kwwwwwwk..', '..kkkkkkkk..', '............', '............'],
  jelly: ['............', '............', '....kkkk....', '...kllllk...', '..klwllllk..', '..kllllllk..', '..kllllllk..', '..kGGGGGGk..', '...kkkkkk...', '............', '............', '............'],
  crate: ['kkkkkkkkkkkk', 'kyyyyyyyyyyk', 'kyokkkkkkoyk', 'kykoyyyyokyk', 'kykyoyyoykyk', 'kykyyooyykyk', 'kykyyooyykyk', 'kykyoyyoykyk', 'kykoyyyyokyk', 'kyokkkkkkoyk', 'kyyyyyyyyyyk', 'kkkkkkkkkkkk'],
  pigeon: ['............', '............', '....kkk.....', '...kgggk....', '..kgwngkk...', '.kkggggggk..', 'kogggsssggk.', '.kkgggggsgk.', '...kkggggk..', '.....kkkk...', '............', '............'],
};

const cache = new Map();
export function icon(id, scale = 1) {
  const key = id + '@' + scale;
  if (cache.has(key)) return cache.get(key);
  const rows = ICONS[id] || ICONS.crate;
  const c = document.createElement('canvas');
  c.width = 12 * scale; c.height = 12 * scale;
  const x = c.getContext('2d');
  for (let j = 0; j < 12; j++) {
    const row = rows[j] || '';
    for (let i = 0; i < 12; i++) {
      const ch = row[i];
      if (!ch || ch === '.') continue;
      x.fillStyle = PAL[ch] || '#f0f';
      x.fillRect(i * scale, j * scale, scale, scale);
    }
  }
  cache.set(key, c);
  return c;
}

let dataUrlCache = new Map();
export function iconURL(id) {
  if (dataUrlCache.has(id)) return dataUrlCache.get(id);
  const u = icon(id, 4).toDataURL();
  dataUrlCache.set(id, u);
  return u;
}

// ── 슬라임 ──
// 본체 16x14, 기본 색에서 명암을 자동 생성
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export { shade };

const SLIME_SHAPE = [
  '.....kkkkkk.....',
  '...kkLLLLLLkk...',
  '..kLLwwLLLLLLk..',
  '.kLLwwLLLLLLLLk.',
  '.kLLLLLLLLLLLLk.',
  'kLLLLLLLLLLLLLLk',
  'kMMMMMMMMMMMMMMk',
  'kMMMMMMMMMMMMMMk',
  'kMMMMMMMMMMMMMMk',
  'kMMMMMMMMMMMMMMk',
  'kDMMMMMMMMMMMMDk',
  '.kDDMMMMMMMMDDk.',
  '..kkDDDDDDDDkk..',
  '....kkkkkkkk....',
];
const slimeCache = new Map();
export function slimeSprite(color) {
  if (slimeCache.has(color)) return slimeCache.get(color);
  const c = document.createElement('canvas'); c.width = 16; c.height = 14;
  const x = c.getContext('2d');
  const map = { k: '#1a1530', L: shade(color, 0.28), M: color, D: shade(color, -0.3), w: '#ffffff' };
  for (let j = 0; j < 14; j++) for (let i = 0; i < 16; i++) {
    const ch = SLIME_SHAPE[j][i]; if (ch === '.') continue;
    x.fillStyle = map[ch]; x.fillRect(i, j, 1, 1);
  }
  slimeCache.set(color, c);
  return c;
}
// 흰색 피격 플래시 버전
const flashCache = new Map();
export function slimeFlash() {
  if (flashCache.has(1)) return flashCache.get(1);
  const c = document.createElement('canvas'); c.width = 16; c.height = 14;
  const x = c.getContext('2d');
  for (let j = 0; j < 14; j++) for (let i = 0; i < 16; i++) {
    const ch = SLIME_SHAPE[j][i]; if (ch === '.') continue;
    x.fillStyle = ch === 'k' ? '#ffffff' : '#ffffff'; x.fillRect(i, j, 1, 1);
  }
  flashCache.set(1, c); return c;
}

// 얼굴: 눈 위치는 조준 방향으로 살짝 이동. ctx는 저해상도 버퍼
export function drawFace(ctx, face, cx, cy, lookX, lookY, blink, t) {
  const ex = Math.round(lookX * 1.5), ey = Math.round(lookY * 1);
  const lx = cx - 4 + ex, rx = cx + 2 + ex, y = cy + ey;
  ctx.fillStyle = '#1a1530';
  const eyeH = blink ? 1 : 2;
  switch (face) {
    case 1: // 웃음 ^^
      ctx.fillRect(lx, y, 1, 1); ctx.fillRect(lx + 1, y - 1, 1, 1); ctx.fillRect(lx + 2, y, 1, 1);
      ctx.fillRect(rx, y, 1, 1); ctx.fillRect(rx + 1, y - 1, 1, 1); ctx.fillRect(rx + 2, y, 1, 1);
      break;
    case 2: // 화남
      ctx.fillRect(lx, y - 2, 1, 1); ctx.fillRect(lx + 1, y - 1, 1, 1);
      ctx.fillRect(rx + 2, y - 2, 1, 1); ctx.fillRect(rx + 1, y - 1, 1, 1);
      ctx.fillRect(lx + 1, y, 2, eyeH); ctx.fillRect(rx, y, 2, eyeH);
      break;
    case 3: // 졸림
      ctx.fillRect(lx, y + 1, 3, 1); ctx.fillRect(rx, y + 1, 3, 1);
      break;
    case 4: // 멍
      ctx.fillRect(lx + 1, y, 1, 1); ctx.fillRect(rx + 1, y, 1, 1);
      break;
    case 5: // 윙크
      ctx.fillRect(lx, y + 1, 3, 1);
      ctx.fillRect(rx, y, 2, eyeH); ctx.fillStyle = '#fff'; if (!blink) ctx.fillRect(rx, y, 1, 1);
      break;
    default:
      ctx.fillRect(lx, y, 2, eyeH); ctx.fillRect(rx, y, 2, eyeH);
      if (!blink) { ctx.fillStyle = '#fff'; ctx.fillRect(lx, y, 1, 1); ctx.fillRect(rx, y, 1, 1); }
  }
  // 입
  ctx.fillStyle = '#1a1530';
  if (face === 1 || face === 0) { ctx.fillRect(cx - 1 + ex, y + 3, 2, 1); }
  else if (face === 2) { ctx.fillRect(cx - 1 + ex, y + 3, 3, 1); }
  else if (face === 4) { ctx.fillRect(cx + ex, y + 3, 1, 1); }
}

export function drawHat(ctx, hat, cx, top) {
  switch (hat) {
    case 1: // 왕관
      ctx.fillStyle = '#1a1530'; ctx.fillRect(cx - 4, top - 4, 9, 4);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx - 3, top - 2, 7, 2);
      ctx.fillRect(cx - 3, top - 3, 1, 1); ctx.fillRect(cx, top - 3, 1, 1); ctx.fillRect(cx + 3, top - 3, 1, 1);
      ctx.fillStyle = '#e8434f'; ctx.fillRect(cx, top - 2, 1, 1);
      break;
    case 2: // 모자
      ctx.fillStyle = '#1a1530'; ctx.fillRect(cx - 5, top - 1, 11, 2); ctx.fillRect(cx - 3, top - 5, 7, 5);
      ctx.fillStyle = '#3d4b7a'; ctx.fillRect(cx - 2, top - 4, 5, 3);
      ctx.fillStyle = '#e8434f'; ctx.fillRect(cx - 2, top - 2, 5, 1);
      break;
    case 3: // 리본
      ctx.fillStyle = '#1a1530'; ctx.fillRect(cx - 4, top - 3, 9, 4);
      ctx.fillStyle = '#ff5ec4'; ctx.fillRect(cx - 3, top - 2, 3, 2); ctx.fillRect(cx + 1, top - 2, 3, 2);
      ctx.fillStyle = '#ffd1f0'; ctx.fillRect(cx, top - 2, 1, 2);
      break;
    case 4: // 새싹
      ctx.fillStyle = '#1a1530'; ctx.fillRect(cx, top - 4, 1, 4);
      ctx.fillStyle = '#3fb950'; ctx.fillRect(cx - 3, top - 5, 3, 2); ctx.fillRect(cx + 1, top - 6, 3, 2);
      ctx.fillStyle = '#a6e22e'; ctx.fillRect(cx - 2, top - 5, 1, 1); ctx.fillRect(cx + 2, top - 6, 1, 1);
      break;
    case 5: // 헬멧
      ctx.fillStyle = '#1a1530'; ctx.fillRect(cx - 6, top - 2, 13, 4);
      ctx.fillStyle = '#6a8a4a'; ctx.fillRect(cx - 5, top - 1, 11, 2);
      ctx.fillStyle = '#8fb06a'; ctx.fillRect(cx - 4, top - 1, 4, 1);
      break;
  }
}

// ── 타일 ──
const THEMES = {
  factory: { floor: '#3a3f4b', floor2: '#343945', line: '#2e323d', wallTop: '#7d8496', wallSide: '#4b5162', obstacle: 'crate', bg: '#1b1e26' },
  store: { floor: '#d9dde6', floor2: '#cdd2dc', line: '#bfc5d1', wallTop: '#6fa8dc', wallSide: '#3f6f9e', obstacle: 'shelf', bg: '#202838' },
  snow: { floor: '#eef3fb', floor2: '#e2eaf6', line: '#d5dfee', wallTop: '#8a6a4a', wallSide: '#5a432e', obstacle: 'tree', bg: '#1d2533' },
};
export function themeOf(name) { return THEMES[name]; }

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// 맵 전체를 한 번 그려 캐시
export function renderMapCanvas(map) {
  const T = map.tile, W = map.w, H = map.h, th = THEMES[map.theme];
  const c = document.createElement('canvas'); c.width = W * T; c.height = H * T;
  const x = c.getContext('2d');
  const rnd = seeded(map.seed || 7);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const t = map.grid[j * W + i];
    const px = i * T, py = j * T;
    if (t === 1) continue;
    // 바닥
    x.fillStyle = ((i + j) & 1) ? th.floor : th.floor2; x.fillRect(px, py, T, T);
    x.fillStyle = th.line; x.fillRect(px, py, T, 1); x.fillRect(px, py, 1, T);
    for (let k = 0; k < 3; k++) { x.fillStyle = rnd() < 0.5 ? th.floor2 : th.line; x.fillRect(px + 2 + (rnd() * 12 | 0), py + 2 + (rnd() * 12 | 0), 1, 1); }
    if (map.theme === 'store' && ((i * 7 + j * 3) % 11 === 0)) { x.fillStyle = '#c3c9d6'; x.fillRect(px + 3, py + 3, 10, 10); }
    if (map.theme === 'snow') { if (rnd() < 0.25) { x.fillStyle = '#ffffff'; x.fillRect(px + (rnd() * 14 | 0), py + (rnd() * 14 | 0), 2, 1); } }
    if (t === 3) { // 얼음
      x.fillStyle = '#9fdcff'; x.fillRect(px, py, T, T);
      x.fillStyle = '#bdeaff'; x.fillRect(px + 1, py + 1, T - 2, T - 2);
      x.fillStyle = '#e6f8ff'; x.fillRect(px + 3 + (rnd() * 6 | 0), py + 3, 4, 1); x.fillRect(px + 2, py + 9 + (rnd() * 4 | 0), 2, 1);
    }
    if (t >= 4 && t <= 7) { x.fillStyle = '#2a2d36'; x.fillRect(px, py, T, T); x.fillStyle = '#1f2229'; if (t <= 5) { x.fillRect(px, py, T, 2); x.fillRect(px, py + T - 2, T, 2); } else { x.fillRect(px, py, 2, T); x.fillRect(px + T - 2, py, 2, T); } }
  }
  // 벽과 장애물 (아래쪽 면 → 윗면 순서로 입체감)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const t = map.grid[j * W + i]; if (t !== 1 && t !== 2) continue;
    const px = i * T, py = j * T;
    if (t === 1) {
      x.fillStyle = th.wallSide; x.fillRect(px, py, T, T);
      x.fillStyle = th.wallTop; x.fillRect(px, py, T, T - 5);
      x.fillStyle = shade(th.wallTop, 0.15); x.fillRect(px, py, T, 1);
      x.fillStyle = shade(th.wallTop, -0.18);
      if (map.theme === 'factory') { x.fillRect(px + 7, py + 2, 1, 7); x.fillRect(px + 2, py + 5, 12, 1); }
      if (map.theme === 'store') { x.fillRect(px, py + 5, T, 1); }
      if (map.theme === 'snow') { x.fillRect(px + 3, py + 3, 4, 2); x.fillRect(px + 9, py + 7, 4, 2); x.fillStyle = '#ffffff'; x.fillRect(px, py, T, 2); }
      const below = map.grid[(j + 1) * W + i];
      if (j + 1 >= H || below === 1) { x.fillStyle = th.wallTop; x.fillRect(px, py + T - 5, T, 5); }
      else { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py + T, T, 3); }
    } else drawObstacle(x, map.theme, px, py, T, rnd, map, i, j);
  }
  return c;
}

// 수풀 레이어 (캐릭터 위에 덮어 그림)
export function renderBushCanvas(map) {
  const T = map.tile, c = document.createElement('canvas'); c.width = map.w * T; c.height = map.h * T;
  const x = c.getContext('2d'), rnd = seeded((map.seed || 7) + 99);
  const pal = map.theme === 'snow' ? ['#1a1530', '#2f7d4a', '#3f9a5c', '#6cc27e', '#ffffff'] : map.theme === 'store' ? ['#1a1530', '#2e8a4a', '#3fb060', '#7ad98a', '#c8f7c5'] : ['#1a1530', '#2b5f2e', '#3f7f3a', '#66a84f', '#9fd36a'];
  const isB = (i, j) => i >= 0 && j >= 0 && i < map.w && j < map.h && map.grid[j * map.w + i] === 8;
  const blob = (cx, cy, r, col) => { x.fillStyle = col; for (let yy = -r; yy <= r; yy++) { const w = Math.round(Math.sqrt(r * r - yy * yy)); x.fillRect(cx - w, cy + yy, w * 2 + 1, 1); } };
  for (let pass = 0; pass < 4; pass++) for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!isB(i, j)) continue;
    const px = i * T, py = j * T;
    const pts = [[4, 5], [12, 5], [4, 12], [12, 12], [8, 8]];
    for (const [ox, oy] of pts) {
      const r = 5 + ((rnd() * 2) | 0);
      if (pass === 0) blob(px + ox, py + oy, r + 1, pal[0]);
      else if (pass === 1) blob(px + ox, py + oy, r, pal[1]);
      else if (pass === 2) blob(px + ox - 1, py + oy - 1, r - 2, pal[2]);
      else { x.fillStyle = pal[3]; x.fillRect(px + ox - 2, py + oy - 3, 2, 1); x.fillRect(px + ox + 1, py + oy - 1, 1, 1); }
    }
    if (pass === 3) {
      x.fillStyle = pal[4];
      if (map.theme === 'snow') { x.fillRect(px + 2, py, 6, 2); x.fillRect(px + 9, py + 1, 5, 2); }
      else for (let k = 0; k < 3; k++) x.fillRect(px + 2 + ((rnd() * 12) | 0), py + 2 + ((rnd() * 12) | 0), 1, 1);
      if (!isB(i, j + 1)) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py + T, T, 2); }
    }
  }
  return c;
}

function drawObstacle(x, theme, px, py, T, rnd, map, i, j) {
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px + 1, py + T - 1, T, 3);
  if (theme === 'factory') { // 나무 상자
    x.fillStyle = '#1a1530'; x.fillRect(px, py, T, T);
    x.fillStyle = '#b07a3e'; x.fillRect(px + 1, py + 1, T - 2, T - 2);
    x.fillStyle = '#8b5a2b'; x.fillRect(px + 1, py + 5, T - 2, 1); x.fillRect(px + 1, py + 10, T - 2, 1);
    x.fillStyle = '#d6a062'; x.fillRect(px + 1, py + 1, T - 2, 1);
    x.fillStyle = '#6b4220'; for (let k = 2; k < T - 2; k++) x.fillRect(px + k, py + k, 1, 1);
  } else if (theme === 'store') { // 진열대
    x.fillStyle = '#1a1530'; x.fillRect(px, py, T, T);
    x.fillStyle = '#e9ecf2'; x.fillRect(px + 1, py + 1, T - 2, T - 2);
    x.fillStyle = '#aab1c0'; x.fillRect(px + 1, py + 7, T - 2, 1);
    const cols = ['#e8434f', '#ffd23f', '#3fb950', '#4fc3ff', '#ff8f1f', '#9b5de5', '#ff8fb1'];
    for (let k = 0; k < 4; k++) { x.fillStyle = cols[(rnd() * cols.length) | 0]; x.fillRect(px + 2 + k * 3, py + 3, 2, 4); }
    for (let k = 0; k < 4; k++) { x.fillStyle = cols[(rnd() * cols.length) | 0]; x.fillRect(px + 2 + k * 3, py + 9, 2, 4); }
  } else { // 소나무 / 집
    const neighbor = (dx, dy) => map.grid[(j + dy) * map.w + (i + dx)] === 2;
    const block = neighbor(1, 0) || neighbor(-1, 0) || neighbor(0, 1) || neighbor(0, -1);
    if (block) { // 집 벽 + 지붕
      x.fillStyle = '#1a1530'; x.fillRect(px, py, T, T);
      x.fillStyle = '#c0533e'; x.fillRect(px, py + 1, T, T - 2);
      x.fillStyle = '#e06b52'; for (let k = 0; k < T; k += 4) x.fillRect(px + k, py + 1 + ((k / 4) & 1) * 2, 3, T - 4);
      x.fillStyle = '#ffffff'; x.fillRect(px, py, T, 3);
      if (!neighbor(0, 1)) { x.fillStyle = '#7a4a2a'; x.fillRect(px, py + T - 5, T, 5); x.fillStyle = '#ffd23f'; x.fillRect(px + 5, py + T - 4, 4, 3); }
    } else { // 소나무
      x.fillStyle = '#5a3a1a'; x.fillRect(px + 7, py + 11, 3, 5);
      const tri = (w, yy, col) => { x.fillStyle = col; for (let k = 0; k < w; k++) x.fillRect(px + 8 - k, py + yy + k, k * 2 + 1, 1); };
      tri(6, 6, '#1a1530'); tri(5, 6, '#2f7d4a'); tri(5, 1, '#1a1530'); tri(4, 1, '#3f9a5c');
      x.fillStyle = '#ffffff'; x.fillRect(px + 7, py + 1, 3, 1); x.fillRect(px + 5, py + 6, 2, 1); x.fillRect(px + 10, py + 7, 2, 1);
    }
  }
}

export const RARITY_BORDER = ['#c7ccd6', '#4fc3ff', '#c46bff', '#ffc93c'];
