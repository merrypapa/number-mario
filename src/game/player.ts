import {
  TILE,
  GROUND_ACCEL,
  AIR_ACCEL,
  GROUND_FRICTION,
  AIR_FRICTION,
  MAX_FALL_SPEED,
  COYOTE_TIME,
  JUMP_BUFFER,
  JUMP_CUT,
  INVULN_TIME,
  KID_INVULN_TIME,
  STOMP_BOUNCE,
  MIN_NUMBER,
  MAX_NUMBER,
} from '../core/constants';
import type { Input } from '../core/input';
import type { Box } from '../engine/aabb';
import { moveAndCollide, clamp } from '../engine/physics';
import { isSolidAt, tileRange, hazardOverlapping, Tile, getTile } from '../engine/tilemap';
import { numberStats, clampNumber, halveNumber } from './shapes';
import {
  createSkillState,
  resetSkillState,
  tickSkillState,
  useSkill,
  skillOf,
  type SkillState,
} from './skills';
import type { World } from './world';

const DASH_SPEED = 440;
const ROLL_SPEED = 320;
const SLAM_SPEED = 940;
const GRAPPLE_SPEED = 760;
const GRAPPLE_RANGE = 170;
const SUPER_SPEED_MULT = 1.6;

export interface GrappleState {
  active: boolean;
  /** 'shoot' 는 갈고리가 날아가는 중, 'pull' 은 당겨지는 중 */
  phase: 'shoot' | 'pull';
  x: number;
  y: number;
  vx: number;
  vy: number;
  time: number;
}

export class Player {
  box: Box = { x: 0, y: 0, w: TILE, h: TILE };
  vx = 0;
  vy = 0;
  number = 1;
  facing: 1 | -1 = 1;

  onGround = false;
  private coyote = 0;
  private jumpBuffer = 0;
  private jumping = false;

  invuln = 0;
  shieldTime = 0;
  superTime = 0;
  dashTime = 0;
  rollTime = 0;
  gliding = false;
  slamming = false;
  grapple: GrappleState = { active: false, phase: 'shoot', x: 0, y: 0, vx: 0, vy: 0, time: 0 };

  skill: SkillState = createSkillState(1);
  /** 착지 없이 연속으로 밟은 적 수 */
  stompCombo = 0;
  /** 숫자 변경 연출용 타이머 */
  morphTime = 0;
  walkPhase = 0;
  squash = 1;
  dead = false;
  deadTimer = 0;
  private superStarTimer = 0;
  private wasOnGround = false;

  constructor(private world: World) {}

  get centerX(): number {
    return this.box.x + this.box.w / 2;
  }

  get centerY(): number {
    return this.box.y + this.box.h / 2;
  }

  get bottom(): number {
    return this.box.y + this.box.h;
  }

  get invincible(): boolean {
    return this.invuln > 0 || this.superTime > 0 || this.dashTime > 0 || this.world.magicNumber;
  }

  /** 스폰/부활 시 상태 초기화 */
  spawnAt(x: number, y: number, number: number): void {
    this.number = clampNumber(number);
    this.resize(this.number);
    this.box.x = x - this.box.w / 2;
    this.box.y = y - this.box.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.invuln = 0;
    this.shieldTime = 0;
    this.superTime = 0;
    this.dashTime = 0;
    this.rollTime = 0;
    this.slamming = false;
    this.gliding = false;
    this.grapple.active = false;
    this.dead = false;
    this.deadTimer = 0;
    this.stompCombo = 0;
    resetSkillState(this.skill, this.number);
  }

  /** 히트박스를 숫자에 맞춰 바꾼다(발 위치·가로 중심 유지). */
  private resize(n: number): void {
    const stats = numberStats(n);
    const cx = this.box.x + this.box.w / 2;
    const bottom = this.box.y + this.box.h;
    this.box.w = stats.widthPx;
    this.box.h = stats.heightPx;
    this.box.x = cx - this.box.w / 2;
    this.box.y = bottom - this.box.h;
    this.unstick();
  }

  /** 지형에 파묻혔을 때 가장 가까운 빈 공간으로 밀어낸다. */
  private unstick(): void {
    const map = this.world.map;
    const overlapping = () => {
      const r = tileRange(this.box);
      for (let ty = r.y0; ty <= r.y1; ty++)
        for (let tx = r.x0; tx <= r.x1; tx++) if (isSolidAt(map, tx, ty)) return true;
      return false;
    };
    if (!overlapping()) return;
    for (let step = 1; step <= 6; step++) {
      const original = this.box.y;
      this.box.y = original + step * 4;
      if (!overlapping()) return;
      this.box.y = original - step * 4;
      if (!overlapping()) return;
      this.box.y = original;
    }
  }

  /** 그 숫자의 몸이 현재 위치에 들어갈 공간이 있는가 (끼임 방지). */
  fitsAs(n: number): boolean {
    const stats = numberStats(n);
    const cx = this.box.x + this.box.w / 2;
    const bottom = this.box.y + this.box.h;
    const test: Box = {
      x: cx - stats.widthPx / 2,
      y: bottom - stats.heightPx,
      w: stats.widthPx,
      h: stats.heightPx,
    };
    const r = tileRange(test);
    for (let ty = r.y0; ty <= r.y1; ty++)
      for (let tx = r.x0; tx <= r.x1; tx++) if (isSolidAt(this.world.map, tx, ty)) return false;
    return true;
  }

  setNumber(n: number, silent = false): void {
    const next = clampNumber(n);
    if (next === this.number) return;
    const grew = next > this.number;
    // 커질 공간이 없으면 성장을 취소하고 점수로 돌려준다(지형에 끼는 사고 방지)
    if (grew && !this.fitsAs(next)) {
      this.world.addScore(200, this.centerX, this.box.y);
      this.world.particles.floatingText(this.centerX, this.box.y - 6, '좁아요!', '#ffd84d');
      return;
    }
    this.number = next;
    this.resize(next);
    resetSkillState(this.skill, next);
    this.morphTime = 0.35;
    if (!silent) {
      this.world.audio.play(grew ? 'numberUp' : 'numberDown');
      this.world.particles.burst(this.centerX, this.centerY, 12, this.world.playerColor().light);
    }
  }

  addNumber(delta: number): void {
    if (delta > 0 && this.number >= MAX_NUMBER) {
      this.world.addScore(200, this.centerX, this.box.y);
      return;
    }
    this.setNumber(this.number + delta);
  }

  /** 피해 처리. 실드/무적을 고려하며 amount 만큼 숫자를 잃는다. */
  hurt(amount: number, fromX?: number, mode: 'normal' | 'halve' = 'normal'): void {
    if (this.dead || this.invincible) return;
    if (this.shieldTime > 0) {
      this.shieldTime = 0;
      this.invuln = 0.6;
      this.world.audio.play('break');
      this.world.particles.burst(this.centerX, this.centerY, 14, '#8fe07f');
      this.world.shake(4);
      return;
    }
    const next = mode === 'halve' ? halveNumber(this.number) : this.number - amount;
    if (mode === 'normal' && next < MIN_NUMBER) {
      this.die();
      return;
    }
    if (mode === 'halve' && next === this.number) {
      this.die();
      return;
    }
    this.setNumber(Math.max(MIN_NUMBER, next), true);
    this.invuln = this.world.kidMode ? KID_INVULN_TIME : INVULN_TIME;
    this.vy = -220;
    if (fromX !== undefined) this.vx = this.centerX < fromX ? -180 : 180;
    this.world.audio.play('hurt');
    this.world.shake(6);
    this.world.particles.burst(this.centerX, this.centerY, 16, '#ffffff');
  }

  die(): void {
    if (this.dead) return;
    this.dead = true;
    this.deadTimer = 0;
    this.vy = -420;
    this.vx = 0;
    this.world.audio.play('death');
    this.world.onPlayerDeath();
  }

  bounce(power = STOMP_BOUNCE): void {
    this.vy = -power;
    this.jumping = true;
    this.squash = 1.25;
  }

  update(dt: number, input: Input): void {
    if (this.dead) {
      this.deadTimer += dt;
      this.vy = Math.min(this.vy + 1500 * dt, MAX_FALL_SPEED);
      this.box.y += this.vy * dt;
      return;
    }

    const stats = numberStats(this.number);
    const def = skillOf(this.number);

    /* 타이머 진행 */
    this.invuln = Math.max(0, this.invuln - dt);
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    this.superTime = Math.max(0, this.superTime - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.rollTime = Math.max(0, this.rollTime - dt);
    this.morphTime = Math.max(0, this.morphTime - dt);
    tickSkillState(this.skill, dt, this.onGround, this.number);

    /* 입력 */
    const wantLeft = input.isDown('left');
    const wantRight = input.isDown('right');
    const wantDown = input.isDown('down');
    let dir = (wantRight ? 1 : 0) - (wantLeft ? 1 : 0);
    if (this.rollTime > 0 || this.dashTime > 0) dir = this.facing;
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;

    /* 수평 이동 */
    let maxSpeed = stats.moveSpeed;
    if (this.superTime > 0) maxSpeed *= SUPER_SPEED_MULT;
    if (this.rollTime > 0) maxSpeed = ROLL_SPEED;
    if (this.dashTime > 0) maxSpeed = DASH_SPEED;

    if (this.dashTime > 0 || this.rollTime > 0) {
      this.vx = this.facing * maxSpeed;
    } else if (dir !== 0) {
      const accel = (this.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt;
      this.vx = clamp(this.vx + dir * accel, -maxSpeed, maxSpeed);
    } else {
      const friction = (this.onGround ? GROUND_FRICTION : AIR_FRICTION) * dt;
      this.vx = Math.abs(this.vx) <= friction ? 0 : this.vx - Math.sign(this.vx) * friction;
    }

    /* 점프 */
    if (input.justPressed('jump')) this.jumpBuffer = JUMP_BUFFER;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0 && !this.slamming) {
      this.vy = -stats.jumpVel;
      this.jumping = true;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.squash = 0.8;
      this.world.audio.play('jump');
      this.world.particles.dust(this.centerX, this.bottom, 4);
    }
    if (input.justReleased('jump') && this.vy < 0 && this.jumping) {
      this.vy *= JUMP_CUT;
      this.jumping = false;
    }

    /* 스킬 */
    this.gliding = false;
    if (def.hold) {
      if (input.isDown('skill') && this.vy > 0 && !this.onGround) this.gliding = true;
    }
    if (input.justPressed('skill') && !def.hold) {
      if (useSkill(this.skill, this.number, this.onGround)) this.activateSkill();
    }
    if (this.superTime > 0) {
      this.superStarTimer -= dt;
      if (this.superStarTimer <= 0) {
        this.superStarTimer = 0.22;
        this.world.spawnStar(this.centerX, this.centerY, this.facing);
      }
    }

    /* 중력 */
    let gravity = stats.gravity;
    if (this.gliding) gravity *= 0.22;
    if (this.slamming) {
      this.vy = SLAM_SPEED;
      this.vx = 0;
    } else if (this.grapple.active && this.grapple.phase === 'pull') {
      gravity = 0;
    } else {
      this.vy = Math.min(this.vy + gravity * dt, this.gliding ? 110 : MAX_FALL_SPEED);
    }

    this.updateGrapple(dt);

    /* 이동 & 충돌 */
    const dropThrough = wantDown && this.onGround && !this.slamming;
    const flags = moveAndCollide(this, dt, this.world.map, {
      dropThrough,
      extraSolids: this.world.platformBoxes(),
    });

    this.wasOnGround = this.onGround;
    this.onGround = flags.onGround;
    if (this.onGround && flags.groundPlatform >= 0) {
      this.world.ridePlatform(this, flags.groundPlatform, dt);
    }

    if (this.onGround) {
      this.stompCombo = 0;
      this.jumping = false;
      if (!this.wasOnGround) {
        this.squash = 1.2;
        if (this.vyOnLand > 260) this.world.particles.dust(this.centerX, this.bottom, 6);
      }
      if (this.slamming) this.finishSlam();
    }
    this.vyOnLand = this.vy;

    /* 머리로 블록 치기 */
    if (flags.hitCeiling) {
      for (const t of flags.ceilingTiles) this.world.bumpTile(t.tx, t.ty, this);
    }

    /* 롤링으로 벽 부수기 */
    if (this.rollTime > 0 && (flags.hitWallLeft || flags.hitWallRight)) {
      if (!this.world.breakWallAhead(this)) this.rollTime = 0;
    }

    /* 위험 타일 */
    const hazard = hazardOverlapping(this.world.map, this.box);
    if (hazard === Tile.Spike) {
      this.hurt(1, this.centerX + this.facing * 10);
    } else if (hazard === Tile.Lava && !this.world.magicNumber) {
      if (this.world.kidMode) this.hurt(1, this.centerX);
      else this.die();
    }

    /* 낙사 — 매직 넘버일 때는 죽지 않고 마지막 안전 지점으로 되돌아간다 */
    if (this.box.y > this.world.map.h * TILE + 80) {
      if (this.world.magicNumber) this.world.rescuePlayer();
      else this.die();
    }

    /* 애니메이션 */
    this.squash += (1 - this.squash) * Math.min(1, dt * 12);
    this.walkPhase += Math.abs(this.vx) * dt * 0.06;
    if (this.superTime > 0 || this.dashTime > 0 || this.rollTime > 0) {
      this.world.particles.sparkle(this.centerX, this.centerY, this.world.playerColor().light);
    }
  }

  private vyOnLand = 0;

  /** 현재 숫자의 스킬을 실제로 발동한다. */
  private activateSkill(): void {
    const def = skillOf(this.number);
    const w = this.world;
    w.audio.play('skill', this.number);
    switch (def.kind) {
      case 'dash':
        this.dashTime = def.duration;
        this.vx = this.facing * DASH_SPEED;
        w.particles.burst(this.centerX, this.centerY, 8, w.playerColor().light, { gravity: 0 });
        break;
      case 'doubleJump': {
        const stats = numberStats(this.number);
        this.vy = -stats.jumpVel * 0.92;
        this.jumping = true;
        w.audio.play('doubleJump');
        w.particles.dust(this.centerX, this.bottom, 8);
        break;
      }
      case 'shield':
        this.shieldTime = def.duration;
        w.particles.burst(this.centerX, this.centerY, 10, '#8fe07f', { gravity: 0 });
        break;
      case 'star':
        w.spawnStar(this.centerX, this.centerY, this.facing);
        break;
      case 'roll':
        this.rollTime = def.duration;
        this.vx = this.facing * ROLL_SPEED;
        break;
      case 'bridge':
        w.buildRainbowBridge(this);
        break;
      case 'grapple':
        this.startGrapple();
        break;
      case 'slam':
        this.slamming = true;
        this.vy = SLAM_SPEED;
        break;
      case 'super':
        this.superTime = def.duration;
        this.superStarTimer = 0;
        w.shake(3);
        break;
      default:
        break;
    }
  }

  private startGrapple(): void {
    const g = this.grapple;
    g.active = true;
    g.phase = 'shoot';
    g.x = this.centerX;
    g.y = this.centerY;
    g.vx = this.facing * GRAPPLE_SPEED;
    g.vy = -GRAPPLE_SPEED * 0.75;
    g.time = 0;
  }

  private updateGrapple(dt: number): void {
    const g = this.grapple;
    if (!g.active) return;
    g.time += dt;
    if (g.phase === 'shoot') {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      const tx = Math.floor(g.x / TILE);
      const ty = Math.floor(g.y / TILE);
      const dist = Math.hypot(g.x - this.centerX, g.y - this.centerY);
      if (isSolidAt(this.world.map, tx, ty) && getTile(this.world.map, tx, ty) !== Tile.Empty) {
        g.phase = 'pull';
        g.x = tx * TILE + TILE / 2;
        g.y = ty * TILE + TILE / 2;
      } else if (dist > GRAPPLE_RANGE || g.time > 0.6) {
        g.active = false;
      }
    } else {
      const dx = g.x - this.centerX;
      const dy = g.y - this.centerY;
      const dist = Math.hypot(dx, dy) || 1;
      this.vx = (dx / dist) * 480;
      this.vy = (dy / dist) * 480;
      this.world.particles.sparkle(this.centerX, this.centerY, '#ff9ac9');
      if (dist < 26 || g.time > 1.4) {
        g.active = false;
        this.vy = Math.min(this.vy, -240);
      }
    }
  }

  private finishSlam(): void {
    this.slamming = false;
    this.squash = 1.4;
    this.world.audio.play('slam');
    this.world.shake(9, 0.35);
    this.world.particles.burst(this.centerX, this.bottom, 20, '#ffffff', { gravity: 300 });
    this.world.slamShockwave(this);
  }

  /** 그리기용: 현재 몸통 색이 흰색으로 번쩍이는가 */
  get flashing(): boolean {
    return this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0;
  }
}
