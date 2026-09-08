import { describe, expect, it } from 'vitest';
import {
  SCORE_ENEMY_BASE,
  SCORE_NO_DEATH_BONUS,
  clearSummary,
  enemyScore,
  formatScore,
  formatTime,
} from '../src/game/scoring';

describe('점수 계산', () => {
  it('연속 밟기는 점수가 두 배씩 오른다', () => {
    expect(enemyScore(0)).toBe(SCORE_ENEMY_BASE);
    expect(enemyScore(1)).toBe(SCORE_ENEMY_BASE * 2);
    expect(enemyScore(3)).toBe(SCORE_ENEMY_BASE * 8);
  });

  it('콤보 배수에 상한이 있다', () => {
    expect(enemyScore(99)).toBe(enemyScore(5));
  });

  it('클리어 보너스를 합산한다', () => {
    const s = clearSummary(1000, 25.7, 0);
    expect(s.timeBonus).toBe(250);
    expect(s.noDeathBonus).toBe(SCORE_NO_DEATH_BONUS);
    expect(s.total).toBe(1000 + 250 + SCORE_NO_DEATH_BONUS);
  });

  it('죽은 적이 있으면 무사통과 보너스가 없다', () => {
    expect(clearSummary(0, 0, 2).noDeathBonus).toBe(0);
  });

  it('남은 시간이 음수여도 보너스는 0 이상이다', () => {
    expect(clearSummary(0, -10, 0).timeBonus).toBe(0);
  });

  it('HUD 표기 형식', () => {
    expect(formatScore(1234)).toBe('0001234');
    expect(formatScore(-5)).toBe('0000000');
    expect(formatTime(59.2)).toBe('060');
    expect(formatTime(0)).toBe('000');
  });
});
