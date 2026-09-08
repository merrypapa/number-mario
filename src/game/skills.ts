import { clampNumber } from './shapes';

export type SkillKind =
  | 'dash'
  | 'doubleJump'
  | 'glide'
  | 'shield'
  | 'star'
  | 'roll'
  | 'bridge'
  | 'grapple'
  | 'slam'
  | 'super';

export interface SkillDef {
  kind: SkillKind;
  name: string;
  desc: string;
  /** 재사용 대기시간(초). 0이면 즉시 재사용 가능 */
  cooldown: number;
  /** 효과 지속시간(초). 0이면 순간 발동 */
  duration: number;
  /** 버튼을 누르고 있는 동안 유지되는 스킬인가 */
  hold: boolean;
}

export const SKILLS: Record<number, SkillDef> = {
  1: { kind: 'dash', name: '스피드 대시', desc: '앞으로 순간 가속! 잠깐 무적', cooldown: 0.7, duration: 0.18, hold: false },
  2: { kind: 'doubleJump', name: '더블 점프', desc: '공중에서 한 번 더 점프', cooldown: 0, duration: 0, hold: false },
  3: { kind: 'glide', name: '트라이앵글 글라이드', desc: '누르고 있으면 천천히 하강', cooldown: 0, duration: 0, hold: true },
  4: { kind: 'shield', name: '스퀘어 실드', desc: '2초 동안 공격 1회 방어', cooldown: 5, duration: 2, hold: false },
  5: { kind: 'star', name: '스타 핸드', desc: '별을 던져 적을 물리친다', cooldown: 0.45, duration: 0, hold: false },
  6: { kind: 'roll', name: '롤링 어택', desc: '굴러서 벽돌을 부수고 적을 밀어낸다', cooldown: 2.5, duration: 0.9, hold: false },
  7: { kind: 'bridge', name: '레인보우 브리지', desc: '앞쪽에 무지개 발판을 놓는다', cooldown: 1.6, duration: 0, hold: false },
  8: { kind: 'grapple', name: '옥토 그랩', desc: '갈고리를 던져 매달린다', cooldown: 1.5, duration: 0, hold: false },
  9: { kind: 'slam', name: '스퀘어 슬램', desc: '내리찍어 충격파를 일으킨다', cooldown: 2.5, duration: 0, hold: false },
  10: { kind: 'super', name: '텐 파워', desc: '5초 무적 + 별 연사 + 빨라짐', cooldown: 12, duration: 5, hold: false },
};

export function skillOf(n: number): SkillDef {
  return SKILLS[clampNumber(n)];
}

export interface SkillState {
  cooldown: number;
  /** 남은 효과 시간 */
  active: number;
  /** 더블 점프용 공중 잔여 횟수 */
  airCharges: number;
}

export function createSkillState(n: number): SkillState {
  return { cooldown: 0, active: 0, airCharges: maxAirCharges(n) };
}

export function maxAirCharges(n: number): number {
  return skillOf(n).kind === 'doubleJump' ? 1 : 0;
}

/** 숫자가 바뀌면 스킬 상태를 초기화한다. */
export function resetSkillState(state: SkillState, n: number): SkillState {
  state.cooldown = 0;
  state.active = 0;
  state.airCharges = maxAirCharges(n);
  return state;
}

/** 매 프레임 쿨다운/지속시간을 진행시킨다. */
export function tickSkillState(state: SkillState, dt: number, onGround: boolean, n: number): SkillState {
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.active = Math.max(0, state.active - dt);
  if (onGround) state.airCharges = maxAirCharges(n);
  return state;
}

export function canUseSkill(state: SkillState, n: number, onGround: boolean): boolean {
  const def = skillOf(n);
  if (def.hold) return true;
  if (state.cooldown > 0) return false;
  if (def.kind === 'doubleJump') return !onGround && state.airCharges > 0;
  if (def.kind === 'slam') return !onGround;
  return true;
}

/** 스킬 발동 처리. 사용 가능하면 true를 돌려주고 상태를 갱신한다. */
export function useSkill(state: SkillState, n: number, onGround: boolean): boolean {
  if (!canUseSkill(state, n, onGround)) return false;
  const def = skillOf(n);
  if (def.hold) return true;
  if (def.kind === 'doubleJump') state.airCharges -= 1;
  state.cooldown = def.cooldown;
  state.active = def.duration;
  return true;
}

/** HUD 게이지용 0~1 값 (1 = 사용 가능). */
export function cooldownRatio(state: SkillState, n: number): number {
  const def = skillOf(n);
  if (def.cooldown <= 0) return 1;
  return 1 - state.cooldown / def.cooldown;
}
