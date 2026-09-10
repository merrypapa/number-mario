import { describe, expect, it } from 'vitest';
import {
  MAX_RECORDS,
  addRecord,
  formatDuration,
  parseRecords,
  sortRecords,
  summarize,
  type RunRecord,
} from '../src/game/records';

function rec(over: Partial<RunRecord> = {}): RunRecord {
  return {
    name: '테스터',
    score: 1000,
    coins: 10,
    deaths: 0,
    seconds: 120,
    bestNumber: 10,
    assisted: false,
    at: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('완주 기록', () => {
  it('점수가 높은 순, 같으면 빠른 순으로 정렬한다', () => {
    const sorted = sortRecords([
      rec({ name: 'A', score: 100 }),
      rec({ name: 'B', score: 300 }),
      rec({ name: 'C', score: 300, seconds: 60 }),
    ]);
    expect(sorted.map((r) => r.name)).toEqual(['C', 'B', 'A']);
  });

  it('기록을 추가해도 원본을 건드리지 않는다', () => {
    const base = [rec({ name: 'A' })];
    const next = addRecord(base, rec({ name: 'B', score: 5000 }));
    expect(base).toHaveLength(1);
    expect(next.map((r) => r.name)).toEqual(['B', 'A']);
  });

  it('기록은 정해진 개수까지만 남는다', () => {
    let list: RunRecord[] = [];
    for (let i = 0; i < MAX_RECORDS + 10; i++) list = addRecord(list, rec({ score: i }));
    expect(list).toHaveLength(MAX_RECORDS);
    expect(list[0].score).toBe(MAX_RECORDS + 9);
  });

  it('망가진 저장 값이 있어도 게임이 멈추지 않는다', () => {
    expect(parseRecords(null)).toEqual([]);
    expect(parseRecords('이건 JSON 이 아님')).toEqual([]);
    expect(parseRecords('{"a":1}')).toEqual([]);
    const salvaged = parseRecords('[{"name":"X"},null,{"score":"이상함"}]');
    expect(salvaged.length).toBe(2);
    expect(salvaged.every((r) => Number.isFinite(r.score))).toBe(true);
  });

  it('이름이 너무 길면 잘라 낸다', () => {
    const [r] = parseRecords(JSON.stringify([rec({ name: '가'.repeat(50) })]));
    expect(r.name.length).toBeLessThanOrEqual(10);
  });

  it('누적 통계를 계산한다', () => {
    const s = summarize([
      rec({ score: 100, coins: 5, deaths: 1, seconds: 200 }),
      rec({ score: 900, coins: 7, deaths: 3, seconds: 150 }),
    ]);
    expect(s).toEqual({ runs: 2, bestScore: 900, bestSeconds: 150, totalCoins: 12, totalDeaths: 4 });
  });

  it('기록이 없으면 통계는 0이다', () => {
    expect(summarize([])).toEqual({ runs: 0, bestScore: 0, bestSeconds: 0, totalCoins: 0, totalDeaths: 0 });
  });

  it('시간을 분:초로 보여 준다', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});
