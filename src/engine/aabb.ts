/** 축 정렬 바운딩 박스 유틸 (순수 함수). */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makeBox(x: number, y: number, w: number, h: number): Box {
  return { x, y, w, h };
}

export const left = (b: Box) => b.x;
export const right = (b: Box) => b.x + b.w;
export const top = (b: Box) => b.y;
export const bottom = (b: Box) => b.y + b.h;
export const centerX = (b: Box) => b.x + b.w / 2;
export const centerY = (b: Box) => b.y + b.h / 2;

/** 두 박스가 겹치는가 (변끼리 닿기만 한 경우는 false). */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** 겹침 영역의 넓이 (겹치지 않으면 0). */
export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(right(a), right(b)) - Math.max(left(a), left(b));
  const h = Math.min(bottom(a), bottom(b)) - Math.max(top(a), top(b));
  return w > 0 && h > 0 ? w * h : 0;
}

/** 박스를 사방으로 확장한 새 박스. */
export function inflate(b: Box, amount: number): Box {
  return { x: b.x - amount, y: b.y - amount, w: b.w + amount * 2, h: b.h + amount * 2 };
}

export function containsPoint(b: Box, px: number, py: number): boolean {
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/**
 * a가 b를 위에서 밟았는지 판정한다.
 * 낙하 중이고, a의 발이 b의 상단 근처에 있어야 한다.
 */
export function isStompingFrom(a: Box, b: Box, velY: number, tolerance = 10): boolean {
  if (velY <= 0) return false;
  if (!overlaps(a, b)) return false;
  return bottom(a) - tolerance <= top(b) + Math.max(0, velY * (1 / 60));
}
