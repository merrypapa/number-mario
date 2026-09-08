import { VIEW_W, VIEW_H } from '../core/constants';
import { formatScore } from '../game/scoring';
import { SKILLS } from '../game/skills';
import { shapeOf } from '../game/shapes';
import { COLORS, NUMBER_COLORS, RAINBOW } from '../render/palette';
import { drawCube, drawEyes, drawStarShape, drawText, roundRect, type Ctx } from '../render/sprites';
import type { ClearSummary } from '../game/scoring';

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

const STORY_PAGES: { title: string; lines: string[] }[] = [
  {
    title: '카운트랜드',
    lines: [
      '모든 것이 블록으로 이루어진 나라, 카운트랜드.',
      '주민들은 블록을 하나씩 쌓아 올리며 자랍니다.',
      '하나면 원, 둘이면 투, 열이면 텐.',
    ],
  },
  {
    title: '아무것도 아닌 자',
    lines: [
      '어느 날 하늘에 아무것도 없는 구멍이 열렸습니다.',
      '"숫자는 시끄러워. 전부 0으로 만들어 줄게."',
      '미스터 제로가 카운트 크리스탈을 삼켜 버렸습니다.',
    ],
  },
  {
    title: '마지막 하나',
    lines: [
      '주민들의 블록이 하나씩 사라지고',
      '마지막에 남은 것은 블록 단 하나, 바로 당신.',
      '플러스 오브를 모아 다시 자라나세요!',
    ],
  },
];

export const STORY_PAGE_COUNT = STORY_PAGES.length;

export function drawStory(ctx: Ctx, page: number, time: number): void {
  ctx.fillStyle = '#101527';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const p = STORY_PAGES[Math.min(page, STORY_PAGES.length - 1)];
  const cx = VIEW_W / 2;
  drawText(ctx, p.title, cx, 92, 26, '#ffd84d', 'center');
  p.lines.forEach((line, i) => {
    drawText(ctx, line, cx, 148 + i * 30, 14, '#e6ecf7', 'center');
  });
  drawMiniChar(ctx, page + 1, cx, 268, 15, time);
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

export function drawPause(ctx: Ctx, menu: Menu, time: number, soundOn: boolean, kidMode: boolean): void {
  dim(ctx);
  const cx = VIEW_W / 2;
  drawText(ctx, '일시정지', cx, 96, 26, '#ffd84d', 'center');
  drawMenu(ctx, menu, cx, 150, 28, time);
  drawText(
    ctx,
    `소리 ${soundOn ? '켜짐' : '꺼짐'}   ·   어린이 모드 ${kidMode ? '켜짐' : '꺼짐'}`,
    cx,
    VIEW_H - 30,
    11,
    '#8fa0c0',
    'center',
  );
}

export function drawClear(ctx: Ctx, summary: ClearSummary, levelName: string, time: number, last: boolean): void {
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

  drawText(ctx, '스테이지 클리어!', cx, 120, 26, '#ffd84d', 'center');
  drawText(ctx, levelName, cx, 144, 13, '#cfd6e4', 'center');

  const rows: [string, number][] = [
    ['점수', summary.base],
    ['시간 보너스', summary.timeBonus],
    ['무사통과 보너스', summary.noDeathBonus],
  ];
  rows.forEach(([label, value], i) => {
    drawText(ctx, label, cx - 110, 184 + i * 22, 13, '#cfd6e4', 'left');
    drawText(ctx, formatScore(value), cx + 110, 184 + i * 22, 13, '#ffffff', 'right');
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(cx - 110, 258);
  ctx.lineTo(cx + 110, 258);
  ctx.stroke();
  drawText(ctx, '합계', cx - 110, 278, 15, '#ffd84d', 'left');
  drawText(ctx, formatScore(summary.total), cx + 110, 278, 15, '#ffd84d', 'right');

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

const ENDING_LINES = [
  '텐이 제로를 세 번 내리찍자 제로가 외쳤습니다.',
  '"나는 아무것도 아니야! 어떻게 이겨?!"',
  '"아무것도 아닌 건 이기는 게 아니라 세는 거야."',
  '1과 0이 나란히 서자 10이 되었습니다.',
  '제로는 처음으로 자기 자리를 얻었습니다.',
  '카운트랜드에 다시 숫자가 흐릅니다. 하나, 둘, 셋…',
];

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
  drawText(ctx, '축하합니다!', cx, 48, 26, '#ffd84d', 'center');
  ENDING_LINES.forEach((line, i) => {
    const appear = time * 1.6 - i * 0.8;
    if (appear <= 0) return;
    ctx.globalAlpha = Math.min(1, appear);
    drawText(ctx, line, cx, 92 + i * 26, 12.5, '#e6ecf7', 'center');
    ctx.globalAlpha = 1;
  });
  drawMiniChar(ctx, 10, cx, 300, 14, time);
  drawText(ctx, `최종 점수  ${formatScore(totalScore)}`, cx, VIEW_H - 26, 14, '#8fe07f', 'center');
  if (Math.floor(time * 2) % 2 === 0) {
    drawText(ctx, '아무 키나 눌러 타이틀로', cx, VIEW_H - 8, 10, '#8fa0c0', 'center');
  }
}

export function drawLoading(ctx: Ctx): void {
  ctx.fillStyle = '#0e1830';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(ctx, '불러오는 중…', VIEW_W / 2, VIEW_H / 2, 16, '#ffffff', 'center');
}
