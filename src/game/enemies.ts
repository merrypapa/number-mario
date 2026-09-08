import { TILE, MAX_FALL_SPEED } from '../core/constants';
import type { Box } from '../engine/aabb';
import { overlaps } from '../engine/aabb';
import { moveAndCollide } from '../engine/physics';
import { isSolidAt } from '../engine/tilemap';
import type { World } from './world';

export type EnemyKind = 'minusbug' | 'divbat' | 'zeroslime' | 'boss';

export abstract class Enemy {
  box: Box;
  vx = 0;
  vy = 0;
  alive = true;
  /** 처치 후 사라지는 연출 타이머 */
  dying = 0;
  hp = 1;
  facing: 1 | -1 = -1;
  anim = 0;
  abstract readonly kind: EnemyKind;
  /** 밟아서 처치할 수 있는가 */
  stompable = true;
  /** 접촉 시 플레이어가 잃는 숫자 */
  damage = 1;
  /** 접촉 피해 방식 */
  damageMode: 'normal' | 'halve' = 'normal';

  constructor(x: number, y: number, w: number, h: number) {
    this.box = { x, y, w, h };
  }

  get centerX(): number {
    return this.box.x + this.box.w / 2;
  }
  get centerY(): number {
    return this.box.y + this.box.h / 2;
  }

  abstract update(dt: number, world: World): void;

  /** 밟혔을 때. true를 돌려주면 처치된다. */
  onStomp(world: World): boolean {
    this.kill(world);
    return true;
  }

  /** 별/롤링/슬램 등 공격을 받았을 때 */
  hit(world: World, power = 1): void {
    this.hp -= power;
    if (this.hp <= 0) this.kill(world);
    else world.particles.burst(this.centerX, this.centerY, 6, '#ffffff');
  }

  kill(world: World): void {
    if (!this.alive) return;
    this.alive = false;
    this.dying = 0.5;
    world.particles.burst(this.centerX, this.centerY, 14, this.deathColor);
    world.audio.play('stomp');
  }

  protected deathColor = '#cfd6e4';

  /** 낭떠러지 앞인지 확인해 순찰 방향을 바꾼다. */
  protected atLedge(world: World): boolean {
    const aheadX = this.facing > 0 ? this.box.x + this.box.w + 2 : this.box.x - 2;
    const tx = Math.floor(aheadX / TILE);
    const ty = Math.floor((this.box.y + this.box.h + 4) / TILE);
    return !isSolidAt(world.map, tx, ty);
  }
}

/** 마이너스벌레 — 좌우 순찰, 밟으면 처치 */
export class MinusBug extends Enemy {
  readonly kind = 'minusbug' as const;
  private speed = 42;

  constructor(x: number, y: number) {
    super(x, y, TILE, TILE * 0.75);
    this.deathColor = '#9aa3b5';
  }

  override update(dt: number, world: World): void {
    this.anim += dt;
    this.vx = this.facing * this.speed;
    this.vy = Math.min(this.vy + 1400 * dt, MAX_FALL_SPEED);
    const flags = moveAndCollide(this, dt, world.map, {});
    if (flags.hitWallLeft || flags.hitWallRight) this.facing = this.facing > 0 ? -1 : 1;
    else if (flags.onGround && this.atLedge(world)) this.facing = this.facing > 0 ? -1 : 1;
  }
}

/** 나눗셈박쥐 — 사인파 비행, 접촉 시 숫자 절반 */
export class DivBat extends Enemy {
  readonly kind = 'divbat' as const;
  private baseY: number;
  private t = Math.random() * Math.PI * 2;

  constructor(x: number, y: number) {
    super(x, y, TILE, TILE * 0.8);
    this.baseY = y;
    this.damageMode = 'halve';
    this.deathColor = '#8c4fd0';
  }

  override update(dt: number, world: World): void {
    this.anim += dt;
    this.t += dt * 2.2;
    const player = world.player;
    const dx = player.centerX - this.centerX;
    this.facing = dx < 0 ? -1 : 1;
    // 가까우면 플레이어 쪽으로, 아니면 천천히 왼쪽으로 흘러간다
    const drift = Math.abs(dx) < 190 ? Math.sign(dx) * 52 : -30;
    this.box.x += drift * dt;
    this.box.y = this.baseY + Math.sin(this.t) * 26;
    if (this.box.x < 0) this.box.x = 0;
  }
}

/** 제로슬라임 — 제자리 점프, 밟아도 죽지 않는다 */
export class ZeroSlime extends Enemy {
  readonly kind = 'zeroslime' as const;
  private hopTimer = 0.6;

  constructor(x: number, y: number) {
    super(x, y, TILE * 1.1, TILE);
    this.hp = 3;
    this.damage = 2;
    this.stompable = false;
    this.deathColor = '#3a3f55';
  }

  override update(dt: number, world: World): void {
    this.anim += dt;
    this.hopTimer -= dt;
    this.vy = Math.min(this.vy + 1500 * dt, MAX_FALL_SPEED);
    const flags = moveAndCollide(this, dt, world.map, {});
    if (flags.onGround) {
      this.vx *= 0.7;
      if (this.hopTimer <= 0) {
        this.hopTimer = 1.1 + Math.random() * 0.6;
        const dir = Math.sign(world.player.centerX - this.centerX) || 1;
        this.vy = -360;
        this.vx = dir * 70;
        world.particles.dust(this.centerX, this.box.y + this.box.h, 4);
      }
    }
    if (flags.hitWallLeft || flags.hitWallRight) this.vx *= -1;
  }

  /** 밟으면 튕겨만 나간다 */
  override onStomp(world: World): boolean {
    world.player.bounce(300);
    world.audio.play('stomp');
    world.particles.burst(this.centerX, this.box.y, 6, '#6a7290');
    return false;
  }
}

export type BossPhase = 1 | 2 | 3;

/** 미스터 제로 — 3페이즈 보스 */
export class MrZero extends Enemy {
  readonly kind = 'boss' as const;
  phase: BossPhase = 1;
  invuln = 0;
  private stateTimer = 1.2;
  private state: 'wait' | 'jump' | 'dash' | 'summon' = 'wait';
  private dashDir: 1 | -1 = -1;
  private blockRainTimer = 0;
  defeated = false;

  constructor(x: number, y: number) {
    super(x, y, TILE * 2.5, TILE * 2.5);
    this.hp = 3;
    this.damage = 2;
    this.deathColor = '#2b2f45';
  }

  private get currentPhase(): BossPhase {
    return (4 - Math.max(1, this.hp)) as BossPhase;
  }

  override update(dt: number, world: World): void {
    this.anim += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.phase = this.currentPhase;
    this.stateTimer -= dt;

    const player = world.player;
    this.facing = player.centerX < this.centerX ? -1 : 1;

    this.vy = Math.min(this.vy + 1500 * dt, MAX_FALL_SPEED);

    switch (this.state) {
      case 'wait':
        this.vx *= 0.86;
        if (this.stateTimer <= 0) this.chooseAction(world);
        break;
      case 'jump':
        break;
      case 'dash':
        this.vx = this.dashDir * 260;
        if (this.stateTimer <= 0) {
          this.state = 'wait';
          this.stateTimer = 0.8;
        }
        break;
      case 'summon':
        this.vx *= 0.8;
        if (this.stateTimer <= 0) {
          this.state = 'wait';
          this.stateTimer = 1.0;
        }
        break;
    }

    if (this.phase >= 3) {
      this.blockRainTimer -= dt;
      if (this.blockRainTimer <= 0) {
        this.blockRainTimer = 1.4;
        world.spawnFallingBlock(player.centerX + (Math.random() - 0.5) * 120);
      }
    }

    const flags = moveAndCollide(this, dt, world.map, {});
    if (flags.hitWallLeft || flags.hitWallRight) this.dashDir = this.dashDir > 0 ? -1 : 1;
    if (flags.onGround && this.state === 'jump') {
      this.state = 'wait';
      this.stateTimer = this.phase >= 2 ? 0.55 : 0.9;
      world.shake(7, 0.3);
      world.audio.play('slam');
      world.particles.burst(this.centerX, this.box.y + this.box.h, 18, '#4a4f6b', { gravity: 500 });
      world.bossShockwave(this);
    }
  }

  private chooseAction(world: World): void {
    const roll = Math.random();
    if (this.phase >= 2 && roll < 0.3) {
      this.state = 'summon';
      this.stateTimer = 0.9;
      world.spawnSlimeNear(this.centerX);
      world.audio.play('numberDown');
      return;
    }
    if (this.phase >= 3 && roll < 0.6) {
      this.state = 'dash';
      this.stateTimer = 1.0;
      this.dashDir = this.facing;
      world.audio.play('skill', -4);
      return;
    }
    this.state = 'jump';
    this.vy = -520;
    this.vx = this.facing * (110 + this.phase * 30);
  }

  override onStomp(world: World): boolean {
    if (this.invuln > 0) {
      world.player.bounce(280);
      return false;
    }
    this.hp -= 1;
    this.invuln = 1.6;
    this.state = 'wait';
    this.stateTimer = 1.0;
    world.player.bounce(400);
    world.audio.play('bossHit');
    world.shake(10, 0.4);
    world.particles.burst(this.centerX, this.centerY, 22, '#ffffff');
    if (this.hp <= 0) {
      this.alive = false;
      this.dying = 1.6;
      this.defeated = true;
      world.onBossDefeated();
      return true;
    }
    world.onBossPhaseChange(this.phase);
    return false;
  }

  /** 별 공격은 통하지 않는다(밟기만 유효) */
  override hit(world: World): void {
    world.particles.burst(this.centerX, this.centerY, 4, '#7a7f9b');
  }
}

export function enemyOverlapsPlayer(enemy: Enemy, playerBox: Box): boolean {
  return enemy.alive && overlaps(enemy.box, playerBox);
}
