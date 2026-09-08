import { COLORS } from './palette';

export type Ctx = CanvasRenderingContext2D;

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** 캐릭터/블록 공통의 입체감 있는 큐브 */
export function drawCube(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  base: string,
  light: string,
  dark: string,
  outline = COLORS.outline,
): void {
  const r = Math.max(2, size * 0.16);
  ctx.fillStyle = base;
  roundRect(ctx, x, y, size, size, r);
  ctx.fill();

  // 좌상단 하이라이트
  ctx.fillStyle = light;
  ctx.globalAlpha = 0.85;
  roundRect(ctx, x + size * 0.12, y + size * 0.12, size * 0.32, size * 0.16, r * 0.5);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 우하단 음영
  ctx.fillStyle = dark;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + size, y + size * 0.35);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + size * 0.35, y + size);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  roundRect(ctx, x, y, size, size, r);
  ctx.stroke();
}

/** 큰 흰자 + 진행 방향을 보는 동공 */
export function drawEyes(
  ctx: Ctx,
  cx: number,
  cy: number,
  size: number,
  facing: number,
  blink = false,
): void {
  const eyeR = size * 0.17;
  const gap = size * 0.24;
  for (const sign of [-1, 1]) {
    const ex = cx + sign * gap;
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(ex, cy, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.stroke();
    if (blink) {
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = Math.max(1.4, size * 0.06);
      ctx.beginPath();
      ctx.moveTo(ex - eyeR * 0.8, cy);
      ctx.lineTo(ex + eyeR * 0.8, cy);
      ctx.stroke();
    } else {
      ctx.fillStyle = COLORS.outline;
      ctx.beginPath();
      ctx.arc(ex + facing * eyeR * 0.35, cy + eyeR * 0.1, eyeR * 0.48, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawSmile(ctx: Ctx, cx: number, cy: number, size: number): void {
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = Math.max(1.2, size * 0.055);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

export function drawLimb(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color = COLORS.outline,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

export function drawStarShape(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  rotation = 0,
  points = 5,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const a = rotation + (i * Math.PI) / points - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawHeartShape(ctx: Ctx, cx: number, cy: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.35);
  ctx.bezierCurveTo(cx - size, cy - size * 0.2, cx - size * 0.35, cy - size * 0.75, cx, cy - size * 0.25);
  ctx.bezierCurveTo(cx + size * 0.35, cy - size * 0.75, cx + size, cy - size * 0.2, cx, cy + size * 0.35);
  ctx.closePath();
}

/** 픽셀 느낌의 굵은 텍스트 (외곽선 포함) */
export function drawText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string = COLORS.white,
  align: CanvasTextAlign = 'left',
  outline: string = COLORS.outline,
): void {
  ctx.font = `bold ${size}px "Trebuchet MS", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (outline) {
    ctx.lineWidth = Math.max(2, size * 0.22);
    ctx.strokeStyle = outline;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function measureText(ctx: Ctx, text: string, size: number): number {
  ctx.font = `bold ${size}px "Trebuchet MS", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  return ctx.measureText(text).width;
}
