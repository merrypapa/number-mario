import { TILE, MAX_FALL_SPEED } from '../core/constants';
import type { Box } from '../engine/aabb';
import { isSolidAt, type TileMap } from '../engine/tilemap';
import type { World } from './world';

export type ItemKind = 'coin' | 'orb' | 'heart' | 'checkpoint' | 'goal' | 'numberpad';

export interface Item {
  kind: ItemKind;
  box: Box;
  taken: boolean;
  anim: number;
  /** 숫자 패드가 지정하는 숫자 */
  value: number;
  /** 블록에서 튀어나온 아이템의 낙하 속도 */
  vy: number;
  /** 튀어나온 아이템이 굴러가는 속도 */
  vx: number;
  /** 중력·지형 충돌을 적용할지 */
  physics: boolean;
  /** 튀어나온 칸의 행. 이 칸보다 아래에 착지해야 멈춘다 */
  spawnRow: number;
  active: boolean;
}

export function makeItem(kind: ItemKind, tx: number, ty: number, value = 0): Item {
  const sizes: Record<ItemKind, [number, number]> = {
    coin: [TILE * 0.6, TILE * 0.8],
    orb: [TILE * 0.8, TILE * 0.8],
    heart: [TILE * 0.8, TILE * 0.7],
    checkpoint: [TILE * 0.5, TILE * 2],
    goal: [TILE, TILE * 1.2],
    numberpad: [TILE, TILE * 0.5],
  };
  const [w, h] = sizes[kind];
  return {
    kind,
    box: { x: tx * TILE + (TILE - w) / 2, y: ty * TILE + (TILE - h), w, h },
    taken: false,
    anim: Math.random() * Math.PI * 2,
    value,
    vy: 0,
    vx: 0,
    physics: false,
    spawnRow: ty,
    active: true,
  };
}

const ITEM_GRAVITY = 1250;
const ITEM_MAX_FALL = 520;

/**
 * 아이템 갱신.
 * 블록에서 튀어나온 아이템(physics)은 마리오의 버섯처럼 위로 튄 뒤
 * 옆으로 굴러가다가, **나온 칸보다 낮은 발판**에 닿으면 멈춘다.
 * (블록 위에 그대로 떠 있으면 플레이어가 닿을 수 없기 때문)
 */
export function updateItem(item: Item, dt: number, map?: TileMap): void {
  item.anim += dt;
  if (!item.physics || !map) return;

  item.vy = Math.min(item.vy + ITEM_GRAVITY * dt, ITEM_MAX_FALL);

  // 가로: 벽에 닿으면 반대로 굴러간다
  if (item.vx !== 0) {
    item.box.x += item.vx * dt;
    const dir = Math.sign(item.vx);
    const edgeX = dir > 0 ? item.box.x + item.box.w : item.box.x;
    const tx = Math.floor(edgeX / TILE);
    const ty = Math.floor((item.box.y + item.box.h / 2) / TILE);
    if (isSolidAt(map, tx, ty)) {
      item.box.x -= item.vx * dt;
      item.vx = -item.vx;
    }
  }

  // 세로: 착지 판정
  item.box.y += item.vy * dt;
  if (item.vy > 0) {
    const footRow = Math.floor((item.box.y + item.box.h) / TILE);
    const cols = [
      Math.floor(item.box.x / TILE),
      Math.floor((item.box.x + item.box.w - 0.01) / TILE),
    ];
    for (const tx of cols) {
      if (!isSolidAt(map, tx, footRow)) continue;
      item.box.y = footRow * TILE - item.box.h;
      item.vy = 0;
      // 나온 블록 위가 아니라 더 아래 지면에 닿았을 때만 멈춘다
      if (footRow > item.spawnRow + 1) {
        item.physics = false;
        item.vx = 0;
      }
      break;
    }
  }

  // 화면 밖으로 떨어지면 사라진다
  if (item.box.y > map.h * TILE + 60) item.taken = true;
}

/* ── 별 발사체 ────────────────────────────────────────── */

export interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  spin: number;
}

export function updateStar(star: Star, dt: number, world: World): boolean {
  star.life -= dt;
  star.spin += dt * 14;
  star.vy += 900 * dt;
  star.x += star.vx * dt;
  star.y += star.vy * dt;
  const tx = Math.floor(star.x / TILE);
  const ty = Math.floor((star.y + 4) / TILE);
  if (isSolidAt(world.map, tx, ty)) {
    star.y = ty * TILE - 4;
    star.vy = -320;
  }
  const tSide = Math.floor((star.x + Math.sign(star.vx) * 5) / TILE);
  if (isSolidAt(world.map, tSide, Math.floor(star.y / TILE))) star.vx *= -1;
  return star.life > 0;
}

/* ── 이동 발판 ────────────────────────────────────────── */

export interface MovingPlatform {
  box: Box;
  axis: 'x' | 'y';
  origin: number;
  range: number;
  speed: number;
  t: number;
  dx: number;
  dy: number;
}

export function makePlatform(tx: number, ty: number, axis: 'x' | 'y'): MovingPlatform {
  return {
    box: { x: tx * TILE, y: ty * TILE, w: TILE * 3, h: TILE * 0.6 },
    axis,
    origin: axis === 'x' ? tx * TILE : ty * TILE,
    range: axis === 'x' ? TILE * 4 : TILE * 3.5,
    speed: 1.1,
    t: 0,
    dx: 0,
    dy: 0,
  };
}

export function updatePlatform(p: MovingPlatform, dt: number): void {
  p.t += dt * p.speed;
  const offset = Math.sin(p.t) * p.range;
  if (p.axis === 'x') {
    const nx = p.origin + offset;
    p.dx = nx - p.box.x;
    p.dy = 0;
    p.box.x = nx;
  } else {
    const ny = p.origin + offset;
    p.dy = ny - p.box.y;
    p.dx = 0;
    p.box.y = ny;
  }
}

/* ── 보스가 떨어뜨리는 블록 ──────────────────────────── */

export interface FallingBlock {
  box: Box;
  vy: number;
  alive: boolean;
  warn: number;
}

export function makeFallingBlock(x: number, y: number): FallingBlock {
  return { box: { x: x - TILE / 2, y, w: TILE, h: TILE }, vy: 0, alive: true, warn: 0.6 };
}

export function updateFallingBlock(b: FallingBlock, dt: number, world: World): void {
  if (b.warn > 0) {
    b.warn -= dt;
    return;
  }
  b.vy = Math.min(b.vy + 1400 * dt, MAX_FALL_SPEED);
  b.box.y += b.vy * dt;
  const ty = Math.floor((b.box.y + b.box.h) / TILE);
  const tx = Math.floor((b.box.x + b.box.w / 2) / TILE);
  if (isSolidAt(world.map, tx, ty)) {
    b.alive = false;
    world.particles.debris(b.box.x + b.box.w / 2, b.box.y + b.box.h, '#4a4f6b');
    world.shake(3);
  }
  if (b.box.y > world.map.h * TILE + 60) b.alive = false;
}
