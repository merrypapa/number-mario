import { describe, expect, it, vi } from 'vitest';
import { TILE } from '../src/core/constants';
import { Input } from '../src/core/input';
import { Tile, getTile } from '../src/engine/tilemap';
import { World } from '../src/game/world';
import { numberStats } from '../src/game/shapes';
import type { LevelDef } from '../src/game/levels/data';

function makeWorld(rows: string[]) {
  const events = {
    onLevelClear: vi.fn(),
    onGameOver: vi.fn(),
    onLifeLost: vi.fn(),
  };
  const level: LevelDef = { id: 'T-1', name: '테스트', theme: 'field', time: 300, rows };
  const world = new World(events);
  world.load(level, 0, false);
  return { world, events };
}

/** 고정 스텝으로 n프레임 진행 */
function step(world: World, input: Input, frames: number): void {
  for (let i = 0; i < frames; i++) {
    world.update(1 / 60, input);
    input.endFrame();
  }
}

const FLAT = [
  '            ',
  '            ',
  '            ',
  ' P          ',
  '############',
];

describe('월드 통합', () => {
  it('플레이어는 지면 위에 안착한다', () => {
    const { world } = makeWorld(FLAT);
    const input = new Input();
    step(world, input, 30);
    expect(world.player.dead).toBe(false);
    expect(world.player.onGround).toBe(true);
    expect(world.player.box.y + world.player.box.h).toBeCloseTo(4 * TILE, 1);
  });

  it('오른쪽 키를 누르면 바닥을 유지한 채 전진한다', () => {
    const { world } = makeWorld(FLAT);
    const input = new Input();
    step(world, input, 10);
    const startX = world.player.box.x;
    input.press('right');
    step(world, input, 60);
    expect(world.player.box.x).toBeGreaterThan(startX + 40);
    expect(world.player.box.y + world.player.box.h).toBeCloseTo(4 * TILE, 1);
    expect(world.player.dead).toBe(false);
  });

  it('점프하면 떠올랐다가 다시 착지한다', () => {
    const { world } = makeWorld(FLAT);
    const input = new Input();
    step(world, input, 10);
    const groundY = world.player.box.y;
    input.press('jump');
    step(world, input, 12);
    expect(world.player.box.y).toBeLessThan(groundY - 20);
    input.release('jump');
    step(world, input, 90);
    expect(world.player.onGround).toBe(true);
  });

  it('코인을 먹으면 점수와 코인 수가 오른다', () => {
    const { world } = makeWorld([
      '            ',
      '            ',
      ' Po         ',
      '############',
    ]);
    const input = new Input();
    input.press('right');
    step(world, input, 40);
    expect(world.coins).toBe(1);
    expect(world.score).toBeGreaterThanOrEqual(100);
  });

  it('플러스 오브를 먹으면 숫자가 하나 커진다', () => {
    const { world } = makeWorld([
      '            ',
      '            ',
      ' P+         ',
      '############',
    ]);
    const input = new Input();
    input.press('right');
    step(world, input, 40);
    expect(world.player.number).toBe(2);
  });

  it('천장이 낮으면 커지지 않는다(끼임 방지)', () => {
    const { world } = makeWorld([
      '#####',
      '#####',
      ' P   ',
      '#####',
    ]);
    world.player.setNumber(1, true);
    expect(world.player.fitsAs(3)).toBe(false);
    world.player.setNumber(3);
    expect(world.player.number).toBe(1);
    expect(world.score).toBeGreaterThan(0); // 대신 점수로 보상
  });

  it('피격하면 숫자가 줄고 잠시 무적이 된다', () => {
    const { world } = makeWorld(FLAT);
    const input = new Input();
    step(world, input, 5);
    world.player.setNumber(4, true);
    world.player.hurt(1, 0);
    expect(world.player.number).toBe(3);
    expect(world.player.invuln).toBeGreaterThan(0);
    // 무적 중에는 추가 피해가 없다
    world.player.hurt(1, 0);
    expect(world.player.number).toBe(3);
  });

  it('숫자가 1일 때 맞으면 죽는다', () => {
    const { world, events } = makeWorld(FLAT);
    const input = new Input();
    step(world, input, 5);
    world.player.hurt(1, 0);
    expect(world.player.dead).toBe(true);
    expect(world.deaths).toBe(1);
    // 부활 대기 후 라이프가 하나 줄어든다
    step(world, input, 130);
    expect(world.lives).toBe(2);
    expect(events.onGameOver).not.toHaveBeenCalled();
  });

  it('나눗셈 방식 피해는 숫자를 절반으로 만든다', () => {
    const { world } = makeWorld(FLAT);
    const input = new Input();
    step(world, input, 5);
    world.player.setNumber(9, true);
    world.player.hurt(1, 0, 'halve');
    expect(world.player.number).toBe(4);
  });

  it('실드가 피해를 한 번 막아 준다', () => {
    const { world } = makeWorld(FLAT);
    const input = new Input();
    step(world, input, 5);
    world.player.setNumber(4, true);
    world.player.shieldTime = 2;
    world.player.hurt(1, 0);
    expect(world.player.number).toBe(4);
    expect(world.player.shieldTime).toBe(0);
  });

  it('아이템 블록을 치면 사용 상태가 되고 내용물이 나온다', () => {
    const { world } = makeWorld([
      ' ?  ',
      '    ',
      ' P  ',
      '####',
    ]);
    world.bumpTile(1, 0, world.player);
    expect(getTile(world.map, 1, 0)).toBe(Tile.Used);
    expect(world.coins).toBe(1);
    // 이미 사용한 블록은 다시 나오지 않는다
    world.bumpTile(1, 0, world.player);
    expect(world.coins).toBe(1);
  });

  it('오브가 든 블록(!)에서는 플러스 오브가 나온다', () => {
    const { world } = makeWorld([
      ' !  ',
      '    ',
      ' P  ',
      '####',
    ]);
    world.bumpTile(1, 0, world.player);
    expect(world.items.some((i) => i.kind === 'orb')).toBe(true);
  });

  it('블록에서 나온 오브는 공중에 멈추지 않고 주울 수 있는 곳까지 굴러떨어진다', () => {
    // 블록이 지면에서 4칸 위 — 오브가 블록 위에 그대로 있으면 닿을 수 없다
    const { world } = makeWorld([
      '          ',
      '          ',
      ' !        ',
      '          ',
      '          ',
      '          ',
      ' P        ',
      '##########',
    ]);
    const input = new Input();
    step(world, input, 10);
    world.bumpTile(1, 2, world.player);
    const orb = world.items.find((i) => i.kind === 'orb')!;
    expect(orb).toBeDefined();
    expect(orb.physics).toBe(true);
    step(world, input, 180);
    // 지면(7행) 위에 멈춰 있어야 한다
    expect(orb.physics).toBe(false);
    expect(orb.box.y + orb.box.h).toBeCloseTo(7 * TILE, 1);

    // 그리고 실제로 플레이어 점프 높이 안에 있다
    const stats = numberStats(world.player.number);
    const reach = (stats.jumpVel * stats.jumpVel) / (2 * stats.gravity);
    const orbTopAboveGround = 7 * TILE - orb.box.y;
    expect(orbTopAboveGround).toBeLessThan(reach + stats.heightPx);
  });

  it('아이템 블록의 코인은 한 번만 계산된다', () => {
    const { world } = makeWorld([
      ' ?  ',
      '    ',
      ' P  ',
      '####',
    ]);
    world.bumpTile(1, 0, world.player);
    expect(world.coins).toBe(1);
    // 주울 수 있는 코인 아이템이 남지 않는다(중복 획득 방지)
    expect(world.items.some((i) => i.kind === 'coin')).toBe(false);
    const input = new Input();
    step(world, input, 60);
    expect(world.coins).toBe(1);
  });

  it('모든 숫자가 지면 4칸 위 아이템 블록에 머리가 닿는다', () => {
    for (let n = 1; n <= 10; n++) {
      const stats = numberStats(n);
      const reach = (stats.jumpVel * stats.jumpVel) / (2 * stats.gravity);
      // 지면 위 4칸 지점이 블록 밑면. 서 있을 때 머리에서 거기까지의 거리
      const need = 4 * TILE - stats.heightPx;
      expect(reach, `숫자 ${n}`).toBeGreaterThan(need);
    }
  });

  it('작은 숫자는 벽돌을 부수지 못한다', () => {
    const { world } = makeWorld([' B  ', '    ', ' P  ', '####']);
    world.player.setNumber(1, true);
    world.bumpTile(1, 0, world.player);
    expect(getTile(world.map, 1, 0)).toBe(Tile.Brick);
    world.player.setNumber(4, true);
    world.bumpTile(1, 0, world.player);
    expect(getTile(world.map, 1, 0)).toBe(Tile.Empty);
  });

  it('롤링(6)은 앞의 벽돌을 부순다', () => {
    const { world } = makeWorld([
      '     ',
      '  BB ',
      ' PBB ',
      '#####',
    ]);
    const input = new Input();
    step(world, input, 5);
    world.player.setNumber(6, true);
    world.player.facing = 1;
    const broke = world.breakWallAhead(world.player);
    expect(broke).toBe(true);
    expect(getTile(world.map, 2, 2)).toBe(Tile.Empty);
  });

  it('슬램(9)은 발밑 벽돌을 부순다', () => {
    const { world } = makeWorld([
      '       ',
      '       ',
      '  P    ',
      ' BBBBB ',
      '#######',
    ]);
    const input = new Input();
    step(world, input, 8);
    world.player.setNumber(9, true);
    world.slamShockwave(world.player);
    expect(getTile(world.map, 2, 3)).toBe(Tile.Empty);
  });

  it('무지개 다리(7)는 발판을 만들고 시간이 지나면 사라진다', () => {
    const { world } = makeWorld([
      '        ',
      '        ',
      ' P      ',
      '##      ',
    ]);
    const input = new Input();
    step(world, input, 8);
    world.player.facing = 1;
    world.buildRainbowBridge(world.player);
    expect(getTile(world.map, 2, 3)).toBe(Tile.Rainbow);
    for (let i = 0; i < 60 * 12; i++) world.update(1 / 60, input);
    expect(getTile(world.map, 2, 3)).toBe(Tile.Empty);
  });

  it('적을 밟으면 처치하고 점수를 얻는다', () => {
    const { world } = makeWorld([
      '        ',
      '        ',
      ' P m    ',
      '########',
    ]);
    const input = new Input();
    step(world, input, 5);
    const enemy = world.enemies[0];
    // 적 바로 위에서 낙하시켜 밟기 판정을 만든다
    world.player.box.x = enemy.box.x;
    world.player.box.y = enemy.box.y - world.player.box.h - 2;
    world.player.vy = 300;
    step(world, input, 3);
    expect(world.enemies.some((e) => e.alive)).toBe(false);
    expect(world.score).toBeGreaterThanOrEqual(200);
  });

  it('적에게 옆에서 부딪히면 피해를 입는다', () => {
    const { world } = makeWorld([
      '        ',
      '        ',
      ' P m    ',
      '########',
    ]);
    const input = new Input();
    step(world, input, 5);
    world.player.setNumber(5, true);
    input.press('right');
    step(world, input, 60);
    expect(world.player.number).toBeLessThan(5);
  });

  it('시간이 모두 지나면 죽는다', () => {
    const { world } = makeWorld(FLAT);
    const input = new Input();
    world.timeLeft = 0.02;
    step(world, input, 5);
    expect(world.player.dead).toBe(true);
  });

  it('골에 닿으면 클리어 이벤트가 발생한다', () => {
    const { world, events } = makeWorld([
      '        ',
      '        ',
      ' PF     ',
      '########',
    ]);
    const input = new Input();
    input.press('right');
    step(world, input, 40);
    expect(events.onLevelClear).toHaveBeenCalledTimes(1);
    expect(world.cleared).toBe(true);
  });

  it('숫자 패드는 해당 숫자로 바꿔 준다', () => {
    const { world } = makeWorld([
      '            ',
      '            ',
      ' P 7        ',
      '############',
    ]);
    const input = new Input();
    input.press('right');
    step(world, input, 60);
    expect(world.player.number).toBe(7);
  });

  it('낙사하면 죽는다', () => {
    const { world } = makeWorld([
      ' P  ',
      '#   ',
      '    ',
      '    ',
    ]);
    const input = new Input();
    input.press('right');
    step(world, input, 200);
    expect(world.player.dead || world.deaths > 0).toBe(true);
  });

  it('5개 실제 스테이지 모두 로드되고 30초를 시뮬레이션해도 오류가 없다', async () => {
    const { LEVELS } = await import('../src/game/levels/data');
    for (const level of LEVELS) {
      const events = { onLevelClear: vi.fn(), onGameOver: vi.fn(), onLifeLost: vi.fn() };
      const world = new World(events);
      world.load(level, 0, false);
      const input = new Input();
      input.press('right');
      for (let i = 0; i < 60 * 30; i++) {
        world.update(1 / 60, input);
        input.endFrame();
        if (i % 90 === 0) {
          input.press('jump');
        } else if (i % 90 === 6) {
          input.release('jump');
        }
      }
      expect(Number.isFinite(world.player.box.x)).toBe(true);
      expect(Number.isFinite(world.player.box.y)).toBe(true);
    }
  });
});
