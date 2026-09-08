import { TILE, GRAVITY_BASE, MOVE_SPEED_BASE, JUMP_VEL_BASE, MIN_NUMBER, MAX_NUMBER } from '../core/constants';

/** 블록 한 칸의 좌표. col은 왼쪽부터, row는 **아래**부터 0. */
export interface Cell {
  col: number;
  row: number;
}

function rect(cols: number, rows: number): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) cells.push({ col, row });
  return cells;
}

function column(rows: number): Cell[] {
  return rect(1, rows);
}

/**
 * 숫자별 블록 배치.
 * 블록 개수는 항상 숫자와 일치한다(7만 2×4 틀에서 한 칸이 비어 있다).
 */
/**
 * 숫자별 블록 배치.
 * 블록 개수는 항상 숫자와 일치한다.
 * 히트박스는 최대 3칸 폭 × 4칸 높이를 넘지 않도록 설계했다.
 * (지형이 만드는 통로를 어떤 형태로도 통과할 수 있게 하기 위한 상한)
 */
export const SHAPES: Record<number, Cell[]> = {
  1: column(1),
  2: column(2),
  3: column(3),
  // 정사각형 포
  4: rect(2, 2),
  // 2 + 2 + 1
  5: [...rect(2, 2), { col: 0, row: 2 }],
  6: rect(2, 3),
  // 3 + 3 + 1 (가운데 위에 하나)
  7: [...rect(3, 2), { col: 1, row: 2 }],
  // 3 + 3 + 2
  8: [...rect(3, 2), { col: 0, row: 2 }, { col: 1, row: 2 }],
  9: rect(3, 3),
  // 3 + 3 + 3 + 1 : 가장 크고 무겁다
  10: [...rect(3, 3), { col: 1, row: 3 }],
};

export interface NumberStats {
  /** 히트박스 폭(칸) */
  cols: number;
  /** 히트박스 높이(칸) */
  rows: number;
  widthPx: number;
  heightPx: number;
  moveSpeed: number;
  jumpVel: number;
  gravity: number;
}

const statsCache = new Map<number, NumberStats>();

export function clampNumber(n: number): number {
  return Math.max(MIN_NUMBER, Math.min(MAX_NUMBER, Math.round(n)));
}

export function shapeOf(n: number): Cell[] {
  return SHAPES[clampNumber(n)];
}

/** 숫자에 대응하는 크기·이동 성능. 작을수록 빠르고, 클수록 무겁다. */
export function numberStats(n: number): NumberStats {
  const num = clampNumber(n);
  const cached = statsCache.get(num);
  if (cached) return cached;

  const cells = SHAPES[num];
  let cols = 0;
  let rows = 0;
  for (const c of cells) {
    cols = Math.max(cols, c.col + 1);
    rows = Math.max(rows, c.row + 1);
  }
  const stats: NumberStats = {
    cols,
    rows,
    widthPx: cols * TILE,
    heightPx: rows * TILE,
    moveSpeed: MOVE_SPEED_BASE * (1.22 - 0.045 * num),
    jumpVel: JUMP_VEL_BASE * (1 + 0.028 * num),
    gravity: GRAVITY_BASE * (1 + 0.035 * (num - 1)),
  };
  statsCache.set(num, stats);
  return stats;
}

/** 나눗셈 박쥐 등에 쓰이는 절반 계산(내림, 최소 1). */
export function halveNumber(n: number): number {
  return clampNumber(Math.max(MIN_NUMBER, Math.floor(clampNumber(n) / 2)));
}
