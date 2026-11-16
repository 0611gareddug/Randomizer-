// 무기/스킬/도발/이벤트 데이터 (모두 오리지널)
export const RARITY = [
  { name: '일반', color: '#c7ccd6', glow: '#8a93a6', weight: 52 },
  { name: '희귀', color: '#4fc3ff', glow: '#1e7fd6', weight: 30 },
  { name: '영웅', color: '#c46bff', glow: '#7c2fd6', weight: 14 },
  { name: '전설', color: '#ffc93c', glow: '#ff8a00', weight: 4 },
];

// ── 주무기 15종 ──
// rate: 초당 발사, mag: 탄창, reload: 재장전 초, auto: 연사, b: 탄 정보
export const PRIMARY = [
  { id: 'pea', name: '콩알 권총', r: 0, desc: '믿음직한 기본기. 콩알은 생각보다 아프다.', rate: 5, mag: 12, reload: 1.0, auto: false,
    b: { t: 'pea', spd: 330, dmg: 17, life: 0.9, rad: 2, spread: 0.03 } },
  { id: 'smg', name: '동네 기관단총', r: 0, desc: '동네 문방구 출신. 빠르지만 흩어진다.', rate: 13, mag: 32, reload: 1.4, auto: true,
    b: { t: 'pea', spd: 320, dmg: 8, life: 0.7, rad: 2, spread: 0.13 } },
  { id: 'shotgun', name: '펌프 산탄총', r: 0, desc: '가까이서 한 방. 멀면 간지럼.', rate: 1.4, mag: 5, reload: 1.6, auto: false,
    b: { t: 'pellet', spd: 300, dmg: 10, life: 0.38, rad: 2, spread: 0.32, count: 8 } },
  { id: 'baguette', name: '바게트 소총', r: 0, desc: '갓 구운 3점사. 부스러기에 주의.', rate: 2.6, mag: 18, reload: 1.3, auto: false, burst: 3,
    b: { t: 'bread', spd: 360, dmg: 14, life: 0.85, rad: 2, spread: 0.04 } },
  { id: 'revolver', name: '보안관 리볼버', r: 1, desc: '여섯 발의 정의. 한 발 한 발이 묵직하다.', rate: 2.2, mag: 6, reload: 1.5, auto: false,
    b: { t: 'rev', spd: 420, dmg: 34, life: 0.9, rad: 2, spread: 0.01 } },
  { id: 'duck', name: '고무오리 유탄발사기', r: 1, desc: '벽에 튕기는 꽥꽥 폭탄. 3번 튕기면 펑.', rate: 1.2, mag: 4, reload: 1.8, auto: false,
    b: { t: 'duck', spd: 200, dmg: 18, life: 1.6, rad: 4, spread: 0.02, bounce: 3, boom: 46, boomR: 34 } },
  { id: 'bubble', name: '비눗방울 기관총', r: 1, desc: '맞으면 끈적해져 느려진다.', rate: 9, mag: 40, reload: 1.6, auto: true,
    b: { t: 'bubble', spd: 150, dmg: 6, life: 1.4, rad: 4, spread: 0.2, slow: 0.7 } },
  { id: 'sniper', name: '망원경 저격총', r: 1, desc: '빨간 조준선을 0.35초 보여준 뒤 즉발 저격. 맞으면 아프다.', rate: 0.9, mag: 4, reload: 2.0, auto: false,
    b: { t: 'snipe', hitscan: true, dmg: 82, range: 420, spread: 0 } },
  { id: 'icecream', name: '아이스크림 블래스터', r: 1, desc: '차가운 콘 조각. 3번 맞으면 꽁꽁.', rate: 6, mag: 24, reload: 1.5, auto: true,
    b: { t: 'ice', spd: 280, dmg: 9, life: 0.6, rad: 3, spread: 0.08, chill: 1 } },
  { id: 'dryer', name: '화염 드라이어', r: 2, desc: '미용실 최강 병기. 뜨거워서 불이 붙는다.', rate: 20, mag: 60, reload: 1.8, auto: true,
    b: { t: 'flame', spd: 170, dmg: 3.2, life: 0.42, rad: 4, spread: 0.22, pierce: true, burn: 1 } },
  { id: 'frisbee', name: '프리스비 런처', r: 2, desc: '벽을 타고 4번 튕기는 날카로운 원반.', rate: 2.2, mag: 6, reload: 1.5, auto: false,
    b: { t: 'disc', spd: 290, dmg: 26, life: 2.0, rad: 4, spread: 0.02, bounce: 4, pierce: true } },
  { id: 'laser', name: '레이저 포인터 캐논', r: 2, desc: '짧은 예고 후 일직선을 꿰뚫는 관통 레이저.', rate: 1.6, mag: 5, reload: 1.7, auto: false,
    b: { t: 'laser', hitscan: true, pierce: true, dmg: 44, range: 360, spread: 0 } },
  { id: 'popcorn', name: '팝콘 기관총', r: 2, desc: '날아가다 톡! 세 갈래로 터진다.', rate: 5, mag: 20, reload: 1.6, auto: true,
    b: { t: 'kernel', spd: 260, dmg: 9, life: 0.28, rad: 3, spread: 0.06, split: 3 } },
  { id: 'blackhole', name: '블랙홀 탄산캔', r: 3, desc: '흔든 탄산캔이 모든 것을 빨아들인 뒤 터진다.', rate: 0.7, mag: 2, reload: 2.2, auto: false,
    b: { t: 'hole', spd: 190, dmg: 0, life: 0.55, rad: 5, spread: 0, hole: true, boom: 70, boomR: 46 } },
  { id: 'ukulele', name: '번개 우쿨렐레', r: 3, desc: '한 번 튕기면 번개가 세 명을 잇는다.', rate: 1.8, mag: 8, reload: 1.6, auto: false,
    b: { t: 'bolt', hitscan: true, dmg: 34, range: 230, chain: 3, chainR: 90, spread: 0 } },
];

// ── 근접무기 10종 ── range: 사거리, arc: 휘두름 각도(라디안), cd: 쿨다운
export const MELEE = [
  { id: 'onion', name: '대파', r: 0, desc: '휘두르며 살짝 돌진. 빠르게 찰싹찰싹.', dmg: 24, range: 22, arc: 1.7, cd: 0.38, knock: 70 },
  { id: 'bat', name: '알루미늄 배트', r: 0, desc: '홈런! 멀리 날려버린다.', dmg: 30, range: 24, arc: 1.6, cd: 0.6, knock: 260 },
  { id: 'hammer', name: '뿅망치', r: 0, desc: '뿅! 맞은 상대는 잠깐 어지럽다.', dmg: 15, range: 20, arc: 1.5, cd: 0.45, knock: 40, stun: 0.5 },
  { id: 'pan', name: '무쇠 프라이팬', r: 1, desc: '휘두르는 순간 날아오는 탄을 되받아친다.', dmg: 30, range: 22, arc: 2.0, cd: 0.55, knock: 120, reflect: true },
  { id: 'tuna', name: '냉동 참치', r: 1, desc: '무겁고 차갑다. 맞으면 느려진다.', dmg: 44, range: 26, arc: 1.5, cd: 0.85, knock: 200, chill: 2 },
  { id: 'straw', name: '젤리 빨대', r: 1, desc: '쪽쪽. 준 피해의 절반을 흡수한다.', dmg: 22, range: 24, arc: 1.2, cd: 0.42, knock: 30, leech: 0.5 },
  { id: 'greatsword', name: '골판지 대검', r: 2, desc: '골판지지만 넓고 강하다.', dmg: 52, range: 30, arc: 2.6, cd: 0.9, knock: 160 },
  { id: 'swatter', name: '전기 파리채', r: 2, desc: '지지직! 주변 적에게 전기가 튄다.', dmg: 28, range: 24, arc: 1.8, cd: 0.55, knock: 60, zap: 22 },
  { id: 'sausage', name: '소시지 채찍', r: 2, desc: '길게 휘어 찰싹. 사거리가 길다.', dmg: 26, range: 42, arc: 0.9, cd: 0.6, knock: 90 },
  { id: 'saber', name: '광선검', r: 3, desc: '부웅. 휘두르며 앞으로 돌진한다.', dmg: 50, range: 28, arc: 2.2, cd: 0.6, knock: 150, lunge: 220 },
];

// ── 스킬 10종 ──
export const SKILL = [
  { id: 'dash', name: '젤리 대시', r: 0, desc: '조준 방향으로 빠르게 미끄러진다.', cd: 4 },
  { id: 'smoke', name: '연막 푸딩', r: 0, desc: '연기 속에서는 모습이 보이지 않는다.', cd: 12 },
  { id: 'banana', name: '바나나 지뢰', r: 0, desc: '바나나 3개를 깔아 둔다. 밟으면 쭉 미끄러진다.', cd: 10 },
  { id: 'pudding', name: '회복 푸딩', r: 0, desc: '3초에 걸쳐 체력 60 회복.', cd: 14 },
  { id: 'shield', name: '젤리 방패', r: 1, desc: '3초간 정면의 탄을 막아낸다.', cd: 10 },
  { id: 'blink', name: '순간이동', r: 1, desc: '조준 방향으로 순식간에 이동한다.', cd: 7 },
  { id: 'turret', name: '미니 포탑', r: 2, desc: '8초간 가까운 적을 쏘는 포탑을 설치한다.', cd: 16 },
  { id: 'split', name: '분열', r: 2, desc: '적을 속이는 분신 2마리를 만든다. 분신은 펑 터진다.', cd: 14 },
  { id: 'giant', name: '거대화', r: 2, desc: '6초간 커지고, 공격력과 체력이 오른다.', cd: 18 },
  { id: 'strike', name: '비둘기 폭격', r: 3, desc: '조준한 곳에 비둘기 편대가 폭탄을 떨어뜨린다.', cd: 15 },
];

// ── 도발 6종 ── 끝까지 추면 체력 10 회복
export const TAUNT = [
  { id: 'wiggle', name: '말랑 댄스', r: 0, desc: '좌우로 말랑말랑.', emote: '♪' },
  { id: 'clap', name: '박수', r: 0, desc: '짝짝짝! 칭찬인지 놀림인지.', emote: '👏' },
  { id: 'point', name: 'ㅋㅋ 손가락질', r: 1, desc: '저기 봐, ㅋㅋ', emote: 'ㅋㅋ' },
  { id: 'wave', name: '꿀렁 웨이브', r: 1, desc: '파도처럼 꿀렁.', emote: '~' },
  { id: 'spin', name: '빙글빙글', r: 2, desc: '어지러울 때까지 회전.', emote: '@' },
  { id: 'tongue', name: '메롱', r: 3, desc: '최고 등급의 놀림.', emote: '메롱' },
];

// ── 템포 조정: 탄속·연사·쿨다운을 전체적으로 느긋하게 ──
for (const w of PRIMARY) { w.rate *= 0.8; w.reload *= 1.12; if (w.b.spd) { w.b.spd *= 0.78; w.b.life /= 0.78 * 1.04; } }
for (const m of MELEE) m.cd *= 1.15;
for (const s of SKILL) s.cd = Math.round(s.cd * 1.15);

// ── 밸런스: 등급별 계단식 (일반 < 희귀 < 영웅 < 전설) ──
const tune = (list, id, f) => f(list.find((x) => x.id === id));
const BAL = {
  pea: { dmg: 14 }, smg: { dmg: 7 }, shotgun: { dmg: 7.5 }, baguette: { dmg: 11 },
  revolver: { dmg: 27 }, duck: { dmg: 14, boom: 45, spd: 1.15 }, bubble: { dmg: 10.5, spd: 1.5 }, sniper: { dmg: 78, charge: 0.35, rate: 1.25 }, icecream: { dmg: 7.5 },
  dryer: { dmg: 7.6, life: 1.25 }, frisbee: { dmg: 25 }, laser: { dmg: 58, charge: 0.3 }, popcorn: { dmg: 15, spd: 1.2 },
  blackhole: { boom: 34 }, ukulele: { dmg: 22 },
};
for (const w of PRIMARY) {
  const o = BAL[w.id]; if (!o) continue;
  if (o.dmg !== undefined) w.b.dmg = o.dmg;
  if (o.boom !== undefined) w.b.boom = o.boom;
  if (o.spd && w.b.spd) { w.b.spd *= o.spd; w.b.life /= o.spd; }
  if (o.life) w.b.life *= o.life;
  if (o.charge) w.b.charge = o.charge;
  if (o.rate) w.rate *= o.rate;
}
// 근접: 공통 돌진 + 사거리/피해 상향 (접근 위험에 대한 보상)
for (const m of MELEE) { m.range = Math.round(m.range * 1.3); m.dmg = Math.round(m.dmg * 1.35); }
const MBAL = { straw: { dmg: 40 }, hammer: { dmg: 26, stun: 0.6 }, swatter: { dmg: 64, zap: 36 }, saber: { dmg: 90 }, sausage: { dmg: 32 }, greatsword: { dmg: 62 }, onion: { dmg: 34 } };
for (const m of MELEE) Object.assign(m, MBAL[m.id] || {});

export const SLOTS = [
  { key: 'p', name: '주무기', list: PRIMARY },
  { key: 'm', name: '근접', list: MELEE },
  { key: 's', name: '스킬', list: SKILL },
  { key: 't', name: '도발', list: TAUNT },
];

// ── 랜덤 맵 이벤트 ──
export const EVENTS = [
  { id: 'ice', name: '꽁꽁 미끄럼', desc: '바닥이 전부 미끄러워진다!', color: '#9ee7ff' },
  { id: 'giant', name: '모두 거대화', desc: '전원 크기와 공격력 업!', color: '#ff9f43' },
  { id: 'speedbullet', name: '총알 2배속', desc: '모든 탄이 두 배로 빨라진다!', color: '#ff5d73' },
  { id: 'fog', name: '짙은 안개', desc: '앞이 잘 안 보인다…', color: '#9aa3b5' },
  { id: 'heal', name: '회복의 비', desc: '하늘에서 회복 젤리가 내린다!', color: '#7dff9b' },
  { id: 'mini', name: '꼬마 슬라임', desc: '전원 작아지고 빨라진다!', color: '#ffd1f0' },
];

export const BOT_NAMES = ['말랑이', '젤리킹', '푸딩맨', '꿀렁꿀렁', '쫀득이', '몰캉', '탱글', '슬라임장인', '물방울', '버블티', '곤약도사', '말캉말캉', '젤리빈', '찹쌀떡', '탱탱볼', '꼬물이'];
export const SLIME_COLORS = ['#5ee07a', '#4fc3ff', '#ff6b8a', '#ffc93c', '#b583ff', '#ff8f4a', '#5ef0d8', '#f4f4f4', '#ff5ec4', '#8bd450'];
export const FACES = ['기본', '웃음', '화남', '졸림', '멍', '윙크'];
export const HATS = ['없음', '왕관', '모자', '리본', '새싹', '헬멧'];
export const QUICK_CHAT = ['굿!', 'ㄱㄱ', 'ㅋㅋㅋ', '아니;;', '도와줘!', '좋은 판!', '그 무기 사기 ㄷㄷ', '복수한다'];

export function rollItem(list, minRarity = 0) {
  let total = 0;
  for (const it of list) if (it.r >= minRarity) total += RARITY[it.r].weight;
  let x = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    const it = list[i]; if (it.r < minRarity) continue;
    x -= RARITY[it.r].weight; if (x <= 0) return i;
  }
  return list.length - 1;
}
