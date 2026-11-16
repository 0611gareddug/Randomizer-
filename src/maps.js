// 테마 맵 3종 + 충돌/시야 판정
// 타일: 0 바닥, 1 벽, 2 장애물, 3 얼음, 4 벨트→, 5 벨트←, 6 벨트↑, 7 벨트↓
export const TILE = 16;

// 4분면 정의 → 좌우/상하 대칭으로 확장
const FACTORY_Q = [
  '########################',
  '#S.....#................',
  '#......#................',
  '#..XX..#....XX..........',
  '#..XX.......XX..........',
  '#.................>>>>>>',
  '#......#..........>>>>>>',
  '####.###................',
  '#..........XXX..........',
  '#..H.......X.........###',
  '#..........X.........#..',
  '#....##..............#..',
  '#....##...vvvvvv.....#..',
  '#.........vvvvvv........',
  '#S......................',
  '#.......XX.......XX.....',
];
const SNOW_Q = [
  '########################',
  '#S.........iii..........',
  '#..XXXX....iii....T.....',
  '#..XXXX...........T.....',
  '#..XXXX....T............',
  '#...........T......XXXX.',
  '#..T...............XXXX.',
  '#..........iiiii...XXXX.',
  '#....T.....iiiii........',
  '#..........iiiii.....T..',
  '#.XXX...................',
  '#.XXX......T......iiiiii',
  '#......H..........iiiiii',
  '#..T..............iiiiii',
  '#S.......T...XX...iiiiii',
  '#............XX.........',
];
// 편의점: 왼쪽 절반(24x32) → 좌우 대칭
const STORE_L = [
  '########################',
  '#S...........#..........',
  '#.XXXXXXXXX..#..iiiiiii.',
  '#............#..iiiiiii.',
  '#.XXXXXXXXX.....iiXXii..',
  '#...............iiiiiii.',
  '#.XXXXXXXXX..#..........',
  '#............#####..####',
  '#H......................',
  '####..####..............',
  '#.........#.....XX......',
  '#..XX.....#.....XX......',
  '#..XX...................',
  '#.........#.............',
  '####..#####.............',
  '#S.............XXXXXXXXX',
  '#.......................',
  '#..XXX..XXX..#....XX....',
  '#............#....XX....',
  '#..XXX..XXX..#..........',
  '#............#..........',
  '#####..#######...H......',
  '#.......................',
  '#.XX.XX.XX.XX...........',
  '#.......................',
  '#.XX.XX.XX.XX..#####..##',
  '#..............#........',
  '#......S.......#..i.i.i.',
  '#..............#........',
  '#.XXXXXXX......i.i.i.i..',
  '#S.............#........',
  '########################',
];

function mirrorH(rows) { return rows.map((r) => r + r.split('').reverse().join('')); }
function mirrorV(rows) {
  const sw = { '>': '<', '<': '>', '^': 'v', 'v': '^' };
  const bottom = rows.slice().reverse().map((r) => r.split('').map((c) => sw[c] || c).join(''));
  return rows.concat(bottom);
}

const DEFS = [
  { id: 'factory', name: '폐공장', desc: '컨베이어 벨트가 돌아가는 버려진 공장', theme: 'factory', rows: mirrorV(mirrorH(FACTORY_Q)) },
  { id: 'store', name: '24시 편의점', desc: '좁은 진열대 사이의 근접전', theme: 'store', rows: mirrorH(STORE_L) },
  { id: 'snow', name: '눈 덮인 마을', desc: '미끄러운 얼음 연못이 있는 겨울 마을', theme: 'snow', rows: mirrorV(mirrorH(SNOW_Q)) },
];
export const MAP_LIST = DEFS.map((d) => ({ id: d.id, name: d.name, desc: d.desc }));

const built = new Map();
export function getMap(id) {
  if (built.has(id)) return built.get(id);
  const d = DEFS.find((m) => m.id === id) || DEFS[0];
  const rows = d.rows, h = rows.length, w = rows[0].length;
  const grid = new Uint8Array(w * h);
  const spawns = [], heals = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = rows[j][i] || '#';
    let t = 0;
    if (c === '#') t = 1; else if (c === 'X' || c === 'T') t = 2; else if (c === 'i') t = 3;
    else if (c === '>') t = 4; else if (c === '<') t = 5; else if (c === '^') t = 6; else if (c === 'v') t = 7;
    else if (c === 'S') spawns.push({ x: (i + 0.5) * TILE, y: (j + 0.5) * TILE });
    else if (c === 'H') heals.push({ x: (i + 0.5) * TILE, y: (j + 0.5) * TILE });
    if (i === 0 || j === 0 || i === w - 1 || j === h - 1) t = 1;
    grid[j * w + i] = t;
  }
  const floors = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const t = grid[j * w + i]; if (t !== 1 && t !== 2) floors.push(j * w + i); }
  const m = { id: d.id, name: d.name, theme: d.theme, w, h, tile: TILE, grid, spawns, heals, floors, pw: w * TILE, ph: h * TILE, seed: d.id.length * 977 };
  built.set(id, m);
  return m;
}

export function solidAt(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  const t = map.grid[ty * map.w + tx];
  return t === 1 || t === 2;
}
export function tileAtPx(map, x, y) {
  const tx = (x / TILE) | 0, ty = (y / TILE) | 0;
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return 1;
  return map.grid[ty * map.w + tx];
}
export function solidPx(map, x, y) { const t = tileAtPx(map, x, y); return t === 1 || t === 2; }

// 원 vs 타일 충돌 해소 (축 분리)
export function moveCircle(map, o, dx, dy, r) {
  o.x += dx; resolve(map, o, r, true);
  o.y += dy; resolve(map, o, r, false);
}
function resolve(map, o, r, axisX) {
  const minX = ((o.x - r) / TILE) | 0, maxX = ((o.x + r) / TILE) | 0;
  const minY = ((o.y - r) / TILE) | 0, maxY = ((o.y + r) / TILE) | 0;
  for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
    if (!solidAt(map, tx, ty)) continue;
    const rx = tx * TILE, ry = ty * TILE;
    const cx = o.x < rx ? rx : o.x > rx + TILE ? rx + TILE : o.x;
    const cy = o.y < ry ? ry : o.y > ry + TILE ? ry + TILE : o.y;
    const ddx = o.x - cx, ddy = o.y - cy, d2 = ddx * ddx + ddy * ddy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2), push = r - d;
      o.x += (ddx / d) * push; o.y += (ddy / d) * push;
      if (axisX) { if (o.vx !== undefined && Math.abs(ddx) > Math.abs(ddy)) o.vx = 0; }
      else if (o.vy !== undefined && Math.abs(ddy) >= Math.abs(ddx)) o.vy = 0;
    } else { // 중심이 타일 안
      if (axisX) { o.x = o.x - rx < TILE / 2 ? rx - r : rx + TILE + r; }
      else { o.y = o.y - ry < TILE / 2 ? ry - r : ry + TILE + r; }
    }
  }
}

// 시야선 (DDA)
export function lineOfSight(map, x0, y0, x1, y1) {
  return raycast(map, x0, y0, x1, y1) >= 0.999;
}
// 벽까지의 비율(0~1) 반환
export function raycast(map, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
  const ex = Math.floor(x1 / TILE), ey = Math.floor(y1 / TILE);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
  const tDX = dx !== 0 ? Math.abs(TILE / dx) : Infinity, tDY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
  let tMX = dx !== 0 ? ((dx > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx)) : Infinity;
  let tMY = dy !== 0 ? ((dy > 0 ? (ty + 1) * TILE - y0 : y0 - ty * TILE) / Math.abs(dy)) : Infinity;
  if (solidAt(map, tx, ty)) return 0;
  for (let n = 0; n < 200; n++) {
    if (tx === ex && ty === ey) return 1;
    let t;
    if (tMX < tMY) { t = tMX; tMX += tDX; tx += stepX; } else { t = tMY; tMY += tDY; ty += stepY; }
    if (t > 1) return 1;
    if (solidAt(map, tx, ty)) return t;
  }
  return 1;
}

// BFS 흐름장 (봇 길찾기). 목표 타일로부터의 거리
const flowCache = new Map();
export function flowField(map, gx, gy, now) {
  const tx = Math.max(0, Math.min(map.w - 1, (gx / TILE) | 0)), ty = Math.max(0, Math.min(map.h - 1, (gy / TILE) | 0));
  const key = map.id + ':' + (ty * map.w + tx);
  const c = flowCache.get(key);
  if (c && now - c.t < 2) return c.f;
  const W = map.w, H = map.h, f = new Int16Array(W * H).fill(-1);
  const q = new Int32Array(W * H); let qh = 0, qt = 0;
  const start = ty * W + tx; f[start] = 0; q[qt++] = start;
  while (qh < qt) {
    const cur = q[qh++], cx = cur % W, cy = (cur / W) | 0, d = f[cur] + 1;
    for (let k = 0; k < 4; k++) {
      const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (f[ni] !== -1 || solidAt(map, nx, ny)) continue;
      f[ni] = d; q[qt++] = ni;
    }
  }
  if (flowCache.size > 64) flowCache.clear();
  flowCache.set(key, { t: now, f });
  return f;
}
// 흐름장에서 다음 이동 방향
export function flowDir(map, f, x, y) {
  const W = map.w, tx = (x / TILE) | 0, ty = (y / TILE) | 0;
  const here = f[ty * W + tx];
  let best = here < 0 ? 32767 : here, bx = 0, by = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    if (!ox && !oy) continue;
    const nx = tx + ox, ny = ty + oy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= map.h) continue;
    if (solidAt(map, nx, ny)) continue;
    if (ox && oy && (solidAt(map, tx + ox, ty) || solidAt(map, tx, ty + oy))) continue; // 모서리 끼임 방지
    const v = f[ny * W + nx];
    if (v >= 0 && v < best) { best = v; bx = (nx + 0.5) * TILE - x; by = (ny + 0.5) * TILE - y; }
  }
  const l = Math.hypot(bx, by);
  return l > 0 ? { x: bx / l, y: by / l, d: best } : { x: 0, y: 0, d: here };
}
