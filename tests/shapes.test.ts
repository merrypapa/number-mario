import { describe, expect, it } from 'vitest';
import { MAX_NUMBER, MIN_NUMBER, TILE } from '../src/core/constants';
import { SHAPES, clampNumber, halveNumber, numberStats, shapeOf } from '../src/game/shapes';

const numbers = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1);

describe('숫자 블록 형태', () => {
  it('블록 개수는 항상 숫자와 같다', () => {
    for (const n of numbers) expect(SHAPES[n].length).toBe(n);
  });

  it('같은 칸이 중복되지 않는다', () => {
    for (const n of numbers) {
      const keys = new Set(SHAPES[n].map((c) => `${c.col},${c.row}`));
      expect(keys.size).toBe(n);
    }
  });

  it('히트박스는 3칸 폭 × 4칸 높이를 넘지 않는다', () => {
    for (const n of numbers) {
      const s = numberStats(n);
      expect(s.cols).toBeLessThanOrEqual(3);
      expect(s.rows).toBeLessThanOrEqual(4);
      expect(s.widthPx).toBe(s.cols * TILE);
      expect(s.heightPx).toBe(s.rows * TILE);
    }
  });

  it('바닥 줄이 비어 있지 않다(공중에 뜬 형태 금지)', () => {
    for (const n of numbers) {
      expect(SHAPES[n].some((c) => c.row === 0)).toBe(true);
    }
  });

  it('숫자가 클수록 느리고 무겁다', () => {
    for (let n = 1; n < MAX_NUMBER; n++) {
      expect(numberStats(n + 1).moveSpeed).toBeLessThan(numberStats(n).moveSpeed);
      expect(numberStats(n + 1).gravity).toBeGreaterThan(numberStats(n).gravity);
    }
  });

  it('어떤 숫자든 제 키만큼은 뛸 수 있다', () => {
    for (const n of numbers) {
      const s = numberStats(n);
      const jumpHeight = (s.jumpVel * s.jumpVel) / (2 * s.gravity);
      expect(jumpHeight).toBeGreaterThan(2 * TILE);
    }
  });

  it('숫자를 범위 안으로 자른다', () => {
    expect(clampNumber(0)).toBe(MIN_NUMBER);
    expect(clampNumber(99)).toBe(MAX_NUMBER);
    expect(clampNumber(4.4)).toBe(4);
  });

  it('절반 계산은 내림이며 1 아래로 내려가지 않는다', () => {
    expect(halveNumber(10)).toBe(5);
    expect(halveNumber(7)).toBe(3);
    expect(halveNumber(1)).toBe(1);
  });

  it('shapeOf 는 범위를 벗어난 값도 안전하게 처리한다', () => {
    expect(shapeOf(0)).toBe(SHAPES[1]);
    expect(shapeOf(50)).toBe(SHAPES[10]);
  });
});
