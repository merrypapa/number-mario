import { VIEW_W, VIEW_H } from '../core/constants';
import { formatScore } from '../game/scoring';
import { SKILLS } from '../game/skills';
import { shapeOf } from '../game/shapes';
import { COLORS, NUMBER_COLORS, RAINBOW } from '../render/palette';
import { drawCube, drawEyes, drawStarShape, drawText, roundRect, type Ctx } from '../render/sprites';
import type { ClearSummary } from '../game/scoring';
import { ENDING_LINES, PROLOGUE, stageStory } from '../game/story';
import { formatDuration, summarize, type RunRecord } from '../game/records';

export interface Menu {
  items: string[];
  index: number;
}

function dim(ctx: Ctx, alpha = 0.72): void {
  ctx.fillStyle = `rgba(10,12,22,${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawMenu(ctx: Ctx, menu: Menu, x: number, y: number, gap = 26, time = 0): void {
  menu.items.forEach((label, i) => {
    const selected = i === menu.index;
    const px = x + (selected ? Math.sin(time * 8) * 2 : 0);
    if (selected) {
      ctx.fillStyle = 'rgba(255,216,77,0.16)';
      roundRect(ctx, px - 104, y + i * gap - 15, 208, 22, 6);
      ctx.fill();
      drawText(ctx, '▶', px - 92, y + i * gap, 13, '#ffd84d', 'center');
    }
    drawText(ctx, label, px, y + i * gap, 15, selected ? '#ffd84d' : '#cfd6e4', 'center');
  });
}

/** 미니 캐릭터 (타이틀/도움말용) */
function drawMiniChar(ctx: Ctx, n: number, x: number, y: number, size: number, t: number): void {
  const cells = shapeOf(n);
  const color = NUMBER_COLORS[n];
  let cols = 0;
  let top = cells[0];
  for (const c of cells) {
    cols = Math.max(cols, c.col + 1);
    if (c.row > top.row) top = c;
  }
  const bob = Math.sin(t * 3 + n) * 2;
  ctx.save();
  ctx.translate(x - (cols * size) / 2, y + bob);
  for (const c of cells) {
    const useAlt = n === 10 && c.col > 0;
    drawCube(
      ctx,
      c.col * size,
      -(c.row + 1) * size,
      size,
      useAlt ? color.alt ?? color.base : color.base,
      useAlt ? '#ffffff' : color.light,
      useAlt ? '#c9c9d6' : color.dark,
    );
  }
  drawEyes(ctx, top.col * size + size / 2, -(top.row + 1) * size + size * 0.42, size, 1);
  ctx.restore();
}

export function drawTitle(ctx: Ctx, menu: Menu, time: number, best: number): void {
  ctx.fillStyle = '#0e1830';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // 별 배경
  for (let i = 0; i < 46; i++) {
    const x = (i * 137) % VIEW_W;
    const y = (i * 71) % 200;
    ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(time * 1.6 + i));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  const cx = VIEW_W / 2;
  // 타이틀
  ctx.save();
  ctx.translate(cx, 62 + Math.sin(time * 2) * 3);
  const halo = ctx.createLinearGradient(-170, 0, 170, 0);
  RAINBOW.forEach((c, i) => halo.addColorStop(i / (RAINBOW.length - 1), c));
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = halo;
  roundRect(ctx, -172, -30, 344, 60, 14);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = halo;
  ctx.lineWidth = 3;
  roundRect(ctx, -172, -30, 344, 60, 14);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawText(ctx, '넘버런', 0, 6, 40, '#ffd84d', 'center');
  drawText(ctx, 'NUMBERRUN', 0, 26, 14, '#8fe07f', 'center');
  ctx.restore();
  drawText(ctx, '카운트랜드 대모험', cx, 112, 16, '#ffffff', 'center');

  // 캐릭터 행진
  for (let n = 1; n <= 5; n++) {
    drawMiniChar(ctx, n, 92 + (n - 1) * 30, 176, 13, time + n * 0.4);
  }
  for (let n = 6; n <= 10; n++) {
    drawMiniChar(ctx, n, 388 + (n - 6) * 34, 176, 11, time + n * 0.4);
  }

  drawMenu(ctx, menu, cx, 216, 26, time);

  drawText(ctx, `최고 점수  ${formatScore(best)}`, cx, VIEW_H - 30, 11, '#8fa0c0', 'center');
  drawText(ctx, '방향키 이동 · Z/Space 점프 · X 스킬', cx, VIEW_H - 14, 10, '#6d7ea0', 'center');
}

export const STORY_PAGE_COUNT = PROLOGUE.length;

export function drawStory(ctx: Ctx, page: number, time: number): void {
  ctx.fillStyle = '#101527';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const p = PROLOGUE[Math.min(page, PROLOGUE.length - 1)];
  const cx = VIEW_W / 2;
  drawText(ctx, p.title, cx, 78, 25, '#ffd84d', 'center');
  p.lines.forEach((line, i) => {
    // 한 줄씩 차례로 나타난다
    const appear = time * 2.2 - i * 0.45;
    if (appear <= 0) return;
    ctx.globalAlpha = Math.min(1, appear);
    drawText(ctx, line, cx, 124 + i * 27, 13.5, '#e6ecf7', 'center');
    ctx.globalAlpha = 1;
  });
  drawMiniChar(ctx, Math.min(10, page + 1), cx, 282, 14, time);
  if (Math.floor(time * 2) % 2 === 0) {
    drawText(ctx, '아무 키나 눌러 계속', cx, VIEW_H - 24, 11, '#8fa0c0', 'center');
  }
}

export function drawHelp(ctx: Ctx, time: number): void {
  dim(ctx, 0.92);
  const cx = VIEW_W / 2;
  drawText(ctx, '조작법 & 숫자별 스킬', cx, 40, 20, '#ffd84d', 'center');
  drawText(ctx, '← → 이동   Z/Space 점프   X 스킬   ↓ 아래   Esc 일시정지', cx, 62, 11, '#cfd6e4', 'center');

  for (let n = 1; n <= 10; n++) {
    const col = n <= 5 ? 0 : 1;
    const row = (n - 1) % 5;
    const x = 24 + col * 312;
    const y = 96 + row * 40;
    const c = NUMBER_COLORS[n];
    ctx.fillStyle = c.base;
    roundRect(ctx, x, y - 14, 22, 22, 5);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawText(ctx, String(n), x + 11, y + 3, 13, '#ffffff', 'center');
    drawText(ctx, SKILLS[n].name, x + 32, y - 2, 12, c.light, 'left');
    drawText(ctx, SKILLS[n].desc, x + 32, y + 12, 9.5, '#9fb0cc', 'left');
  }
  if (Math.floor(time * 2) % 2 === 0) {
    drawText(ctx, '아무 키나 눌러 돌아가기', cx, VIEW_H - 12, 11, '#8fa0c0', 'center');
  }
}

export function drawPause(
  ctx: Ctx,
  menu: Menu,
  time: number,
  soundOn: boolean,
  kidMode: boolean,
  magic = false,
): void {
  dim(ctx);
  const cx = VIEW_W / 2;
  drawText(ctx, '일시정지', cx, 96, 26, '#ffd84d', 'center');
  drawMenu(ctx, menu, cx, 150, 28, time);
  drawText(
    ctx,
    `소리 ${soundOn ? '켜짐' : '꺼짐'}   ·   어린이 모드 ${kidMode ? '켜짐' : '꺼짐'}   ·   매직 넘버 ${magic ? '켜짐' : '꺼짐'}`,
    cx,
    VIEW_H - 30,
    11,
    '#8fa0c0',
    'center',
  );
}

export function drawClear(
  ctx: Ctx,
  summary: ClearSummary,
  levelName: string,
  time: number,
  last: boolean,
  levelId = '',
): void {
  dim(ctx, 0.78);
  const cx = VIEW_W / 2;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = COLORS.coin;
  drawStarShape(ctx, cx, 66, 22, time * 1.5);
  ctx.fill();
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  drawText(ctx, '스테이지 클리어!', cx, 116, 25, '#ffd84d', 'center');
  drawText(ctx, levelName, cx, 138, 12, '#cfd6e4', 'center');
  const story = stageStory(levelId);
  if (story) drawText(ctx, story.clear, cx, 160, 12, '#8fe07f', 'center');

  const rows: [string, number][] = [
    ['점수', summary.base],
    ['시간 보너스', summary.timeBonus],
    ['무사통과 보너스', summary.noDeathBonus],
  ];
  rows.forEach(([label, value], i) => {
    drawText(ctx, label, cx - 110, 192 + i * 22, 13, '#cfd6e4', 'left');
    drawText(ctx, formatScore(value), cx + 110, 192 + i * 22, 13, '#ffffff', 'right');
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(cx - 110, 266);
  ctx.lineTo(cx + 110, 266);
  ctx.stroke();
  drawText(ctx, '합계', cx - 110, 286, 15, '#ffd84d', 'left');
  drawText(ctx, formatScore(summary.total), cx + 110, 286, 15, '#ffd84d', 'right');

  if (Math.floor(time * 2) % 2 === 0) {
    drawText(ctx, last ? '아무 키나 눌러 결말 보기' : '아무 키나 눌러 다음 스테이지', cx, VIEW_H - 18, 12, '#8fe07f', 'center');
  }
}

export function drawGameOver(ctx: Ctx, menu: Menu, time: number, score: number): void {
  dim(ctx, 0.85);
  const cx = VIEW_W / 2;
  drawText(ctx, '게임 오버', cx, 110, 30, '#ff7d70', 'center');
  drawText(ctx, `점수  ${formatScore(score)}`, cx, 140, 13, '#cfd6e4', 'center');
  drawMenu(ctx, menu, cx, 186, 28, time);
}

export function drawEnding(ctx: Ctx, totalScore: number, time: number): void {
  ctx.fillStyle = '#0d1120';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(time * 2 + i));
    ctx.fillStyle = RAINBOW[i % RAINBOW.length];
    ctx.fillRect((i * 163) % VIEW_W, (i * 97) % VIEW_H, 2, 2);
  }
  ctx.globalAlpha = 1;
  const cx = VIEW_W / 2;
  drawText(ctx, '축하합니다!', cx, 34, 22, '#ffd84d', 'center');
  ENDING_LINES.forEach((line, i) => {
    const appear = time * 1.2 - i * 0.7;
    if (appear <= 0) return;
    ctx.globalAlpha = Math.min(1, appear);
    drawText(ctx, line, cx, 62 + i * 22, 11.5, '#e6ecf7', 'center');
    ctx.globalAlpha = 1;
  });
  drawText(ctx, `최종 점수  ${formatScore(totalScore)}`, cx, VIEW_H - 26, 14, '#8fe07f', 'center');
  if (Math.floor(time * 2) % 2 === 0) {
    drawText(ctx, '아무 키나 눌러 타이틀로', cx, VIEW_H - 8, 10, '#8fa0c0', 'center');
  }
}

/** 누적 기록 화면 */
export function drawRecords(ctx: Ctx, records: RunRecord[], scroll: number, time: number): void {
  ctx.fillStyle = '#101527';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cx = VIEW_W / 2;
  drawText(ctx, '명예의 전당', cx, 34, 22, '#ffd84d', 'center');

  const stats = summarize(records);
  drawText(
    ctx,
    `완주 ${stats.runs}회   ·   최고 ${formatScore(stats.bestScore)}   ·   최단 ${
      stats.runs ? formatDuration(stats.bestSeconds) : '-'
    }   ·   모은 코인 ${stats.totalCoins}`,
    cx,
    54,
    10.5,
    '#8fa0c0',
    'center',
  );

  if (records.length === 0) {
    drawText(ctx, '아직 완주 기록이 없어요.', cx, 160, 15, '#cfd6e4', 'center');
    drawText(ctx, '제로의 탑까지 깨면 이름을 남길 수 있어요!', cx, 186, 12, '#8fa0c0', 'center');
  } else {
    const rows = 8;
    const top = Math.max(0, Math.min(scroll, records.length - rows));
    // 표 머리
    drawText(ctx, '순위', 44, 80, 10, '#8fa0c0', 'center');
    drawText(ctx, '이름', 76, 80, 10, '#8fa0c0', 'left');
    drawText(ctx, '점수', 330, 80, 10, '#8fa0c0', 'right');
    drawText(ctx, '시간', 400, 80, 10, '#8fa0c0', 'right');
    drawText(ctx, '숫자', 460, 80, 10, '#8fa0c0', 'right');
    drawText(ctx, '코인', 520, 80, 10, '#8fa0c0', 'right');
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(32, 86);
    ctx.lineTo(VIEW_W - 32, 86);
    ctx.stroke();

    for (let i = 0; i < Math.min(rows, records.length - top); i++) {
      const r = records[top + i];
      const rank = top + i + 1;
      const y = 106 + i * 26;
      if (rank <= 3) {
        ctx.fillStyle = ['rgba(255,216,77,0.14)', 'rgba(207,214,228,0.12)', 'rgba(201,119,60,0.14)'][rank - 1];
        roundRect(ctx, 32, y - 15, VIEW_W - 64, 22, 5);
        ctx.fill();
      }
      const medal = ['#ffd84d', '#cfd6e4', '#c9773c'][rank - 1] ?? '#8fa0c0';
      drawText(ctx, String(rank), 44, y, 12, medal, 'center');
      drawText(ctx, r.name, 76, y, 12, '#ffffff', 'left');
      drawText(ctx, formatScore(r.score), 330, y, 12, '#ffe98a', 'right');
      drawText(ctx, formatDuration(r.seconds), 400, y, 11, '#cfd6e4', 'right');
      const c = NUMBER_COLORS[r.bestNumber] ?? NUMBER_COLORS[1];
      drawText(ctx, String(r.bestNumber), 460, y, 12, c.light, 'right');
      drawText(ctx, String(r.coins), 520, y, 11, '#cfd6e4', 'right');
      if (r.assisted) drawText(ctx, '도움', 566, y, 9.5, '#8fe07f', 'right');
    }
    if (records.length > rows) {
      drawText(ctx, `▲ ▼ 로 넘기기  (${top + 1}~${top + Math.min(rows, records.length - top)} / ${records.length})`,
        cx, VIEW_H - 30, 10, '#6d7ea0', 'center');
    }
  }

  if (Math.floor(time * 2) % 2 === 0) {
    drawText(ctx, '▲ 눌러 타이틀로', cx, VIEW_H - 12, 11, '#8fa0c0', 'center');
  }
}

export function drawLoading(ctx: Ctx): void {
  ctx.fillStyle = '#0e1830';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(ctx, '불러오는 중…', VIEW_W / 2, VIEW_H / 2, 16, '#ffffff', 'center');
}
