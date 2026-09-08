import { VIEW_W } from '../core/constants';
import { formatScore, formatTime } from '../game/scoring';
import { cooldownRatio, skillOf } from '../game/skills';
import type { World } from '../game/world';
import { COLORS, NUMBER_COLORS } from './palette';
import { drawHeartShape, drawText, roundRect, drawStarShape, type Ctx } from './sprites';

function panel(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx: Ctx, world: World, time: number): void {
  const color = NUMBER_COLORS[world.player.number] ?? NUMBER_COLORS[1];
  const def = skillOf(world.player.number);

  /* 좌측: 점수 / 코인 */
  panel(ctx, 8, 6, 152, 42);
  drawText(ctx, formatScore(world.score), 16, 24, 15, '#ffffff', 'left');
  ctx.fillStyle = COLORS.coin;
  ctx.beginPath();
  ctx.arc(22, 37, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.coinDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawText(ctx, `×${String(world.coins).padStart(2, '0')}`, 33, 42, 12, '#ffe98a', 'left');
  drawText(ctx, world.level.name, 78, 42, 11, '#cfd6e4', 'left');

  /* 중앙: 숫자 + 스킬 */
  const cx = VIEW_W / 2;
  panel(ctx, cx - 92, 6, 184, 42);
  ctx.save();
  ctx.translate(cx - 74, 27);
  ctx.fillStyle = color.base;
  roundRect(ctx, -13, -13, 26, 26, 5);
  ctx.fill();
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawText(ctx, String(world.player.number), 0, 6, 16, '#ffffff', 'center');
  ctx.restore();

  drawText(ctx, def.name, cx - 54, 21, 11, color.light, 'left');
  const ratio = cooldownRatio(world.player.skill, world.player.number);
  const barW = 118;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, cx - 54, 28, barW, 9, 4);
  ctx.fill();
  ctx.fillStyle = ratio >= 1 ? color.light : color.dark;
  roundRect(ctx, cx - 54, 28, Math.max(2, barW * ratio), 9, 4);
  ctx.fill();
  if (ratio >= 1) {
    drawText(ctx, 'X', cx - 54 + barW - 12, 36, 9, '#ffffff', 'center', '');
  }

  /* 우측: 라이프 / 시간 */
  panel(ctx, VIEW_W - 132, 6, 124, 42);
  for (let i = 0; i < Math.min(5, Math.max(0, world.lives)); i++) {
    ctx.fillStyle = '#e8453c';
    drawHeartShape(ctx, VIEW_W - 118 + i * 17, 22, 12);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (world.lives > 5) drawText(ctx, `+${world.lives - 5}`, VIEW_W - 22, 26, 10, '#ffffff', 'center');
  const low = world.timeLeft < 30;
  drawText(
    ctx,
    `TIME ${formatTime(world.timeLeft)}`,
    VIEW_W - 70,
    42,
    12,
    low && Math.floor(time * 4) % 2 === 0 ? '#ff7d70' : '#ffffff',
    'center',
  );

  /* 보스 체력 바 */
  if (world.boss && world.boss.alive) {
    const w = 240;
    const x = VIEW_W / 2 - w / 2;
    panel(ctx, x - 6, 56, w + 12, 26);
    drawText(ctx, '미스터 제로', x, 66, 11, '#ff9ac9', 'left');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, x, 68, w, 9, 4);
    ctx.fill();
    ctx.fillStyle = '#e8453c';
    roundRect(ctx, x, 68, Math.max(0, (w * world.boss.hp) / 3), 9, 4);
    ctx.fill();
    drawText(ctx, `PHASE ${world.boss.phase}`, x + w, 66, 10, '#ffd84d', 'right');
  }
}

/** 스테이지 시작 스플래시 */
export function drawStageIntro(ctx: Ctx, world: World, t: number): void {
  ctx.fillStyle = `rgba(12,14,24,${Math.min(0.75, 1.2 - t)})`;
  ctx.fillRect(0, 0, VIEW_W, 360);
  const cx = VIEW_W / 2;
  drawText(ctx, `스테이지 ${world.level.id}`, cx, 150, 22, '#ffd84d', 'center');
  drawText(ctx, world.level.name, cx, 190, 30, '#ffffff', 'center');
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = COLORS.coin;
  drawStarShape(ctx, cx, 232, 12, t * 3);
  ctx.fill();
  ctx.restore();
}
