import { describe, expect, it } from 'vitest';
import { MAP_NODES, MAP_PATHS, clampProgress, nodeAt, pathPoint } from '../src/game/worldmap';
import { LEVELS } from '../src/game/levels/data';
import { VIEW_H, VIEW_W } from '../src/core/constants';

describe('월드맵', () => {
  it('지도의 지점이 스테이지와 일대일로 맞는다', () => {
    expect(MAP_NODES).toHaveLength(LEVELS.length);
    MAP_NODES.forEach((node, i) => {
      expect(node.levelIndex).toBe(i);
      expect(node.id).toBe(LEVELS[i].id);
      expect(node.name).toBe(LEVELS[i].name);
    });
  });

  it('모든 지점이 화면 안에 있다', () => {
    for (const node of MAP_NODES) {
      expect(node.x).toBeGreaterThan(node.island);
      expect(node.x).toBeLessThan(VIEW_W - node.island);
      expect(node.y).toBeGreaterThan(30);
      expect(node.y).toBeLessThan(VIEW_H - 40);
    }
  });

  it('길이 모든 지점을 차례로 잇는다', () => {
    expect(MAP_PATHS).toHaveLength(MAP_NODES.length - 1);
    MAP_PATHS.forEach(([a, b], i) => {
      expect(a).toBe(i);
      expect(b).toBe(i + 1);
    });
  });

  it('길의 시작과 끝은 정확히 두 지점이다', () => {
    const [a, b] = [MAP_NODES[0], MAP_NODES[1]];
    const start = pathPoint(a, b, 0);
    const end = pathPoint(a, b, 1);
    expect(start.x).toBeCloseTo(a.x, 5);
    expect(start.y).toBeCloseTo(a.y, 5);
    expect(end.x).toBeCloseTo(b.x, 5);
    expect(end.y).toBeCloseTo(b.y, 5);
  });

  it('길 중간은 두 지점 사이에서 벗어나지 않는다', () => {
    const [a, b] = [MAP_NODES[0], MAP_NODES[1]];
    for (let t = 0; t <= 1; t += 0.1) {
      const p = pathPoint(a, b, t);
      expect(p.x).toBeGreaterThan(Math.min(a.x, b.x) - 60);
      expect(p.x).toBeLessThan(Math.max(a.x, b.x) + 60);
    }
  });

  it('범위 밖 t 는 안전하게 잘린다', () => {
    const [a, b] = [MAP_NODES[0], MAP_NODES[1]];
    expect(pathPoint(a, b, -5)).toEqual(pathPoint(a, b, 0));
    expect(pathPoint(a, b, 5)).toEqual(pathPoint(a, b, 1));
  });

  it('진행도는 스테이지 수 안으로 잘린다', () => {
    expect(clampProgress(-3)).toBe(0);
    expect(clampProgress(99)).toBe(LEVELS.length - 1);
    expect(clampProgress(2.7)).toBe(2);
    expect(clampProgress(NaN)).toBe(0);
  });

  it('범위 밖 인덱스도 안전하게 지점을 돌려준다', () => {
    expect(nodeAt(-1)).toBe(MAP_NODES[0]);
    expect(nodeAt(999)).toBe(MAP_NODES[MAP_NODES.length - 1]);
  });
});
