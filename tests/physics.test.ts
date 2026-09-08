import { describe, expect, it } from 'vitest';
import { TILE } from '../src/core/constants';
import { parseLevel } from '../src/engine/tilemap';
import { approach, clamp, isGrounded, moveAndCollide, type Body } from '../src/engine/physics';

/** 바닥 한 줄과 오른쪽 벽이 있는 작은 맵 */
const map = parseLevel([
  '      ',
  '     #',
  '     #',
  '######',
]);

function body(x: number, y: number, vx = 0, vy = 0): Body {
  return { box: { x, y, w: TILE, h: TILE }, vx, vy };
}

describe('충돌 해석', () => {
  it('바닥에 착지하면 수직 속도가 0이 된다', () => {
    const b = body(TILE, TILE * 2 - 4, 0, 600);
    const flags = moveAndCollide(b, 1 / 60, map, {});
    expect(flags.onGround).toBe(true);
    expect(b.vy).toBe(0);
    expect(b.box.y + b.box.h).toBe(TILE * 3);
  });

  it('오른쪽 벽에서 멈춘다', () => {
    const b = body(TILE * 4, TILE, 900, 0);
    const flags = moveAndCollide(b, 1 / 60, map, {});
    expect(flags.hitWallRight).toBe(true);
    expect(b.vx).toBe(0);
    expect(b.box.x + b.box.w).toBe(TILE * 5); // 벽면에 딱 붙어 멈춘다
  });

  it('천장에 부딪히면 부딪힌 타일을 알려준다', () => {
    const ceiling = parseLevel(['####', '    ', '####']);
    const b = body(TILE, TILE + 2, 0, -900);
    const flags = moveAndCollide(b, 1 / 60, ceiling, {});
    expect(flags.hitCeiling).toBe(true);
    expect(flags.ceilingTiles.length).toBeGreaterThan(0);
    expect(flags.ceilingTiles[0].ty).toBe(0);
  });

  it('한방향 발판은 위에서만 막는다', () => {
    const oneway = parseLevel(['    ', '====', '    ', '####']);
    // 위에서 내려오면 착지
    const falling = body(TILE, 0, 0, 400); // 발판 바로 위에서 시작
    expect(moveAndCollide(falling, 1 / 60, oneway, {}).onGround).toBe(true);
    expect(falling.box.y + falling.box.h).toBe(TILE);
    // 아래에서 올라오면 통과
    const rising = body(TILE, TILE * 2, 0, -400);
    expect(moveAndCollide(rising, 1 / 60, oneway, {}).onGround).toBe(false);
    expect(rising.box.y).toBeLessThan(TILE * 2);
  });

  it('아래 키를 누르면 한방향 발판을 통과한다', () => {
    const oneway = parseLevel(['    ', '====', '    ', '####']);
    const b = body(TILE, 0, 0, 400);
    const flags = moveAndCollide(b, 1 / 60, oneway, { dropThrough: true });
    expect(flags.onGround).toBe(false);
  });

  it('이동 발판 위에 올라타면 인덱스를 알려준다', () => {
    const empty = parseLevel(['    ', '    ', '    ']);
    const platform = { x: 0, y: TILE * 2, w: TILE * 3, h: 8 };
    const b = body(TILE, TILE * 2 - TILE - 2, 0, 400);
    const flags = moveAndCollide(b, 1 / 60, empty, { extraSolids: [platform] });
    expect(flags.onGround).toBe(true);
    expect(flags.groundPlatform).toBe(0);
  });

  it('isGrounded 는 접지 여부만 확인한다', () => {
    expect(isGrounded({ x: TILE, y: TILE * 2, w: TILE, h: TILE }, map)).toBe(true);
    expect(isGrounded({ x: TILE, y: 0, w: TILE, h: TILE }, map)).toBe(false);
  });

  it('보조 함수', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(10, 0, 3)).toBe(7);
    expect(approach(1, 1, 5)).toBe(1);
  });
});
