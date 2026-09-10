import { describe, expect, it, vi } from 'vitest';
import { ENDING_LINES, NUMBER_LINES, PROLOGUE, STAGE_STORY, numberLine, stageStory } from '../src/game/story';
import { LEVELS } from '../src/game/levels/data';
import { World, NUMBER_BANNER_TIME } from '../src/game/world';
import { Input } from '../src/core/input';

describe('서사 텍스트', () => {
  it('프롤로그가 순서대로 있다', () => {
    expect(PROLOGUE.length).toBeGreaterThanOrEqual(3);
    for (const page of PROLOGUE) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.lines.length).toBeGreaterThan(0);
      for (const line of page.lines) expect(line.trim().length).toBeGreaterThan(0);
    }
  });

  it('1부터 10까지 모든 숫자에 문장이 있다', () => {
    for (let n = 1; n <= 10; n++) {
      const info = numberLine(n);
      expect(info, `숫자 ${n}`).toBeDefined();
      expect(info!.name.length).toBeGreaterThan(0);
      expect(info!.line.length).toBeGreaterThan(0);
    }
    expect(Object.keys(NUMBER_LINES)).toHaveLength(10);
  });

  it('모든 스테이지에 시작·마무리 내레이션이 있다', () => {
    for (const level of LEVELS) {
      const story = stageStory(level.id);
      expect(story, `${level.id} 내레이션 없음`).toBeDefined();
      expect(story!.open.length).toBeGreaterThan(0);
      expect(story!.clear.length).toBeGreaterThan(0);
    }
    // 쓰이지 않는 내레이션이 남아 있지 않은지
    const ids = new Set(LEVELS.map((l) => l.id));
    for (const id of Object.keys(STAGE_STORY)) expect(ids.has(id), `${id} 는 없는 스테이지`).toBe(true);
  });

  it('엔딩이 0 의 자리를 설명하며 끝난다', () => {
    expect(ENDING_LINES.length).toBeGreaterThanOrEqual(5);
    expect(ENDING_LINES.join(' ')).toContain('자리');
  });
});

describe('숫자 문장 배너', () => {
  /** 대입 직후 타입이 좁혀지지 않도록 함수로 읽는다 */
  const bannerNumber = (w: World): number | null => w.numberBanner?.n ?? null;

  function makeWorld() {
    const events = { onLevelClear: vi.fn(), onGameOver: vi.fn(), onLifeLost: vi.fn() };
    const world = new World(events);
    world.load(
      { id: '1-1', name: '테스트', theme: 'field', time: 300, rows: ['        ', '        ', ' P+     ', '########'] },
      0,
      false,
    );
    return world;
  }

  it('시작하면 1의 문장이 뜬다', () => {
    const world = makeWorld();
    expect(bannerNumber(world)).toBe(1);
  });

  it('시간이 지나면 사라진다', () => {
    const world = makeWorld();
    const input = new Input();
    for (let i = 0; i < Math.ceil(NUMBER_BANNER_TIME * 60) + 10; i++) {
      world.update(1 / 60, input);
      input.endFrame();
    }
    expect(world.numberBanner).toBeNull();
  });

  it('새 숫자가 되면 그 숫자의 문장이 뜬다', () => {
    const world = makeWorld();
    world.numberBanner = null;
    world.player.setNumber(3);
    expect(bannerNumber(world)).toBe(3);
  });

  it('같은 숫자는 한 판에 한 번만 뜬다', () => {
    const world = makeWorld();
    world.player.setNumber(3);
    world.numberBanner = null;
    world.player.setNumber(1);
    world.player.setNumber(3);
    expect(bannerNumber(world)).toBeNull();
  });

  it('피격으로 숫자가 줄 때는 뜨지 않는다', () => {
    const world = makeWorld();
    world.player.setNumber(5, true);
    world.numberBanner = null;
    world.player.hurt(1, 0);
    expect(bannerNumber(world)).toBeNull();
  });
});
