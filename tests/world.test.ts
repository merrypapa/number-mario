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

  it('2칸 구멍은 어떤 숫자로도, 정지 상태에서 점프해도 건널 수 있다', () => {
    for (let n = 1; n <= 10; n++) {
      const { world } = makeWorld([
        '                    ',
        '                    ',
        '                    ',
        '                    ',
        ' P                  ',
        '########  ##########', // 8~9번 칸이 2칸 구멍
      ]);
      const input = new Input();
      step(world, input, 10);
      world.player.setNumber(n, true);
      // 달려오지 않고 구멍 바로 앞에 선 상태에서 점프 (가장 불리한 조건)
      world.player.box.x = 8 * TILE - world.player.box.w;
      world.player.box.y = 5 * TILE - world.player.box.h;
      world.player.vx = 0;
      world.player.vy = 0;
      step(world, input, 2);

      input.press('jump');
      input.press('right');
      step(world, input, 90);

      expect(world.player.dead, `숫자 ${n} 이 2칸 구멍에 빠짐`).toBe(false);
      expect(world.player.box.x, `숫자 ${n} 이 구멍을 못 건넘`).toBeGreaterThanOrEqual(10 * TILE - 2);
    }
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

describe('어린이 모드 사다리', () => {
  const PIT_LEVEL = [
    '            ',
    '            ',
    '            ',
    ' P          ',
    '####   #####', // 4~6번 칸이 낭떠러지
  ];

  function loadWith(rows: string[], kid: boolean) {
    const events = { onLevelClear: vi.fn(), onGameOver: vi.fn(), onLifeLost: vi.fn() };
    const world = new World(events);
    world.kidMode = kid;
    world.load({ id: 'T', name: '테스트', theme: 'field', time: 300, rows }, 0, false);
    return world;
  }

  it('어린이 모드가 꺼져 있으면 낭떠러지는 그대로다', () => {
    const world = loadWith(PIT_LEVEL, false);
    for (const tx of [4, 5, 6]) expect(getTile(world.map, tx, 4)).toBe(Tile.Empty);
  });

  it('어린이 모드를 켜면 낭떠러지에 사다리가 깔린다', () => {
    const world = loadWith(PIT_LEVEL, true);
    for (const tx of [4, 5, 6]) expect(getTile(world.map, tx, 4)).toBe(Tile.KidBridge);
    // 원래 지면은 건드리지 않는다
    expect(getTile(world.map, 0, 4)).toBe(Tile.Ground);
  });

  it('사다리 위를 걸어서 낭떠러지를 건널 수 있다(점프 없이)', () => {
    const world = loadWith(PIT_LEVEL, true);
    const input = new Input();
    input.press('right');
    step(world, input, 120);
    expect(world.player.dead).toBe(false);
    expect(world.player.box.x).toBeGreaterThan(7 * TILE);
  });

  it('용암 구덩이에도 사다리를 놓아 건너게 한다', () => {
    const world = loadWith([
      '            ',
      '            ',
      '            ',
      ' P          ',
      '####LLL#####',
      '####LLL#####',
    ], true);
    for (const tx of [4, 5, 6]) expect(getTile(world.map, tx, 4)).toBe(Tile.KidBridge);
  });

  it('양쪽 지면 높이가 다르면 낮은 쪽에 맞춘다', () => {
    const world = loadWith([
      '            ',
      '            ',
      '####        ',
      '####   #####', // 왼쪽 바닥 2행, 오른쪽 3행
      '####   #####',
    ], true);
    for (const tx of [4, 5, 6]) expect(getTile(world.map, tx, 3)).toBe(Tile.KidBridge);
  });

  it('실제 5개 스테이지 모두 사다리가 깔리고 낙사 구멍이 사라진다', async () => {
    const { LEVELS } = await import('../src/game/levels/data');
    for (const level of LEVELS) {
      const world = loadWith(level.rows, true);
      for (let tx = 0; tx < world.map.w; tx++) {
        let hasFloor = false;
        for (let ty = Math.floor(world.map.h / 2); ty < world.map.h; ty++) {
          if (getTile(world.map, tx, ty) !== Tile.Empty) {
            hasFloor = true;
            break;
          }
        }
        expect(hasFloor, `${level.id} 의 ${tx}번 칸에 바닥이 없다`).toBe(true);
      }
    }
  });
});

describe('매직 넘버(무적)', () => {
  function magicWorld(rows: string[]) {
    const events = { onLevelClear: vi.fn(), onGameOver: vi.fn(), onLifeLost: vi.fn() };
    const world = new World(events);
    world.load({ id: 'T', name: '테스트', theme: 'field', time: 300, rows }, 0, false);
    world.magicNumber = true;
    return world;
  }

  it('적에게 부딪혀도 다치지 않고 오히려 적을 물리친다', () => {
    const world = magicWorld([
      '        ',
      '        ',
      ' P m    ',
      '########',
    ]);
    const input = new Input();
    step(world, input, 5);
    world.player.setNumber(3, true);
    input.press('right');
    step(world, input, 60);
    expect(world.player.number).toBe(3);
    expect(world.player.dead).toBe(false);
    expect(world.enemies.some((e) => e.alive)).toBe(false);
  });

  it('가시와 용암에 닿아도 죽지 않는다', () => {
    const world = magicWorld([
      '        ',
      '        ',
      ' P ^ L  ',
      '########',
    ]);
    const input = new Input();
    step(world, input, 5);
    world.player.setNumber(4, true);
    input.press('right');
    step(world, input, 90);
    expect(world.player.dead).toBe(false);
    expect(world.player.number).toBe(4);
  });

  it('떨어져도 죽지 않고 마지막 안전 지점으로 돌아온다', () => {
    const world = magicWorld([
      '        ',
      '        ',
      ' P      ',
      '###     ',
    ]);
    const input = new Input();
    step(world, input, 10);
    const safeX = world.player.centerX;
    input.press('right');
    step(world, input, 200);
    expect(world.player.dead).toBe(false);
    expect(world.deaths).toBe(0);
    expect(world.lives).toBe(3);
    expect(Math.abs(world.player.centerX - safeX)).toBeLessThan(3 * TILE);
  });

  it('꺼져 있으면 평소대로 죽는다', () => {
    const world = magicWorld([
      '        ',
      '        ',
      ' P      ',
      '###     ',
    ]);
    world.magicNumber = false;
    const input = new Input();
    step(world, input, 10);
    input.press('right');
    step(world, input, 200);
    expect(world.deaths).toBeGreaterThan(0);
  });
});

describe('밟기 판정', () => {
  /** 실제 보스 아레나(1-5)를 그대로 쓴다 */
  async function bossWorld() {
    const { LEVELS } = await import('../src/game/levels/data');
    const events = { onLevelClear: vi.fn(), onGameOver: vi.fn(), onLifeLost: vi.fn() };
    const world = new World(events);
    world.load(LEVELS[4], 4, false);
    return world;
  }

  /** 적의 머리 위에서 떨어뜨려 밟게 한다 */
  function dropOn(world: World, target: { box: { x: number; y: number; w: number; h: number } }): void {
    const p = world.player;
    p.box.x = target.box.x + target.box.w / 2 - p.box.w / 2;
    p.box.y = target.box.y - p.box.h - 4;
    p.vx = 0;
    p.vy = 300;
    p.invuln = 0;
  }

  it('매직 넘버(무적)를 켜도 보스를 밟을 수 있다', async () => {
    const world = await bossWorld();
    const input = new Input();
    step(world, input, 20);
    world.magicNumber = true;
    const boss = world.boss!;
    expect(boss.hp).toBe(3);
    dropOn(world, boss);
    step(world, input, 3);
    expect(boss.hp).toBe(2);
  });

  it('매직 넘버로 세 번 밟아 보스를 쓰러뜨릴 수 있다', async () => {
    const world = await bossWorld();
    const input = new Input();
    step(world, input, 20);
    world.magicNumber = true;
    const boss = world.boss!;
    for (let i = 0; i < 3; i++) {
      // 보스가 소환한 슬라임을 대신 밟지 않도록 정리하고, 무적도 풀어 둔다
      world.enemies = world.enemies.filter((e) => e.kind === 'boss');
      boss.invuln = 0;
      dropOn(world, boss);
      step(world, input, 3);
    }
    expect(boss.hp).toBeLessThanOrEqual(0);
    expect(boss.defeated).toBe(true);
    expect(world.items.some((i) => i.kind === 'goal')).toBe(true);
    expect(world.player.dead).toBe(false);
  });

  it('보스를 밟아도 플레이어는 피해를 입지 않는다', async () => {
    const world = await bossWorld();
    const input = new Input();
    step(world, input, 20);
    world.player.setNumber(4, true);
    const boss = world.boss!;
    dropOn(world, boss);
    step(world, input, 20); // 튀어 오르는 동안 계속 겹쳐 있는 구간
    expect(boss.hp).toBe(2);
    expect(world.player.number).toBe(4);
    expect(world.player.dead).toBe(false);
  });

  it('숫자 1이어도 보스를 밟다가 죽지 않는다', async () => {
    const world = await bossWorld();
    const input = new Input();
    step(world, input, 20);
    expect(world.player.number).toBe(1);
    dropOn(world, world.boss!);
    step(world, input, 20);
    expect(world.player.dead).toBe(false);
    expect(world.deaths).toBe(0);
  });

  it('제로슬라임을 밟아도 피해를 입지 않는다', () => {
    const events = { onLevelClear: vi.fn(), onGameOver: vi.fn(), onLifeLost: vi.fn() };
    const world = new World(events);
    world.load(
      { id: 'S', name: '슬라임', theme: 'cave', time: 300, rows: ['        ', '        ', ' P  z   ', '########'] },
      0,
      false,
    );
    const input = new Input();
    step(world, input, 20);
    world.player.setNumber(5, true);
    const slime = world.enemies[0];
    dropOn(world, slime);
    step(world, input, 20);
    expect(world.player.number).toBe(5); // 슬라임은 접촉 시 −2
    expect(world.player.dead).toBe(false);
  });

  it('유예는 접촉이 없으면 사라진다', async () => {
    const world = await bossWorld();
    const input = new Input();
    step(world, input, 20);
    const boss = world.boss!;
    boss.stompGrace = 0.35;
    world.player.box.x = 3 * TILE; // 보스에게서 멀리 떨어져 있기
    step(world, input, 40);
    expect(boss.stompGrace).toBe(0);
  });

  it('유예가 끝난 뒤 옆에서 부딪히면 피해를 입는다(무적이 되어 버리지 않는다)', async () => {
    const world = await bossWorld();
    const input = new Input();
    step(world, input, 20);
    world.player.setNumber(6, true);
    const boss = world.boss!;
    boss.stompGrace = 0;
    boss.invuln = 0;
    // 머리 위가 아니라 몸통 옆에 밀착시킨다
    const p = world.player;
    p.box.x = boss.box.x;
    p.box.y = boss.box.y + boss.box.h - p.box.h;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 0;
    step(world, input, 2);
    expect(world.player.number).toBeLessThan(6);
  });
});

describe('파이프(하수구)와 보너스 방', () => {
  async function realWorld(index: number) {
    const { LEVELS } = await import('../src/game/levels/data');
    const events = { onLevelClear: vi.fn(), onGameOver: vi.fn(), onLifeLost: vi.fn() };
    const world = new World(events);
    world.load(LEVELS[index], index, false);
    return world;
  }

  /** 플레이어를 파이프 윗면에 세운다 */
  function standOnPipe(world: World): { x: number; y: number } {
    const pipe = world.pipes.find((p) => p.kind === 'enter')!;
    const p = world.player;
    p.box.x = pipe.box.x + pipe.box.w / 2 - p.box.w / 2;
    p.box.y = pipe.box.y + 2 - p.box.h;
    p.vx = 0;
    p.vy = 0;
    return { x: p.centerX, y: p.box.y + p.box.h };
  }

  it('1-4 를 뺀 스테이지마다 들어갈 파이프와 보너스 방이 있다', async () => {
    const { LEVELS } = await import('../src/game/levels/data');
    for (const level of LEVELS.slice(0, 4)) {
      expect(level.bonus, `${level.id} 보너스 방 없음`).toBeDefined();
      const events = { onLevelClear: vi.fn(), onGameOver: vi.fn(), onLifeLost: vi.fn() };
      const w = new World(events);
      w.load(level, 0, false);
      expect(w.pipes.some((p) => p.kind === 'enter'), `${level.id} 입구 파이프 없음`).toBe(true);
    }
  });

  it('보너스 방에는 반드시 나가는 파이프가 있다', async () => {
    const { LEVELS } = await import('../src/game/levels/data');
    for (const level of LEVELS.slice(0, 4)) {
      const events = { onLevelClear: vi.fn(), onGameOver: vi.fn(), onLifeLost: vi.fn() };
      const w = new World(events);
      w.load(level, 0, false);
      const input = new Input();
      step(w, input, 5);
      standOnPipe(w);
      input.press('down');
      step(w, input, 90);
      expect(w.inBonus, `${level.id} 보너스 방 진입 실패`).toBe(true);
      expect(w.pipes.some((p) => p.kind === 'exit'), `${level.id} 출구 파이프 없음`).toBe(true);
    }
  });

  it('아래를 눌러 파이프로 들어가고 다시 나올 수 있다', async () => {
    const world = await realWorld(0);
    const input = new Input();
    step(world, input, 5);
    const entry = standOnPipe(world);
    expect(world.inBonus).toBe(false);

    input.press('down');
    step(world, input, 90); // 내려가는 연출 + 올라오는 연출
    input.release('down');
    expect(world.inBonus).toBe(true);
    expect(world.player.dead).toBe(false);

    // 보너스 방의 나가는 파이프로 되돌아온다
    const exit = world.pipes.find((p) => p.kind === 'exit')!;
    const p = world.player;
    p.box.x = exit.box.x + exit.box.w / 2 - p.box.w / 2;
    p.box.y = exit.box.y + 2 - p.box.h;
    p.vx = 0;
    p.vy = 0;
    step(world, input, 5);
    input.press('down');
    step(world, input, 90);
    expect(world.inBonus).toBe(false);
    // 들어갔던 자리 근처로 돌아온다
    expect(Math.abs(world.player.centerX - entry.x)).toBeLessThan(3 * TILE);
  });

  it('보너스 방에서 모은 코인은 나와도 남는다', async () => {
    const world = await realWorld(0);
    const input = new Input();
    step(world, input, 5);
    standOnPipe(world);
    input.press('down');
    step(world, input, 90);
    input.release('down');
    expect(world.inBonus).toBe(true);

    const before = world.coins;
    // 방 안의 코인을 직접 주워 본다
    const coin = world.items.find((i) => i.kind === 'coin')!;
    world.player.box.x = coin.box.x;
    world.player.box.y = coin.box.y;
    step(world, input, 3);
    expect(world.coins).toBe(before + 1);

    const exit = world.pipes.find((p) => p.kind === 'exit')!;
    world.player.box.x = exit.box.x + TILE - world.player.box.w / 2;
    world.player.box.y = exit.box.y + 2 - world.player.box.h;
    world.player.vy = 0;
    step(world, input, 5);
    input.press('down');
    step(world, input, 90);
    expect(world.inBonus).toBe(false);
    expect(world.coins).toBe(before + 1); // 나와도 그대로
  });

  it('본 스테이지에서 모은 코인은 보너스 방에 들어가도 유지된다', async () => {
    const world = await realWorld(0);
    const input = new Input();
    step(world, input, 5);
    world.coins = 7;
    world.score = 700;
    standOnPipe(world);
    input.press('down');
    step(world, input, 90);
    expect(world.inBonus).toBe(true);
    expect(world.coins).toBe(7);
    expect(world.score).toBe(700);
  });

  it('보너스 방이 없는 보스 스테이지에서는 파이프가 없다', async () => {
    const world = await realWorld(4);
    expect(world.level.bonus).toBeUndefined();
    expect(world.pipes.length).toBe(0);
  });
});
