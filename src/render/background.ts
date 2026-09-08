import { VIEW_W, VIEW_H } from '../core/constants';
import { createRng } from '../core/rng';
import { THEMES, type Theme } from './palette';
import type { Ctx } from './sprites';

interface Cloud {
  x: number;
  y: number;
  scale: number;
}

interface Peak {
  x: number;
  h: number;
  w: number;
}

interface Prop {
  x: number;
  kind: number;
  scale: number;
}

interface Layers {
  clouds: Cloud[];
  far: Peak[];
  near: Peak[];
  props: Prop[];
  worldW: number;
}

const cache = new Map<string, Layers>();

function buildLayers(themeKey: string, worldW: number): Layers {
  const key = `${themeKey}:${worldW}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = createRng(worldW * 2654435761 + themeKey.length * 97);
  const clouds: Cloud[] = [];
  for (let x = 0; x < worldW + VIEW_W; x += 150) {
    clouds.push({ x: x + rng.range(-40, 40), y: rng.range(18, 120), scale: rng.range(0.6, 1.35) });
  }
  const far: Peak[] = [];
  for (let x = -100; x < worldW + VIEW_W; x += 140) {
    far.push({ x: x + rng.range(-30, 30), h: rng.range(70, 130), w: rng.range(130, 210) });
  }
  const near: Peak[] = [];
  for (let x = -100; x < worldW + VIEW_W; x += 110) {
    near.push({ x: x + rng.range(-25, 25), h: rng.range(50, 92), w: rng.range(110, 170) });
  }
  const props: Prop[] = [];
  for (let x = 0; x < worldW + VIEW_W; x += 90) {
    props.push({ x: x + rng.range(-30, 30), kind: rng.int(0, 2), scale: rng.range(0.75, 1.25) });
  }
  const layers = { clouds, far, near, props, worldW };
  cache.set(key, layers);
  return layers;
}

function drawCloud(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
  ctx.arc(x + 15 * s, y - 7 * s, 17 * s, 0, Math.PI * 2);
  ctx.arc(x + 33 * s, y, 13 * s, 0, Math.PI * 2);
  ctx.rect(x - 2 * s, y, 37 * s, 13 * s);
  ctx.fill();
}

function drawPeaks(ctx: Ctx, peaks: Peak[], baseY: number, color: string, offset: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-VIEW_W, baseY);
  for (const p of peaks) {
    const x = p.x - offset;
    if (x + p.w < -80 || x - p.w > VIEW_W + 80) continue;
    ctx.moveTo(x - p.w / 2, baseY);
    ctx.lineTo(x, baseY - p.h);
    ctx.lineTo(x + p.w / 2, baseY);
    ctx.closePath();
  }
  ctx.fill();
}

function drawBush(ctx: Ctx, x: number, y: number, s: number, color: string, dark: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 13 * s, Math.PI, 0);
  ctx.arc(x + 16 * s, y, 17 * s, Math.PI, 0);
  ctx.arc(x + 32 * s, y, 12 * s, Math.PI, 0);
  ctx.rect(x - 13 * s, y - 2, 58 * s, 6);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(x - 13 * s, y + 1, 58 * s, 3);
}

function drawStalactite(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y);
  ctx.lineTo(x, y + 46 * s);
  ctx.lineTo(x + 14 * s, y);
  ctx.closePath();
  ctx.fill();
}

/** 파랄랙스 배경 전체를 그린다. */
export function drawBackground(ctx: Ctx, themeKey: string, camX: number, camY: number, worldW: number, time: number): void {
  const theme: Theme = THEMES[themeKey] ?? THEMES.field;
  const layers = buildLayers(themeKey, worldW);

  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, theme.skyTop);
  grad.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (!theme.dark) {
    // 해
    ctx.fillStyle = 'rgba(255,244,190,0.85)';
    ctx.beginPath();
    ctx.arc(VIEW_W - 78, 62, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(VIEW_W - 78, 62, 38, 0, Math.PI * 2);
    ctx.fill();

    const cloudOffset = camX * 0.15;
    for (const c of layers.clouds) {
      const x = c.x - cloudOffset;
      if (x < -90 || x > VIEW_W + 90) continue;
      drawCloud(ctx, x, c.y + Math.sin(time * 0.4 + c.x) * 2, c.scale);
    }
  } else {
    // 동굴: 위쪽 종유석 + 은은한 빛
    const off = camX * 0.3;
    for (const p of layers.far) {
      const x = p.x - off;
      if (x < -60 || x > VIEW_W + 60) continue;
      drawStalactite(ctx, x, 0, 0.6 + (p.h % 40) / 60, theme.mountainFar);
    }
    ctx.fillStyle = 'rgba(255,180,90,0.06)';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 197 - camX * 0.5) % (VIEW_W + 200)) - 100;
      ctx.beginPath();
      ctx.arc(x, VIEW_H * 0.7, 90, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 지면(13행) 위쪽에 소품이 보이도록 지평선을 잡는다
  const horizon = VIEW_H - 104 - camY * 0.08;
  drawPeaks(ctx, layers.far, horizon, theme.mountainFar, camX * 0.3);
  drawPeaks(ctx, layers.near, horizon + 18, theme.mountainNear, camX * 0.45);

  ctx.fillStyle = theme.hill;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  ctx.lineTo(0, horizon + 16);
  for (let x = 0; x <= VIEW_W; x += 32) {
    ctx.quadraticCurveTo(x + 16, horizon + 8 + Math.sin((x + camX * 0.55) * 0.02) * 4, x + 32, horizon + 16);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();

  const propOffset = camX * 0.55;
  for (const p of layers.props) {
    const x = p.x - propOffset;
    if (x < -80 || x > VIEW_W + 80) continue;
    if (theme.dark) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, horizon + 16, 26 * p.scale, VIEW_H);
    } else if (p.kind === 0) {
      drawBush(ctx, x, horizon + 22, p.scale, '#4aa04f', '#35803c');
    } else if (p.kind === 1) {
      // 나무
      ctx.fillStyle = '#7a4a1e';
      ctx.fillRect(x - 4, horizon - 4, 9, 26);
      ctx.fillStyle = '#3f9445';
      ctx.beginPath();
      ctx.arc(x, horizon - 10, 20 * p.scale, 0, Math.PI * 2);
      ctx.arc(x - 13 * p.scale, horizon - 2, 13 * p.scale, 0, Math.PI * 2);
      ctx.arc(x + 13 * p.scale, horizon - 2, 13 * p.scale, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawBush(ctx, x, horizon + 24, p.scale * 0.7, '#3f9445', '#2c6e33');
    }
  }
}

/** 어두운 스테이지의 비네트 */
export function drawVignette(ctx: Ctx, themeKey: string, px: number, py: number): void {
  const theme = THEMES[themeKey] ?? THEMES.field;
  if (!theme.dark) return;
  const grad = ctx.createRadialGradient(px, py, 40, px, py, 300);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,10,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
