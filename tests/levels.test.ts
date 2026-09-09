import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/game/levels/data';
import { Tile, getTile, isSolidAt, parseLevel } from '../src/engine/tilemap';
import { numberStats } from '../src/game/shapes';

const KNOWN_CHARS = new Set([' ', '#', 'B', '?', '!', '=', '^', 'L', 'S',
  'P', 'F', 'C', 'o', '+', 'H', 'm', 'b', 'z', 'Z', 'D', 'V',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

/** 지면 위에 서 있어야 하는 스폰 종류 */
const GROUNDED = new Set(['player', 'numberpad', 'minusbug', 'zeroslime', 'checkpoint', 'goal']);

describe('레벨 데이터 무결성', () => {
  it('튜토리얼 스테이지(1-1)의 낙하 구멍은 2칸 이하다', () => {
    // 어린이도 넘을 수 있도록 첫 스테이지만 더 좁게 유지한다
    const level = LEVELS[0];
    const map = parseLevel(level.rows);
    const holeCols: number[] = [];
    for (let tx = 0; tx < map.w; tx++) {
      let empty = true;
      for (let ty = 13; ty < map.h; ty++) {
        if (getTile(map, tx, ty) !== Tile.Empty) {
          empty = false;
          break;
        }
      }
      if (empty) holeCols.push(tx);
    }
    let width = 0;
    let prev = -99;
    for (const tx of holeCols) {
      width = tx === prev + 1 ? width + 1 : 1;
      prev = tx;
      expect(width, `1-1 의 ${tx}번 칸 근처 구멍이 너무 넓다`).toBeLessThanOrEqual(2);
    }
    expect(holeCols.length).toBeGreaterThan(0); // 구멍이 아예 없어지지는 않았는지
  });

  it('5개 스테이지가 정의되어 있다', () => {
    expect(LEVELS.length).toBe(5);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(5);
  });

  for (const level of LEVELS) {
    describe(`${level.id} ${level.name}`, () => {
      const map = parseLevel(level.rows);

      it('알 수 없는 문자가 없다', () => {
        for (const row of level.rows) {
          for (const ch of row) {
            expect(KNOWN_CHARS.has(ch), `'${ch}' in ${level.id}`).toBe(true);
          }
        }
      });

      it('시작 지점이 정확히 하나다', () => {
        expect(map.spawns.filter((s) => s.kind === 'player').length).toBe(1);
      });

      it('골 또는 보스가 있다', () => {
        const goals = map.spawns.filter((s) => s.kind === 'goal' || s.kind === 'boss');
        expect(goals.length).toBeGreaterThan(0);
      });

      it('스폰이 벽 속에 파묻혀 있지 않다', () => {
        for (const s of map.spawns) {
          if (s.kind === 'orbblock') continue;
          expect(isSolidAt(map, s.tx, s.ty), `${s.kind} @${s.tx},${s.ty}`).toBe(false);
        }
      });

      it('바닥이 필요한 오브젝트는 발판 위에 있다', () => {
        for (const s of map.spawns) {
          if (!GROUNDED.has(s.kind)) continue;
          let supported = false;
          for (let dy = 1; dy <= 3; dy++) {
            if (isSolidAt(map, s.tx, s.ty + dy)) {
              supported = true;
              break;
            }
          }
          expect(supported, `${s.kind} @${s.tx},${s.ty} 아래에 발판 없음`).toBe(true);
        }
      });

      it('낭떠러지는 3칸 이하이거나 발판·무지개 다리로 건널 수 있다', () => {
        const hasBridgePad = map.spawns.some((s) => s.kind === 'numberpad' && s.value === 7);
        const bottomless: number[] = [];
        for (let tx = 0; tx < map.w; tx++) {
          let solid = false;
          for (let ty = 0; ty < map.h; ty++) {
            const t = getTile(map, tx, ty);
            if (isSolidAt(map, tx, ty) || t === Tile.OneWay || t === Tile.Lava) {
              solid = true;
              break;
            }
          }
          if (!solid) bottomless.push(tx);
        }
        // 연속 구간으로 묶는다
        let runStart = -1;
        let prev = -99;
        const gaps: Array<[number, number]> = [];
        for (const tx of bottomless) {
          if (tx !== prev + 1) {
            if (runStart >= 0) gaps.push([runStart, prev]);
            runStart = tx;
          }
          prev = tx;
        }
        if (runStart >= 0) gaps.push([runStart, prev]);

        for (const [a, b] of gaps) {
          const width = b - a + 1;
          if (width <= 3) continue;
          const hasPlatform = map.spawns.some(
            (s) => (s.kind === 'platformH' || s.kind === 'platformV') && s.tx >= a - 6 && s.tx <= b + 6,
          );
          expect(hasBridgePad || hasPlatform, `${level.id}: ${a}~${b} (${width}칸) 건널 수단 없음`).toBe(true);
          expect(width).toBeLessThanOrEqual(12);
        }
      });

      it('플레이어 시작 지점에 가장 큰 몸도 들어간다', () => {
        const spawn = map.spawns.find((s) => s.kind === 'player')!;
        const stats = numberStats(10);
        for (let dy = 0; dy < stats.rows; dy++) {
          for (let dx = 0; dx < stats.cols; dx++) {
            expect(isSolidAt(map, spawn.tx + dx - 1, spawn.ty - dy)).toBe(false);
          }
        }
      });
    });
  }
});
