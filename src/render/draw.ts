import { TILE, VIEW_W, VIEW_H } from '../core/constants';
import { getTile, isSolidAt, Tile } from '../engine/tilemap';
import { shapeOf } from '../game/shapes';
import type { Player } from '../game/player';
import type { World } from '../game/world';
import type { Enemy } from '../game/enemies';
import type { Item } from '../game/items';
import { COLORS, NUMBER_COLORS, RAINBOW, THEMES } from './palette';
import {
  drawCube,
  drawEyes,
  drawHeartShape,
  drawLimb,
  drawSmile,
  drawStarShape,
  drawText,
  roundRect,
  type Ctx,
} from './sprites';
import { drawBackground, drawVignette } from './background';

/* ── 타일 ─────────────────────────────────────────────── */

function drawGroundTile(ctx: Ctx, x: number, y: number, topExposed: boolean, dark: boolean): void {
  ctx.fillStyle = dark ? '#4a4256' : COLORS.dirt;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = dark ? '#372f42' : COLORS.dirtDark;
  ctx.fillRect(x, y + TILE - 4, TILE, 4);
  ctx.fillRect(x + TILE - 3, y, 3, TILE);
  // 흙 알갱이
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x + 5, y + 8, 3, 3);
  ctx.fillRect(x + 14, y + 15, 4, 3);
  if (topExposed) {
    ctx.fillStyle = dark ? '#6b5f7d' : COLORS.grass;
    ctx.fillRect(x, y, TILE, 8);
    ctx.fillStyle = dark ? '#54496a' : COLORS.grassDark;
    ctx.fillRect(x, y + 7, TILE, 3);
    ctx.fillStyle = dark ? '#6b5f7d' : COLORS.grass;
    ctx.fillRect(x + 3, y - 3, 4, 4);
    ctx.fillRect(x + 14, y - 2, 4, 3);
  }
  ctx.strokeStyle = 'rgba(32,35,46,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
}

function drawBrickTile(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = COLORS.brick;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = COLORS.brickDark;
  ctx.fillRect(x, y + TILE / 2 - 1, TILE, 2);
  ctx.fillRect(x, y + TILE - 2, TILE, 2);
  ctx.fillRect(x + TILE / 2 - 1, y, 2, TILE / 2);
  ctx.fillRect(x + TILE / 4 - 1, y + TILE / 2, 2, TILE / 2);
  ctx.fillRect(x + (TILE * 3) / 4 - 1, y + TILE / 2, 2, TILE / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, TILE, 2);
}

function drawQuestionTile(ctx: Ctx, x: number, y: number, time: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  ctx.fillStyle = COLORS.question;
  roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 4);
  ctx.fill();
  ctx.strokeStyle = COLORS.questionDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${0.25 + pulse * 0.35})`;
  roundRect(ctx, x + 4, y + 4, TILE - 8, 5, 2);
  ctx.fill();
  drawText(ctx, '?', x + TILE / 2, y + TILE - 6, 15, '#ffffff', 'center', COLORS.outline);
}

function drawUsedTile(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#a9791a';
  roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
}

function drawStoneTile(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = COLORS.stone;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = COLORS.stoneDark;
  ctx.fillRect(x, y + TILE - 3, TILE, 3);
  ctx.fillRect(x + TILE - 3, y, 3, TILE);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x + 2, y + 2, TILE - 6, 3);
}

function drawOneWayTile(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#c98b4a';
  roundRect(ctx, x, y + 2, TILE, 8, 3);
  ctx.fill();
  ctx.fillStyle = '#8b5420';
  ctx.fillRect(x, y + 8, TILE, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x + 2, y + 3, TILE - 4, 2);
}

function drawSpikeTile(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = COLORS.spike;
  for (let i = 0; i < 3; i++) {
    const sx = x + i * 8;
    ctx.beginPath();
    ctx.moveTo(sx, y + TILE);
    ctx.lineTo(sx + 4, y + 6);
    ctx.lineTo(sx + 8, y + TILE);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = COLORS.spikeDark;
  ctx.fillRect(x, y + TILE - 4, TILE, 4);
}

function drawLavaTile(ctx: Ctx, x: number, y: number, time: number, surface: boolean): void {
  ctx.fillStyle = COLORS.lava;
  ctx.fillRect(x, y, TILE, TILE);
  if (surface) {
    ctx.fillStyle = COLORS.lavaLight;
    const wave = Math.sin(time * 3 + x * 0.09) * 2;
    ctx.fillRect(x, y + 2 + wave, TILE, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + 4, y + 3 + wave, 6, 2);
  }
  ctx.fillStyle = 'rgba(255,120,40,0.5)';
  ctx.fillRect(x, y + TILE - 6, TILE, 6);
}

function drawRainbowTile(ctx: Ctx, x: number, y: number, tx: number, time: number): void {
  const bands = 4;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = RAINBOW[(tx + i + Math.floor(time * 4)) % RAINBOW.length];
    ctx.fillRect(x, y + i * (TILE / bands), TILE, TILE / bands);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, TILE, 3);
}

export function drawTiles(ctx: Ctx, world: World, time: number, dark: boolean): void {
  const map = world.map;
  const x0 = Math.max(0, Math.floor(world.camera.offsetX / TILE) - 1);
  const x1 = Math.min(map.w - 1, Math.floor((world.camera.offsetX + VIEW_W) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(world.camera.offsetY / TILE) - 1);
  const y1 = Math.min(map.h - 1, Math.floor((world.camera.offsetY + VIEW_H) / TILE) + 1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = getTile(map, tx, ty);
      if (t === Tile.Empty) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      switch (t) {
        case Tile.Ground:
          drawGroundTile(ctx, x, y, !isSolidAt(map, tx, ty - 1), dark);
          break;
        case Tile.Brick:
          drawBrickTile(ctx, x, y);
          break;
        case Tile.Question:
          drawQuestionTile(ctx, x, y, time);
          break;
        case Tile.Used:
          drawUsedTile(ctx, x, y);
          break;
        case Tile.Stone:
          drawStoneTile(ctx, x, y);
          break;
        case Tile.OneWay:
          drawOneWayTile(ctx, x, y);
          break;
        case Tile.Spike:
          drawSpikeTile(ctx, x, y);
          break;
        case Tile.Lava:
          drawLavaTile(ctx, x, y, time, getTile(map, tx, ty - 1) !== Tile.Lava);
          break;
        case Tile.Rainbow:
          drawRainbowTile(ctx, x, y, tx, time);
          break;
        default:
          break;
      }
    }
  }
}

/* ── 플레이어 ─────────────────────────────────────────── */

export function drawPlayer(ctx: Ctx, player: Player, time: number): void {
  const cells = shapeOf(player.number);
  const color = NUMBER_COLORS[player.number];
  const bx = player.box.x + player.box.w / 2;
  const by = player.box.y + player.box.h;
  const moving = Math.abs(player.vx) > 12;
  const blink = Math.sin(time * 1.7) > 0.97;

  ctx.save();
  ctx.translate(bx, by);
  if (player.rollTime > 0) {
    ctx.translate(0, -player.box.h / 2);
    ctx.rotate(time * 16 * player.facing);
    ctx.translate(0, player.box.h / 2);
  }
  const sy = player.squash;
  ctx.scale(1 / sy, sy);

  if (player.flashing) ctx.globalAlpha = 0.55;

  const w = player.box.w;
  const h = player.box.h;
  const left = -w / 2;

  // 다리
  const swing = moving ? Math.sin(player.walkPhase * 6) * 5 : 0;
  const legY = 0;
  drawLimb(ctx, left + w * 0.32, legY - 4, left + w * 0.32 - swing, legY + 5, 3.4);
  drawLimb(ctx, left + w * 0.68, legY - 4, left + w * 0.68 + swing, legY + 5, 3.4);
  ctx.fillStyle = COLORS.outline;
  ctx.beginPath();
  ctx.ellipse(left + w * 0.32 - swing, legY + 6, 4.5, 2.6, 0, 0, Math.PI * 2);
  ctx.ellipse(left + w * 0.68 + swing, legY + 6, 4.5, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 팔
  const armSwing = moving ? Math.cos(player.walkPhase * 6) * 6 : Math.sin(time * 2) * 2;
  const armY = -h * 0.55;
  drawLimb(ctx, left + 2, armY, left - 7, armY + armSwing, 3.2);
  drawLimb(ctx, left + w - 2, armY, left + w + 7, armY - armSwing, 3.2);
  ctx.fillStyle = COLORS.white;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 1.4;
  for (const hx of [left - 8, left + w + 8]) {
    ctx.beginPath();
    ctx.arc(hx, armY + (hx < 0 ? armSwing : -armSwing), 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 큐브 스택
  // 얼굴은 가장 윗줄 중에서 가로 중앙에 가까운 큐브에 그린다
  let topCell = cells[0];
  const maxRow = cells.reduce((m, c) => Math.max(m, c.row), 0);
  const centerCol = (player.box.w / TILE - 1) / 2;
  for (const c of cells) {
    if (c.row !== maxRow) continue;
    if (topCell.row !== maxRow || Math.abs(c.col - centerCol) < Math.abs(topCell.col - centerCol)) {
      topCell = c;
    }
  }
  for (const c of cells) {
    const cx = left + c.col * TILE;
    const cy = -(c.row + 1) * TILE;
    const useAlt = player.number === 10 && c.col > 0;
    const base = useAlt ? color.alt ?? color.base : color.base;
    const light = useAlt ? '#ffffff' : color.light;
    const dark = useAlt ? '#c9c9d6' : color.dark;
    drawCube(ctx, cx, cy, TILE, base, light, dark);
  }

  // 얼굴 (가장 위 큐브)
  const faceX = left + topCell.col * TILE + TILE / 2;
  const faceY = -(topCell.row + 1) * TILE + TILE * 0.42;
  drawEyes(ctx, faceX, faceY, TILE, player.facing, blink);
  drawSmile(ctx, faceX, faceY + TILE * 0.3, TILE);

  // 숫자 배지 (얼굴이 있는 큐브와 겹치지 않을 때만)
  const badgeCell = cells[0];
  if (badgeCell !== topCell) {
    drawText(
      ctx,
      String(player.number),
      left + badgeCell.col * TILE + TILE / 2,
      -(badgeCell.row + 1) * TILE + TILE * 0.72,
      13,
      '#ffffff',
      'center',
      COLORS.outline,
    );
  }

  ctx.globalAlpha = 1;
  ctx.restore();

  // 실드
  if (player.shieldTime > 0) {
    ctx.save();
    ctx.strokeStyle = '#8fe07f';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.5 + 0.35 * Math.sin(time * 12);
    roundRect(ctx, player.box.x - 6, player.box.y - 6, player.box.w + 12, player.box.h + 12, 8);
    ctx.stroke();
    ctx.restore();
  }

  // 슈퍼 오라
  if (player.superTime > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = RAINBOW[Math.floor(time * 12) % RAINBOW.length];
    ctx.lineWidth = 4;
    roundRect(ctx, player.box.x - 4, player.box.y - 4, player.box.w + 8, player.box.h + 8, 8);
    ctx.stroke();
    ctx.restore();
  }

  // 글라이드 날개
  if (player.gliding) {
    ctx.save();
    ctx.fillStyle = color.light;
    ctx.globalAlpha = 0.85;
    const wy = player.box.y + player.box.h * 0.3;
    ctx.beginPath();
    ctx.moveTo(player.box.x, wy);
    ctx.lineTo(player.box.x - 20, wy + 14);
    ctx.lineTo(player.box.x, wy + 16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(player.box.x + player.box.w, wy);
    ctx.lineTo(player.box.x + player.box.w + 20, wy + 14);
    ctx.lineTo(player.box.x + player.box.w, wy + 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 갈고리 줄
  if (player.grapple.active) {
    ctx.strokeStyle = '#ee5fa7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.centerX, player.centerY);
    ctx.lineTo(player.grapple.x, player.grapple.y);
    ctx.stroke();
    ctx.fillStyle = '#ff9ac9';
    ctx.beginPath();
    ctx.arc(player.grapple.x, player.grapple.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ── 적 ───────────────────────────────────────────────── */

export function drawEnemy(ctx: Ctx, e: Enemy, time: number): void {
  const b = e.box;
  ctx.save();
  if (!e.alive) {
    ctx.globalAlpha = Math.max(0, e.dying);
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.rotate((1 - e.dying) * 3);
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
  }
  switch (e.kind) {
    case 'minusbug': {
      const bob = Math.sin(e.anim * 8) * 2;
      ctx.fillStyle = '#9aa3b5';
      roundRect(ctx, b.x, b.y + bob, b.w, b.h, 6);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.outline;
      ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.45 + bob, b.w * 0.5, 3);
      drawEyes(ctx, b.x + b.w / 2, b.y + b.h * 0.3 + bob, b.w * 0.8, e.facing);
      break;
    }
    case 'divbat': {
      const flap = Math.sin(e.anim * 14) * 6;
      ctx.fillStyle = '#8c4fd0';
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2, b.y + b.h / 2);
      ctx.lineTo(b.x - 10, b.y + flap);
      ctx.lineTo(b.x - 2, b.y + b.h);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2, b.y + b.h / 2);
      ctx.lineTo(b.x + b.w + 10, b.y + flap);
      ctx.lineTo(b.x + b.w + 2, b.y + b.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a86fe0';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      // ÷ 기호
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.5, b.w * 0.4, 2);
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h * 0.36, 1.8, 0, Math.PI * 2);
      ctx.arc(b.x + b.w / 2, b.y + b.h * 0.66, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'zeroslime': {
      const squish = 1 + Math.sin(e.anim * 6) * 0.08;
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h);
      ctx.scale(squish, 2 - squish);
      ctx.fillStyle = '#2f3346';
      ctx.beginPath();
      ctx.ellipse(0, -b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#12141f';
      ctx.beginPath();
      ctx.ellipse(0, -b.h / 2, b.w / 6, b.h / 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawEyes(ctx, b.x + b.w / 2, b.y + b.h * 0.35, b.w * 0.7, 1);
      break;
    }
    case 'boss': {
      const boss = e as unknown as { invuln: number; phase: number };
      const wob = Math.sin(time * 6) * 3;
      ctx.globalAlpha *= boss.invuln > 0 && Math.floor(time * 20) % 2 === 0 ? 0.5 : 1;
      ctx.fillStyle = '#23263a';
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2 + wob, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0d0f18';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#0d0f18';
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2 + wob, b.w / 6, b.h / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      drawEyes(ctx, b.x + b.w / 2, b.y + b.h * 0.3 + wob, b.w * 0.55, e.facing);
      // 페이즈 표시(체력)
      for (let i = 0; i < e.hp; i++) {
        ctx.fillStyle = '#ff5a5a';
        ctx.fillRect(b.x + 6 + i * 16, b.y - 14, 12, 6);
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/* ── 아이템 ───────────────────────────────────────────── */

export function drawItem(ctx: Ctx, item: Item, time: number): void {
  const b = item.box;
  const bob = Math.sin(item.anim * 3) * 2;
  switch (item.kind) {
    case 'coin': {
      const squeeze = Math.abs(Math.cos(item.anim * 4));
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2 + bob);
      ctx.scale(Math.max(0.15, squeeze), 1);
      ctx.fillStyle = COLORS.coin;
      ctx.beginPath();
      ctx.arc(0, 0, b.w / 2 + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.coinDark;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'orb': {
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2 + bob);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, b.w * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57b947';
      ctx.beginPath();
      ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(-b.w * 0.28, -2.5, b.w * 0.56, 5);
      ctx.fillRect(-2.5, -b.w * 0.28, 5, b.w * 0.56);
      ctx.restore();
      break;
    }
    case 'heart': {
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2 + bob);
      ctx.fillStyle = '#e8453c';
      drawHeartShape(ctx, 0, 0, b.w * 0.9);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'checkpoint': {
      const active = item.value === 1;
      ctx.fillStyle = '#6a7290';
      ctx.fillRect(b.x + b.w / 2 - 2, b.y, 4, b.h);
      ctx.fillStyle = active ? '#5fcf5a' : '#c9cfdb';
      const wave = active ? Math.sin(time * 6) * 3 : 0;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2 + 2, b.y + 2);
      ctx.lineTo(b.x + b.w / 2 + 22 + wave, b.y + 9);
      ctx.lineTo(b.x + b.w / 2 + 2, b.y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'goal': {
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2 + bob);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffe98a';
      drawStarShape(ctx, 0, 0, b.w * 0.95, time * 1.2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.coin;
      drawStarShape(ctx, 0, 0, b.w * 0.7, -time * 1.6);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'numberpad': {
      const c = NUMBER_COLORS[item.value] ?? NUMBER_COLORS[1];
      ctx.fillStyle = c.base;
      roundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 2);
      drawText(ctx, String(item.value), b.x + b.w / 2, b.y - 4, 14, c.light, 'center', COLORS.outline);
      break;
    }
    default:
      break;
  }
}

/* ── 월드 전체 ────────────────────────────────────────── */

export function drawWorld(ctx: Ctx, world: World, time: number): void {
  const theme = THEMES[world.level.theme] ?? THEMES.field;
  drawBackground(ctx, world.level.theme, world.camera.offsetX, world.camera.offsetY, world.map.w * TILE, time);

  ctx.save();
  ctx.translate(-world.camera.offsetX, -world.camera.offsetY);

  drawTiles(ctx, world, time, theme.dark);

  // 이동 발판
  for (const p of world.platforms) {
    ctx.fillStyle = '#c98b4a';
    roundRect(ctx, p.box.x, p.box.y, p.box.w, p.box.h + 4, 4);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(p.box.x + 3, p.box.y + 2, p.box.w - 6, 2);
  }

  for (const item of world.items) drawItem(ctx, item, time);
  for (const e of world.enemies) drawEnemy(ctx, e, time);

  // 떨어지는 블록
  for (const b of world.fallingBlocks) {
    if (b.warn > 0) {
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 20);
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(b.box.x, b.box.y, b.box.w, 4);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#3a3f55';
      roundRect(ctx, b.box.x, b.box.y, b.box.w, b.box.h, 3);
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // 별 발사체
  for (const s of world.stars) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.spin);
    ctx.fillStyle = COLORS.coin;
    drawStarShape(ctx, 0, 0, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  if (!world.player.dead || world.player.deadTimer < 2) drawPlayer(ctx, world.player, time);

  // 파티클
  for (const p of world.particles.items) {
    const alpha = p.fade ? Math.max(0, p.life / p.maxLife) : 1;
    ctx.globalAlpha = alpha;
    if (p.kind === 'text') {
      drawText(ctx, p.text ?? '', p.x, p.y, p.size + 4, p.color, 'center', COLORS.outline);
    } else if (p.kind === 'circle') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  drawVignette(
    ctx,
    world.level.theme,
    world.player.centerX - world.camera.offsetX,
    world.player.centerY - world.camera.offsetY,
  );
}
