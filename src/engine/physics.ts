import { TILE } from '../core/constants';
import type { Box } from './aabb';
import { isSolidAt, isOneWayAt, tileRange, type TileMap } from './tilemap';

export interface Body {
  box: Box;
  vx: number;
  vy: number;
}

export interface CollisionFlags {
  onGround: boolean;
  hitCeiling: boolean;
  hitWallLeft: boolean;
  hitWallRight: boolean;
  /** 천장에 부딪힌 타일 좌표 (블록 치기 판정용) */
  ceilingTiles: Array<{ tx: number; ty: number }>;
  /** 위에 올라탄 이동 발판 인덱스 */
  groundPlatform: number;
}

export interface MoveOptions {
  /** 아래 키를 눌러 한방향 발판을 통과하는 중 */
  dropThrough?: boolean;
  /** 이동 발판 등 추가 solid (윗면만 충돌) */
  extraSolids?: readonly Box[];
}

function emptyFlags(): CollisionFlags {
  return {
    onGround: false,
    hitCeiling: false,
    hitWallLeft: false,
    hitWallRight: false,
    ceilingTiles: [],
    groundPlatform: -1,
  };
}

/**
 * 축 분리 방식으로 타일맵과 충돌을 해석하며 body를 이동시킨다.
 * X축 → Y축 순서로 처리하여 모서리에 끼는 현상을 방지한다.
 */
export function moveAndCollide(body: Body, dt: number, map: TileMap, opts: MoveOptions = {}): CollisionFlags {
  const flags = emptyFlags();
  const box = body.box;

  /* ── X 축 ─────────────────────────────────────────── */
  box.x += body.vx * dt;
  if (body.vx !== 0) {
    const r = tileRange(box);
    if (body.vx > 0) {
      let limit = Infinity;
      for (let ty = r.y0; ty <= r.y1; ty++) {
        for (let tx = r.x0; tx <= r.x1; tx++) {
          if (isSolidAt(map, tx, ty)) limit = Math.min(limit, tx * TILE);
        }
      }
      if (limit < Infinity && box.x + box.w > limit) {
        box.x = limit - box.w;
        body.vx = 0;
        flags.hitWallRight = true;
      }
    } else {
      let limit = -Infinity;
      for (let ty = r.y0; ty <= r.y1; ty++) {
        for (let tx = r.x1; tx >= r.x0; tx--) {
          if (isSolidAt(map, tx, ty)) limit = Math.max(limit, tx * TILE + TILE);
        }
      }
      if (limit > -Infinity && box.x < limit) {
        box.x = limit;
        body.vx = 0;
        flags.hitWallLeft = true;
      }
    }
  }

  /* ── Y 축 ─────────────────────────────────────────── */
  const prevBottom = box.y + box.h;
  box.y += body.vy * dt;
  if (body.vy > 0) {
    const r = tileRange(box);
    let limit = Infinity;
    for (let ty = r.y0; ty <= r.y1; ty++) {
      for (let tx = r.x0; tx <= r.x1; tx++) {
        if (isSolidAt(map, tx, ty)) {
          limit = Math.min(limit, ty * TILE);
        } else if (!opts.dropThrough && isOneWayAt(map, tx, ty) && prevBottom <= ty * TILE + 1) {
          limit = Math.min(limit, ty * TILE);
        }
      }
    }
    const platforms = opts.extraSolids ?? [];
    let platformIndex = -1;
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (box.x + box.w <= p.x || box.x >= p.x + p.w) continue;
      if (prevBottom <= p.y + 1 && box.y + box.h >= p.y) {
        if (p.y < limit) {
          limit = p.y;
          platformIndex = i;
        }
      }
    }
    if (limit < Infinity && box.y + box.h > limit) {
      box.y = limit - box.h;
      body.vy = 0;
      flags.onGround = true;
      flags.groundPlatform = platformIndex;
    }
  } else if (body.vy < 0) {
    const r = tileRange(box);
    let limit = -Infinity;
    for (let ty = r.y0; ty <= r.y1; ty++) {
      for (let tx = r.x0; tx <= r.x1; tx++) {
        if (isSolidAt(map, tx, ty)) {
          const bottomEdge = ty * TILE + TILE;
          if (bottomEdge > limit) limit = bottomEdge;
        }
      }
    }
    if (limit > -Infinity && box.y < limit) {
      // 실제로 부딪힌 천장 줄의 타일을 모아 둔다
      const ty = Math.floor((limit - 1) / TILE);
      for (let tx = r.x0; tx <= r.x1; tx++) {
        if (isSolidAt(map, tx, ty)) flags.ceilingTiles.push({ tx, ty });
      }
      box.y = limit;
      body.vy = 0;
      flags.hitCeiling = true;
    }
  }

  return flags;
}

/** 지면 접촉 여부만 확인한다(중력 적용 전 검사용). */
export function isGrounded(box: Box, map: TileMap, extraSolids: readonly Box[] = []): boolean {
  const probe: Box = { x: box.x, y: box.y + 1, w: box.w, h: box.h };
  const r = tileRange(probe);
  const ty = r.y1;
  for (let tx = r.x0; tx <= r.x1; tx++) {
    if (isSolidAt(map, tx, ty)) {
      if (probe.y + probe.h > ty * TILE) return true;
    }
    if (isOneWayAt(map, tx, ty) && box.y + box.h <= ty * TILE + 1 && probe.y + probe.h > ty * TILE) {
      return true;
    }
  }
  for (const p of extraSolids) {
    if (box.x + box.w <= p.x || box.x >= p.x + p.w) continue;
    if (box.y + box.h <= p.y + 1 && probe.y + probe.h >= p.y) return true;
  }
  return false;
}

/** 값을 [min, max] 범위로 자른다. */
export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

/** a에서 b로 최대 maxDelta 만큼 접근. */
export function approach(a: number, b: number, maxDelta: number): number {
  if (a < b) return Math.min(a + maxDelta, b);
  if (a > b) return Math.max(a - maxDelta, b);
  return b;
}
