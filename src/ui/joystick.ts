import type { Action, Input } from '../core/input';

/** 스틱이 가리키는 방향 */
export interface StickDirections {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/** 중립으로 보는 반경 비율 */
export const DEAD_ZONE = 0.3;
/** 위/아래로 인정하는 반경 비율 (실수로 발판을 통과하지 않도록 가로보다 크게) */
export const VERTICAL_ZONE = 0.55;

/**
 * 스틱 변위를 방향 입력으로 바꾼다.
 * 세로는 세로 성분이 가로보다 클 때만 인정한다 —
 * 달리면서 살짝 아래로 기울었다고 발판을 통과해 버리면 곤란하기 때문이다.
 */
export function stickDirections(dx: number, dy: number, radius: number): StickDirections {
  if (radius <= 0) return { left: false, right: false, up: false, down: false };
  const nx = dx / radius;
  const ny = dy / radius;
  const verticalWins = Math.abs(ny) > Math.abs(nx);
  return {
    left: nx < -DEAD_ZONE,
    right: nx > DEAD_ZONE,
    up: ny < -VERTICAL_ZONE && verticalWins,
    down: ny > VERTICAL_ZONE && verticalWins,
  };
}

/** 반경 안으로 잘라낸 변위 (손가락이 멀리 가도 손잡이는 테두리까지만) */
export function clampToRadius(dx: number, dy: number, radius: number): { x: number; y: number } {
  const dist = Math.hypot(dx, dy);
  if (dist <= radius || dist === 0) return { x: dx, y: dy };
  return { x: (dx / dist) * radius, y: (dy / dist) * radius };
}

const AXES: Array<keyof StickDirections> = ['left', 'right', 'up', 'down'];

/** 가상 조이스틱을 DOM 에 붙인다. */
export function createJoystick(
  root: HTMLElement,
  knob: HTMLElement,
  input: Input,
  onFirstTouch?: () => void,
): void {
  let pointerId: number | null = null;
  let cx = 0;
  let cy = 0;
  let radius = 1;
  const state: StickDirections = { left: false, right: false, up: false, down: false };

  const apply = (next: StickDirections): void => {
    for (const axis of AXES) {
      if (state[axis] === next[axis]) continue;
      state[axis] = next[axis];
      input.setTouch(axis as Action, next[axis]);
    }
  };

  const moveKnob = (x: number, y: number): void => {
    knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  };

  const reset = (): void => {
    pointerId = null;
    root.classList.remove('active');
    moveKnob(0, 0);
    apply({ left: false, right: false, up: false, down: false });
  };

  const update = (clientX: number, clientY: number): void => {
    const { x, y } = clampToRadius(clientX - cx, clientY - cy, radius);
    moveKnob(x, y);
    apply(stickDirections(x, y, radius));
  };

  root.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (pointerId !== null) return;
    onFirstTouch?.();
    pointerId = e.pointerId;
    root.setPointerCapture(e.pointerId);
    root.classList.add('active');
    const rect = root.getBoundingClientRect();
    cx = rect.left + rect.width / 2;
    cy = rect.top + rect.height / 2;
    radius = rect.width / 2;
    update(e.clientX, e.clientY);
  });

  root.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    update(e.clientX, e.clientY);
  });

  for (const type of ['pointerup', 'pointercancel'] as const) {
    root.addEventListener(type, (e) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      reset();
    });
  }
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  reset();
}
