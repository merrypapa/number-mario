import { VIEW_H, VIEW_W } from '../core/constants';
import { MAP_NODES, MAP_PATHS, pathPoint, type MapNode } from '../game/worldmap';
import { NUMBER_COLORS, RAINBOW } from './palette';
import { drawCube, drawEyes, drawStarShape, drawText, roundRect, type Ctx } from './sprites';

const SEA_TOP = '#1c7fd6';
const SEA_BOTTOM = '#0e4f8f';
const SAND = '#f0d9a0';
const SAND_DARK = '#c9ab72';

function drawSea(ctx: Ctx, time: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, SEA_TOP);
  g.addColorStop(1, SEA_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 잔물결
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 9; row++) {
    const y = 24 + row * 38;
    ctx.beginPath();
    for (let x = -20; x < VIEW_W + 20; x += 8) {
      const yy = y + Math.sin((x + time * 22 + row * 40) * 0.05) * 2.4;
      if (x === -20) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

/** 섬 (모래 테두리 + 지형) */
function drawIsland(ctx: Ctx, node: MapNode): void {
  const r = node.island;
  ctx.fillStyle = SAND;
  ctx.beginPath();
  ctx.ellipse(node.x, node.y + 8, r, r * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SAND_DARK;
  ctx.beginPath();
  ctx.ellipse(node.x, node.y + 13, r * 0.94, r * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();

  const ground: Record<MapNode['icon'], string> = {
    grass: '#57b947',
    hill: '#c98b5a',
    canyon: '#7a6ac9',
    cave: '#4a4256',
    tower: '#3b3350',
  };
  ctx.fillStyle = ground[node.icon];
  ctx.beginPath();
  ctx.ellipse(node.x, node.y + 6, r * 0.82, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 지점마다 다른 표지 */
function drawIcon(ctx: Ctx, node: MapNode, time: number): void {
  const x = node.x;
  const y = node.y - 6;
  switch (node.icon) {
    case 'grass':
      ctx.fillStyle = '#7a4a1e';
      ctx.fillRect(x - 3, y - 2, 6, 14);
      ctx.fillStyle = '#3f9445';
      ctx.beginPath();
      ctx.arc(x, y - 8, 13, 0, Math.PI * 2);
      ctx.arc(x - 9, y - 1, 9, 0, Math.PI * 2);
      ctx.arc(x + 9, y - 1, 9, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'hill':
      ctx.fillStyle = '#a86f52';
      ctx.beginPath();
      ctx.moveTo(x - 18, y + 12);
      ctx.lineTo(x, y - 14);
      ctx.lineTo(x + 18, y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c9773c';
      ctx.fillRect(x - 8, y + 2, 16, 10);
      break;
    case 'canyon':
      ctx.fillStyle = '#5a4d9c';
      ctx.fillRect(x - 20, y - 6, 12, 18);
      ctx.fillRect(x + 8, y - 6, 12, 18);
      RAINBOW.slice(0, 5).forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(x, y + 12, 15 - i * 2.6, Math.PI, 0);
        ctx.stroke();
      });
      break;
    case 'cave':
      ctx.fillStyle = '#6b5f7d';
      ctx.beginPath();
      ctx.moveTo(x - 20, y + 12);
      ctx.lineTo(x - 12, y - 12);
      ctx.lineTo(x + 12, y - 12);
      ctx.lineTo(x + 20, y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#12141f';
      ctx.beginPath();
      ctx.ellipse(x, y + 12, 10, 12, 0, Math.PI, 0);
      ctx.fill();
      break;
    case 'tower': {
      ctx.fillStyle = '#2a1d40';
      ctx.fillRect(x - 16, y - 16, 32, 30);
      ctx.fillStyle = '#1a1230';
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 16 + i * 9, y - 22, 6, 8);
      ctx.fillStyle = '#12141f';
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 7, 9, 0, Math.PI, 0);
      ctx.fill();
      // 번개
      ctx.fillStyle = `rgba(255,216,77,${0.35 + 0.35 * Math.sin(time * 6)})`;
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 34);
      ctx.lineTo(x - 4, y - 24);
      ctx.lineTo(x, y - 24);
      ctx.lineTo(x - 3, y - 15);
      ctx.lineTo(x + 6, y - 27);
      ctx.lineTo(x + 1, y - 27);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      break;
  }
}

/** 지도 위를 걷는 작은 플레이어 */
function drawMarker(ctx: Ctx, x: number, y: number, time: number): void {
  const bob = Math.sin(time * 5) * 2.5;
  const c = NUMBER_COLORS[1];
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawCube(ctx, x - 10, y - 22 + bob, 20, c.base, c.light, c.dark);
  drawEyes(ctx, x, y - 13 + bob, 20, 1);
}

export interface MapView {
  /** 열려 있는 스테이지 수(인덱스) */
  unlocked: number;
  /** 지금 고른 지점 */
  cursor: number;
  /** 말의 현재 위치 */
  marker: { x: number; y: number };
  /** 클리어한 스테이지 수 */
  cleared: number;
  time: number;
  /** 이동 연출 중이면 조작 안내를 감춘다 */
  moving: boolean;
}

export function drawWorldMap(ctx: Ctx, view: MapView): void {
  drawSea(ctx, view.time);

  // 길
  for (const [a, b] of MAP_PATHS) {
    const from = MAP_NODES[a];
    const to = MAP_NODES[b];
    const open = a < view.unlocked || b <= view.unlocked;
    ctx.strokeStyle = open ? 'rgba(255,216,77,0.95)' : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 5;
    ctx.setLineDash([9, 7]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const p = pathPoint(from, to, i / 24);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
  }

  // 섬과 지점
  for (const node of MAP_NODES) {
    const locked = node.levelIndex > view.unlocked;
    ctx.save();
    if (locked) ctx.globalAlpha = 0.45;
    drawIsland(ctx, node);
    drawIcon(ctx, node, view.time);
    ctx.restore();

    const done = node.levelIndex < view.cleared;
    // 이름표
    const label = `${node.id} ${node.name}`;
    const w = Math.max(74, label.length * 8.2);
    const ly = node.y + node.island * 0.62 + 6;
    ctx.fillStyle = 'rgba(12,20,38,0.78)';
    roundRect(ctx, node.x - w / 2, ly, w, 17, 5);
    ctx.fill();
    if (node.levelIndex === view.cursor) {
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 2;
      roundRect(ctx, node.x - w / 2, ly, w, 17, 5);
      ctx.stroke();
    }
    drawText(ctx, label, node.x, ly + 13, 10.5, locked ? '#8fa0c0' : '#ffffff', 'center');

    if (done) {
      // 클리어 표시 별
      ctx.save();
      ctx.fillStyle = '#ffd84d';
      drawStarShape(ctx, node.x + w / 2 + 8, ly + 8, 7, view.time);
      ctx.fill();
      ctx.strokeStyle = '#20232e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    if (locked) {
      drawText(ctx, '자물쇠', node.x, node.y - 26, 9, '#cfd6e4', 'center');
    }
  }

  drawMarker(ctx, view.marker.x, view.marker.y, view.time);

  // 머리말
  ctx.fillStyle = 'rgba(12,20,38,0.72)';
  roundRect(ctx, 8, 8, 178, 30, 7);
  ctx.fill();
  drawText(ctx, '카운트랜드', 18, 29, 17, '#ffd84d', 'left');

  if (!view.moving) {
    const node = MAP_NODES[view.cursor];
    const msg = node.levelIndex > view.unlocked ? '아직 갈 수 없어요' : '▲ 눌러서 출발!';
    ctx.fillStyle = 'rgba(12,20,38,0.72)';
    roundRect(ctx, VIEW_W / 2 - 96, VIEW_H - 34, 192, 26, 7);
    ctx.fill();
    if (Math.floor(view.time * 2) % 2 === 0 || node.levelIndex > view.unlocked) {
      drawText(ctx, msg, VIEW_W / 2, VIEW_H - 16, 12, '#8fe07f', 'center');
    }
    drawText(ctx, '◀ ▶ 로 이동', VIEW_W - 12, 26, 10, '#cfd6e4', 'right');
  }
}
