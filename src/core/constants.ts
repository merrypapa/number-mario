/** 게임 전역 상수. 물리 단위는 픽셀 / 초. */

export const TILE = 24;

/** 논리 해상도 (정수배로 확대되어 표시된다) */
export const VIEW_W = 640;
export const VIEW_H = 360;

/** 고정 시뮬레이션 스텝 */
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.25;

/* ── 물리 기본값 ───────────────────────────────────────── */
export const GRAVITY_BASE = 1500;
export const MOVE_SPEED_BASE = 168;
export const JUMP_VEL_BASE = 470;
export const MAX_FALL_SPEED = 780;
export const GROUND_ACCEL = 1250;
export const AIR_ACCEL = 760;
export const GROUND_FRICTION = 1500;
export const AIR_FRICTION = 260;

/** 지면을 벗어난 뒤에도 점프를 허용하는 시간 */
export const COYOTE_TIME = 0.1;
/** 착지 전 미리 누른 점프를 기억하는 시간 */
export const JUMP_BUFFER = 0.1;
/** 점프 버튼을 떼었을 때 상승 속도를 깎는 비율 */
export const JUMP_CUT = 0.45;

export const MIN_NUMBER = 1;
export const MAX_NUMBER = 10;

export const INVULN_TIME = 1.2;
export const KID_INVULN_TIME = 2.0;

export const STOMP_BOUNCE = 340;
export const DEFAULT_LIVES = 3;
export const KID_LIVES = 5;

export const LEVEL_TIME = 300;
