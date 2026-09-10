import { LEVELS } from './levels/data';

/** 월드맵 위의 한 지점 */
export interface MapNode {
  levelIndex: number;
  id: string;
  name: string;
  /** 논리 좌표(640×360) */
  x: number;
  y: number;
  /** 섬 모양 반지름 */
  island: number;
  icon: 'grass' | 'hill' | 'canyon' | 'cave' | 'tower';
}

export const MAP_NODES: MapNode[] = [
  { levelIndex: 0, id: '1-1', name: '카운트 초원', x: 88, y: 268, island: 46, icon: 'grass' },
  { levelIndex: 1, id: '1-2', name: '벽돌 언덕', x: 198, y: 186, island: 44, icon: 'hill' },
  { levelIndex: 2, id: '1-3', name: '무지개 협곡', x: 322, y: 262, island: 44, icon: 'canyon' },
  { levelIndex: 3, id: '1-4', name: '제로 동굴', x: 466, y: 196, island: 44, icon: 'cave' },
  { levelIndex: 4, id: '1-5', name: '제로의 탑', x: 372, y: 92, island: 52, icon: 'tower' },
];

/** 이어지는 길 (앞 지점 → 뒤 지점) */
export const MAP_PATHS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
];

const STORAGE_PROGRESS = 'numberrun.progress';

/** 열려 있는 스테이지 수(0이면 1-1만 열림). 저장소를 못 쓰면 0. */
export function loadProgress(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_PROGRESS) ?? 0);
    return clampProgress(raw);
  } catch {
    return 0;
  }
}

export function saveProgress(unlocked: number): void {
  try {
    localStorage.setItem(STORAGE_PROGRESS, String(clampProgress(unlocked)));
  } catch {
    /* 저장소를 못 쓰면 이번 판에만 유효 */
  }
}

export function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(LEVELS.length - 1, Math.floor(n)));
}

/** 길 위의 한 점 — 지도 위 말이 움직일 때 쓴다 */
export function pathPoint(from: MapNode, to: MapNode, t: number): { x: number; y: number } {
  const k = Math.max(0, Math.min(1, t));
  // 살짝 휘어진 길이 지도처럼 보인다
  const mx = (from.x + to.x) / 2 + (to.y - from.y) * 0.18;
  const my = (from.y + to.y) / 2 - (to.x - from.x) * 0.18;
  const inv = 1 - k;
  return {
    x: inv * inv * from.x + 2 * inv * k * mx + k * k * to.x,
    y: inv * inv * from.y + 2 * inv * k * my + k * k * to.y,
  };
}

export function nodeAt(levelIndex: number): MapNode {
  return MAP_NODES[Math.max(0, Math.min(MAP_NODES.length - 1, levelIndex))];
}
