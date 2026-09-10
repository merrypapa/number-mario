import { describe, expect, it } from 'vitest';
import { DEAD_ZONE, VERTICAL_ZONE, clampToRadius, stickDirections } from '../src/ui/joystick';

const R = 100;

describe('가상 조이스틱', () => {
  it('가운데는 아무 방향도 아니다', () => {
    expect(stickDirections(0, 0, R)).toEqual({ left: false, right: false, up: false, down: false });
  });

  it('데드존 안에서는 반응하지 않는다', () => {
    const d = stickDirections(R * (DEAD_ZONE - 0.05), R * 0.1, R);
    expect(d.left || d.right || d.up || d.down).toBe(false);
  });

  it('좌우를 인식한다', () => {
    expect(stickDirections(R, 0, R)).toMatchObject({ right: true, left: false });
    expect(stickDirections(-R, 0, R)).toMatchObject({ left: true, right: false });
  });

  it('위아래를 인식한다', () => {
    expect(stickDirections(0, R, R)).toMatchObject({ down: true, up: false });
    expect(stickDirections(0, -R, R)).toMatchObject({ up: true, down: false });
  });

  it('대각선은 두 방향을 함께 낸다', () => {
    const d = stickDirections(R * 0.5, R * 0.8, R);
    expect(d.right).toBe(true);
    expect(d.down).toBe(true);
  });

  it('가로가 우세하면 세로는 무시한다(달리다 실수로 발판 통과 방지)', () => {
    const d = stickDirections(R * 0.95, R * 0.6, R);
    expect(d.right).toBe(true);
    expect(d.down).toBe(false);
  });

  it('세로는 가로보다 더 많이 기울여야 인정된다', () => {
    expect(stickDirections(0, R * (VERTICAL_ZONE - 0.05), R).down).toBe(false);
    expect(stickDirections(0, R * (VERTICAL_ZONE + 0.05), R).down).toBe(true);
  });

  it('반경이 0이면 안전하게 중립', () => {
    expect(stickDirections(10, 10, 0)).toEqual({ left: false, right: false, up: false, down: false });
  });

  it('손잡이는 테두리 밖으로 나가지 않는다', () => {
    const p = clampToRadius(300, 400, R);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(R, 5);
    expect(clampToRadius(10, 0, R)).toEqual({ x: 10, y: 0 });
    expect(clampToRadius(0, 0, R)).toEqual({ x: 0, y: 0 });
  });
});
