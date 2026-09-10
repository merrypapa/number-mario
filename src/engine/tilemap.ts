import { TILE } from '../core/constants';
import type { Box } from './aabb';

export const enum Tile {
  Empty = 0,
  Ground = 1,
  Brick = 2,
  Question = 3,
  OneWay = 4,
  Spike = 5,
  Lava = 6,
  Stone = 7,
  Used = 8,
  Rainbow = 9,
  /** 어린이 모드에서 낭떠러지 위에 자동으로 놓이는 사다리 다리 */
  KidBridge = 10,
  /** 초록 파이프 (들어가면 보너스 방으로) */
  Pipe = 11,
}

export interface SpawnPoint {
  kind: string;
  tx: number;
  ty: number;
  /** 숫자 패드 등에서 쓰이는 부가 값 */
  value?: number;
}

export interface TileMap {
  w: number;
  h: number;
  tiles: Uint8Array;
  spawns: SpawnPoint[];
}

/** 문자 → 타일 매핑 (타일이 아닌 문자는 엔티티 스폰으로 처리된다) */
const CHAR_TO_TILE: Record<string, Tile> = {
  '#': Tile.Ground,
  B: Tile.Brick,
  '?': Tile.Question,
  '=': Tile.OneWay,
  '^': Tile.Spike,
  L: Tile.Lava,
  S: Tile.Stone,
  n: Tile.Pipe,
};

/** 문자 → 엔티티 종류 */
const CHAR_TO_SPAWN: Record<string, string> = {
  P: 'player',
  F: 'goal',
  C: 'checkpoint',
  o: 'coin',
  '+': 'orb',
  H: 'heart',
  m: 'minusbug',
  b: 'divbat',
  z: 'zeroslime',
  Z: 'boss',
  D: 'platformH',
  V: 'platformV',
};

const SOLID = new Set<number>([
  Tile.Ground,
  Tile.Brick,
  Tile.Question,
  Tile.Stone,
  Tile.Used,
  Tile.Rainbow,
  Tile.KidBridge,
  Tile.Pipe,
]);

/**
 * 문자열 행 배열을 타일맵으로 파싱한다.
 * 행 길이가 달라도 가장 긴 행에 맞춰 빈칸으로 채운다.
 * 숫자 문자('1'~'9', '0'=10)는 숫자 패드 스폰이 된다.
 */
export function parseLevel(rows: readonly string[]): TileMap {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const tiles = new Uint8Array(w * h);
  const spawns: SpawnPoint[] = [];

  for (let ty = 0; ty < h; ty++) {
    const row = rows[ty] ?? '';
    for (let tx = 0; tx < w; tx++) {
      const ch = row[tx] ?? ' ';
      if (ch === ' ' || ch === '.') continue;
      const tile = CHAR_TO_TILE[ch];
      if (tile !== undefined) {
        tiles[ty * w + tx] = tile;
        continue;
      }
      // 파이프 입구/출구는 타일이면서 동시에 이동 지점이다
      if (ch === 'w' || ch === 'e') {
        tiles[ty * w + tx] = Tile.Pipe;
        spawns.push({ kind: ch === 'w' ? 'pipeEnter' : 'pipeExit', tx, ty });
        continue;
      }
      if (ch === '!') {
        // 플러스 오브가 들어 있는 아이템 블록
        tiles[ty * w + tx] = Tile.Question;
        spawns.push({ kind: 'orbblock', tx, ty });
        continue;
      }
      const kind = CHAR_TO_SPAWN[ch];
      if (kind !== undefined) {
        spawns.push({ kind, tx, ty });
        continue;
      }
      if (ch >= '0' && ch <= '9') {
        spawns.push({ kind: 'numberpad', tx, ty, value: ch === '0' ? 10 : Number(ch) });
      }
    }
  }
  return { w, h, tiles, spawns };
}

export function getTile(map: TileMap, tx: number, ty: number): Tile {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return Tile.Empty;
  return map.tiles[ty * map.w + tx] as Tile;
}

export function setTile(map: TileMap, tx: number, ty: number, tile: Tile): void {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return;
  map.tiles[ty * map.w + tx] = tile;
}

/** 맵 밖 좌우는 벽으로 취급해 플레이어가 이탈하지 않게 한다. */
export function isSolidAt(map: TileMap, tx: number, ty: number): boolean {
  if (tx < 0 || tx >= map.w) return true;
  if (ty < 0 || ty >= map.h) return false;
  return SOLID.has(map.tiles[ty * map.w + tx]);
}

export function isOneWayAt(map: TileMap, tx: number, ty: number): boolean {
  return getTile(map, tx, ty) === Tile.OneWay;
}

export function isHazardAt(map: TileMap, tx: number, ty: number): boolean {
  const t = getTile(map, tx, ty);
  return t === Tile.Spike || t === Tile.Lava;
}

export function tileBox(tx: number, ty: number): Box {
  return { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
}

/** 박스가 걸치는 타일 좌표 범위 (끝 좌표 포함). */
export function tileRange(box: Box): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: Math.floor(box.x / TILE),
    y0: Math.floor(box.y / TILE),
    x1: Math.floor((box.x + box.w - 0.001) / TILE),
    y1: Math.floor((box.y + box.h - 0.001) / TILE),
  };
}

/** 박스가 겹치는 칸 중 위험 타일이 있으면 그 타일 종류를 돌려준다. */
export function hazardOverlapping(map: TileMap, box: Box): Tile | null {
  const r = tileRange(box);
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const t = getTile(map, tx, ty);
      // 가시는 칸의 아래쪽 절반만 실제 판정 영역
      if (t === Tile.Spike) {
        if (box.y + box.h > ty * TILE + TILE * 0.45) return t;
      } else if (t === Tile.Lava) {
        if (box.y + box.h > ty * TILE + TILE * 0.25) return t;
      }
    }
  }
  return null;
}

export const pxToTile = (px: number) => Math.floor(px / TILE);
