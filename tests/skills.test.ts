import { describe, expect, it } from 'vitest';
import {
  SKILLS,
  canUseSkill,
  cooldownRatio,
  createSkillState,
  maxAirCharges,
  resetSkillState,
  skillOf,
  tickSkillState,
  useSkill,
} from '../src/game/skills';

describe('스킬 상태머신', () => {
  it('1부터 10까지 모든 숫자에 스킬이 있다', () => {
    for (let n = 1; n <= 10; n++) {
      expect(SKILLS[n]).toBeDefined();
      expect(SKILLS[n].name.length).toBeGreaterThan(0);
    }
    const kinds = new Set(Object.values(SKILLS).map((s) => s.kind));
    expect(kinds.size).toBe(10);
  });

  it('쿨다운 동안에는 다시 쓸 수 없다', () => {
    const st = createSkillState(4);
    expect(useSkill(st, 4, true)).toBe(true);
    expect(st.cooldown).toBe(SKILLS[4].cooldown);
    expect(useSkill(st, 4, true)).toBe(false);
    tickSkillState(st, SKILLS[4].cooldown, true, 4);
    expect(canUseSkill(st, 4, true)).toBe(true);
  });

  it('지속시간이 시간에 따라 줄어든다', () => {
    const st = createSkillState(4);
    useSkill(st, 4, true);
    expect(st.active).toBe(SKILLS[4].duration);
    tickSkillState(st, 1, true, 4);
    expect(st.active).toBeCloseTo(SKILLS[4].duration - 1);
    tickSkillState(st, 99, true, 4);
    expect(st.active).toBe(0);
  });

  it('더블 점프는 공중에서 한 번만, 착지하면 회복된다', () => {
    const st = createSkillState(2);
    expect(maxAirCharges(2)).toBe(1);
    expect(canUseSkill(st, 2, true)).toBe(false); // 지면에서는 불가
    expect(useSkill(st, 2, false)).toBe(true);
    expect(useSkill(st, 2, false)).toBe(false);
    tickSkillState(st, 0.1, true, 2);
    expect(st.airCharges).toBe(1);
  });

  it('슬램(9)은 공중에서만 쓸 수 있다', () => {
    const st = createSkillState(9);
    expect(canUseSkill(st, 9, true)).toBe(false);
    expect(canUseSkill(st, 9, false)).toBe(true);
  });

  it('유지형 스킬(3)은 언제나 사용 가능하고 쿨다운이 없다', () => {
    const st = createSkillState(3);
    expect(useSkill(st, 3, true)).toBe(true);
    expect(st.cooldown).toBe(0);
    expect(cooldownRatio(st, 3)).toBe(1);
  });

  it('숫자가 바뀌면 상태가 초기화된다', () => {
    const st = createSkillState(4);
    useSkill(st, 4, true);
    resetSkillState(st, 2);
    expect(st.cooldown).toBe(0);
    expect(st.active).toBe(0);
    expect(st.airCharges).toBe(1);
  });

  it('쿨다운 게이지는 0에서 1로 회복된다', () => {
    const st = createSkillState(6);
    useSkill(st, 6, true);
    expect(cooldownRatio(st, 6)).toBeCloseTo(0);
    tickSkillState(st, SKILLS[6].cooldown / 2, true, 6);
    expect(cooldownRatio(st, 6)).toBeCloseTo(0.5);
  });

  it('skillOf 는 범위 밖 숫자도 처리한다', () => {
    expect(skillOf(0).kind).toBe('dash');
    expect(skillOf(99).kind).toBe('super');
  });
});
