/** 완주 기록 한 줄 */
export interface RunRecord {
  name: string;
  score: number;
  coins: number;
  deaths: number;
  /** 전체 소요 시간(초) */
  seconds: number;
  /** 도달한 가장 큰 숫자 */
  bestNumber: number;
  /** 도우미(어린이 모드·매직 넘버)를 켜고 깼는지 */
  assisted: boolean;
  /** 저장 시각 (ISO) */
  at: string;
}

export const MAX_RECORDS = 50;
const STORAGE_RECORDS = 'numberrun.records';

/** 점수 내림차순, 같으면 짧은 시간이 위 */
export function sortRecords(records: RunRecord[]): RunRecord[] {
  return [...records].sort((a, b) => b.score - a.score || a.seconds - b.seconds);
}

export function addRecord(records: RunRecord[], record: RunRecord): RunRecord[] {
  return sortRecords([...records, record]).slice(0, MAX_RECORDS);
}

/** 저장된 값이 망가져 있어도 게임이 멈추지 않도록 걸러 낸다 */
export function parseRecords(raw: string | null): RunRecord[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return sortRecords(
      data
        .filter((r): r is RunRecord => !!r && typeof r === 'object')
        .map((r) => ({
          name: String(r.name ?? '이름없음').slice(0, 10),
          score: Number(r.score) || 0,
          coins: Number(r.coins) || 0,
          deaths: Number(r.deaths) || 0,
          seconds: Number(r.seconds) || 0,
          bestNumber: Number(r.bestNumber) || 1,
          assisted: Boolean(r.assisted),
          at: typeof r.at === 'string' ? r.at : new Date().toISOString(),
        })),
    ).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

export function loadRecords(): RunRecord[] {
  try {
    return parseRecords(localStorage.getItem(STORAGE_RECORDS));
  } catch {
    return [];
  }
}

export function saveRecords(records: RunRecord[]): void {
  try {
    localStorage.setItem(STORAGE_RECORDS, JSON.stringify(records));
  } catch {
    /* 저장소를 못 쓰면 이번 판에만 유효 */
  }
}

/** 누적 통계 */
export interface RecordSummary {
  runs: number;
  bestScore: number;
  bestSeconds: number;
  totalCoins: number;
  totalDeaths: number;
}

export function summarize(records: RunRecord[]): RecordSummary {
  return records.reduce<RecordSummary>(
    (acc, r) => ({
      runs: acc.runs + 1,
      bestScore: Math.max(acc.bestScore, r.score),
      bestSeconds: acc.bestSeconds === 0 ? r.seconds : Math.min(acc.bestSeconds, r.seconds),
      totalCoins: acc.totalCoins + r.coins,
      totalDeaths: acc.totalDeaths + r.deaths,
    }),
    { runs: 0, bestScore: 0, bestSeconds: 0, totalCoins: 0, totalDeaths: 0 },
  );
}

/** mm:ss */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
