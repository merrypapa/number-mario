export const SCORE_COIN = 100;
export const SCORE_ORB = 50;
export const SCORE_ENEMY_BASE = 200;
export const SCORE_TIME_UNIT = 10;
export const SCORE_NO_DEATH_BONUS = 1000;

/** 착지 없이 연속으로 밟은 횟수에 따른 점수(마리오식 콤보). */
export function enemyScore(comboIndex: number): number {
  const capped = Math.min(comboIndex, 5);
  return SCORE_ENEMY_BASE * Math.pow(2, capped);
}

export interface ClearSummary {
  base: number;
  timeBonus: number;
  noDeathBonus: number;
  total: number;
}

export function clearSummary(score: number, timeLeft: number, deaths: number): ClearSummary {
  const timeBonus = Math.max(0, Math.floor(timeLeft)) * SCORE_TIME_UNIT;
  const noDeathBonus = deaths === 0 ? SCORE_NO_DEATH_BONUS : 0;
  return { base: score, timeBonus, noDeathBonus, total: score + timeBonus + noDeathBonus };
}

/** 점수를 7자리 0채움 문자열로 (HUD 표기용). */
export function formatScore(score: number): string {
  return Math.max(0, Math.floor(score)).toString().padStart(7, '0');
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return s.toString().padStart(3, '0');
}
