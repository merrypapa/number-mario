import { describe, expect, it } from 'vitest';
import {
  Tile,
  getTile,
  hazardOverlapping,
  isOneWayAt,
  isSolidAt,
  parseLevel,
  setTile,
  tileBox,
  tileRange,
} from '../src/engine/tilemap';
import { TILE } from '../src/core/constants';

const rows = [
  '  ?  ',
  ' P  b',
  '#####',
  '#^L=#',
];

describe('타일맵 파서', () => {
  const map = parseLevel(rows);

  it('가장 긴 행에 맞춰 크기를 정한다', () => {
    expect(map.w).toBe(5);
    expect(map.h).toBe(4);
  });

  it('타일 문자를 타일로, 나머지는 스폰으로 나눈다', () => {
    expect(getTile(map, 2, 0)).toBe(Tile.Question);
    expect(getTile(map, 0, 2)).toBe(Tile.Ground);
    expect(getTile(map, 1, 1)).toBe(Tile.Empty);
    const kinds = map.spawns.map((s) => s.kind).sort();
    expect(kinds).toEqual(['divbat', 'player']);
  });

  it('느낌표는 오브가 든 아이템 블록이 된다', () => {
    const m = parseLevel(['!']);
    expect(getTile(m, 0, 0)).toBe(Tile.Question);
    expect(m.spawns[0]).toMatchObject({ kind: 'orbblock', tx: 0, ty: 0 });
  });

  it('숫자 문자는 숫자 패드가 되고 0은 10을 뜻한다', () => {
    const m = parseLevel(['7 0']);
    expect(m.spawns).toEqual([
      { kind: 'numberpad', tx: 0, ty: 0, value: 7 },
      { kind: 'numberpad', tx: 2, ty: 0, value: 10 },
    ]);
  });

  it('맵 좌우 바깥은 벽으로 취급한다', () => {
    expect(isSolidAt(map, -1, 1)).toBe(true);
    expect(isSolidAt(map, 99, 1)).toBe(true);
    expect(isSolidAt(map, 1, -1)).toBe(false);
  });

  it('한방향 발판과 위험 타일을 구분한다', () => {
    expect(isOneWayAt(map, 3, 3)).toBe(true);
    expect(isSolidAt(map, 3, 3)).toBe(false);
    expect(getTile(map, 1, 3)).toBe(Tile.Spike);
  });

  it('타일을 바꿀 수 있다', () => {
    const m = parseLevel(['B']);
    setTile(m, 0, 0, Tile.Empty);
    expect(getTile(m, 0, 0)).toBe(Tile.Empty);
  });

  it('가시는 칸 아래쪽에 닿아야 판정된다', () => {
    const m = parseLevel(['^']);
    const shallow = { x: 0, y: 0, w: TILE, h: TILE * 0.3 };
    const deep = { x: 0, y: 0, w: TILE, h: TILE };
    expect(hazardOverlapping(m, shallow)).toBeNull();
    expect(hazardOverlapping(m, deep)).toBe(Tile.Spike);
  });

  it('타일 좌표 유틸', () => {
    expect(tileBox(2, 3)).toEqual({ x: 2 * TILE, y: 3 * TILE, w: TILE, h: TILE });
    expect(tileRange({ x: 0, y: 0, w: TILE, h: TILE })).toEqual({ x0: 0, y0: 0, x1: 0, y1: 0 });
  });
});
