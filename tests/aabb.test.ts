import { describe, expect, it } from 'vitest';
import { isStompingFrom, makeBox, overlapArea, overlaps, inflate, containsPoint } from '../src/engine/aabb';

describe('AABB', () => {
  it('겹치는 두 박스를 감지한다', () => {
    expect(overlaps(makeBox(0, 0, 10, 10), makeBox(5, 5, 10, 10))).toBe(true);
  });

  it('변끼리 닿기만 하면 겹친 것이 아니다', () => {
    expect(overlaps(makeBox(0, 0, 10, 10), makeBox(10, 0, 10, 10))).toBe(false);
  });

  it('겹침 넓이를 계산한다', () => {
    expect(overlapArea(makeBox(0, 0, 10, 10), makeBox(5, 5, 10, 10))).toBe(25);
    expect(overlapArea(makeBox(0, 0, 10, 10), makeBox(50, 50, 10, 10))).toBe(0);
  });

  it('박스를 확장한다', () => {
    expect(inflate(makeBox(10, 10, 4, 4), 2)).toEqual({ x: 8, y: 8, w: 8, h: 8 });
  });

  it('점 포함 여부를 판정한다', () => {
    expect(containsPoint(makeBox(0, 0, 10, 10), 5, 5)).toBe(true);
    expect(containsPoint(makeBox(0, 0, 10, 10), 11, 5)).toBe(false);
  });

  describe('밟기 판정', () => {
    const enemy = makeBox(0, 100, 24, 20);

    it('낙하 중 적의 윗면에 닿으면 밟은 것이다', () => {
      const player = makeBox(4, 84, 24, 24); // 발끝 108 → 적 상단 100 근처
      expect(isStompingFrom(player, enemy, 300)).toBe(true);
    });

    it('상승 중에는 밟기가 아니다', () => {
      const player = makeBox(4, 84, 24, 24);
      expect(isStompingFrom(player, enemy, -300)).toBe(false);
    });

    it('옆에서 부딪히면 밟기가 아니다', () => {
      const player = makeBox(4, 104, 24, 24); // 발끝이 적 아래쪽까지 내려옴
      expect(isStompingFrom(player, enemy, 60)).toBe(false);
    });
  });
});
