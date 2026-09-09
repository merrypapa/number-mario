import { TILE, DEFAULT_LIVES, KID_LIVES, MIN_NUMBER } from '../core/constants';
import { audio as audioEngine } from '../core/audio';
import { Camera } from '../core/camera';
import type { Input } from '../core/input';
import { overlaps, isStompingFrom, type Box } from '../engine/aabb';
import {
  parseLevel,
  getTile,
  setTile,
  isSolidAt,
  Tile,
  type TileMap,
} from '../engine/tilemap';
import { NUMBER_COLORS, type NumberColor } from '../render/palette';
import { Player } from './player';
import { ParticleSystem } from './particles';
import {
  DivBat,
  Enemy,
  MinusBug,
  MrZero,
  ZeroSlime,
} from './enemies';
import {
  makeItem,
  makePlatform,
  makeFallingBlock,
  updateItem,
  updatePlatform,
  updateStar,
  updateFallingBlock,
  type FallingBlock,
  type Item,
  type MovingPlatform,
  type Star,
} from './items';
import { enemyScore, SCORE_COIN, SCORE_ORB } from './scoring';
import type { LevelDef } from './levels/data';
import { numberStats } from './shapes';

const RAINBOW_LIFETIME = 9;
const BRIDGE_LENGTH = 3;

export interface WorldEvents {
  onLevelClear(): void;
  onGameOver(): void;
  onLifeLost(): void;
}

interface RainbowTile {
  tx: number;
  ty: number;
  life: number;
}

export class World {
  map: TileMap = { w: 0, h: 0, tiles: new Uint8Array(0), spawns: [] };
  player: Player;
  particles = new ParticleSystem();
  camera = new Camera(0, 0);
  audio = audioEngine;

  enemies: Enemy[] = [];
  items: Item[] = [];
  stars: Star[] = [];
  platforms: MovingPlatform[] = [];
  fallingBlocks: FallingBlock[] = [];
  rainbow: RainbowTile[] = [];
  boss: MrZero | null = null;

  level!: LevelDef;
  levelIndex = 0;
  score = 0;
  coins = 0;
  lives = DEFAULT_LIVES;
  timeLeft = 300;
  deaths = 0;
  kidMode = false;
  /** 매직 넘버: 켜져 있는 동안 무적 */
  magicNumber = false;
  cleared = false;
  /** 매직 넘버로 구조할 때 되돌아갈 마지막 안전 지점 */
  private lastSafeX = 0;
  private lastSafeY = 0;
  /** 아이템 블록에서 오브가 나오는 칸 */
  private orbBlocks = new Set<number>();
  private spawnX = 0;
  private spawnY = 0;
  private checkpointX: number | null = null;
  private checkpointY = 0;
  private checkpointNumber = 1;
  private respawnTimer = 0;
  private goalTouchedAt = -1;
  elapsed = 0;

  constructor(private events: WorldEvents) {
    this.player = new Player(this);
  }

  /* ── 로딩 ─────────────────────────────────────────── */

  load(level: LevelDef, index: number, keepProgress = false): void {
    this.level = level;
    this.levelIndex = index;
    this.map = parseLevel(level.rows);
    this.camera.setWorld(this.map.w * TILE, this.map.h * TILE);
    this.enemies = [];
    this.items = [];
    this.stars = [];
    this.platforms = [];
    this.fallingBlocks = [];
    this.rainbow = [];
    this.boss = null;
    this.orbBlocks.clear();
    this.particles.clear();
    this.cleared = false;
    this.goalTouchedAt = -1;
    this.timeLeft = level.time;
    this.elapsed = 0;
    this.checkpointX = null;
    if (!keepProgress) {
      this.score = 0;
      this.coins = 0;
      this.deaths = 0;
      this.lives = this.kidMode ? KID_LIVES : DEFAULT_LIVES;
    }

    for (const s of this.map.spawns) {
      const x = s.tx * TILE;
      const y = s.ty * TILE;
      switch (s.kind) {
        case 'player':
          this.spawnX = x + TILE / 2;
          this.spawnY = y + TILE;
          break;
        case 'coin':
        case 'orb':
        case 'heart':
        case 'checkpoint':
        case 'goal':
          this.items.push(makeItem(s.kind, s.tx, s.ty));
          break;
        case 'numberpad':
          this.items.push(makeItem('numberpad', s.tx, s.ty, s.value ?? 1));
          break;
        case 'orbblock':
          this.orbBlocks.add(this.tileKey(s.tx, s.ty));
          break;
        case 'minusbug':
          this.enemies.push(new MinusBug(x, y + TILE * 0.25));
          break;
        case 'divbat':
          this.enemies.push(new DivBat(x, y));
          break;
        case 'zeroslime':
          this.enemies.push(new ZeroSlime(x, y));
          break;
        case 'boss': {
          const boss = new MrZero(x, y - TILE * 1.5);
          this.boss = boss;
          this.enemies.push(boss);
          break;
        }
        case 'platformH':
          this.platforms.push(makePlatform(s.tx, s.ty, 'x'));
          break;
        case 'platformV':
          this.platforms.push(makePlatform(s.tx, s.ty, 'y'));
          break;
        default:
          break;
      }
    }

    if (this.kidMode) this.buildKidBridges();

    this.lastSafeX = this.spawnX;
    this.lastSafeY = this.spawnY;
    this.player.spawnAt(this.spawnX, this.spawnY, 1);
    this.camera.follow(this.player.centerX, this.player.centerY, 1, true);
    this.audio.startMusic(level.theme);
  }

  /**
   * 어린이 모드: 떨어져 죽는 구간(바닥이 아예 없거나 용암뿐인 칸)에
   * 양옆 지면 높이에 맞춰 사다리 다리를 깔아 걸어서 지나갈 수 있게 한다.
   */
  private buildKidBridges(): void {
    const map = this.map;
    // 위쪽 절반은 동굴 천장이므로 바닥 후보에서 제외한다
    const minRow = Math.floor(map.h / 2);
    const floorTop = (tx: number): number | null => {
      for (let ty = minRow; ty < map.h; ty++) {
        if (isSolidAt(map, tx, ty) || getTile(map, tx, ty) === Tile.OneWay) return ty;
      }
      return null;
    };

    const gaps: Array<[number, number]> = [];
    let start = -1;
    for (let tx = 0; tx < map.w; tx++) {
      if (floorTop(tx) === null) {
        if (start < 0) start = tx;
      } else if (start >= 0) {
        gaps.push([start, tx - 1]);
        start = -1;
      }
    }
    if (start >= 0) gaps.push([start, map.w - 1]);

    for (const [a, b] of gaps) {
      const left = a > 0 ? floorTop(a - 1) : null;
      const right = b < map.w - 1 ? floorTop(b + 1) : null;
      if (left === null && right === null) continue;
      // 낮은 쪽(행 번호가 큰 쪽)에 맞춰야 걸어서 내려설 수 있다
      const row = Math.max(left ?? right ?? 0, right ?? left ?? 0);
      if (row < 0 || row >= map.h) continue;
      for (let tx = a; tx <= b; tx++) setTile(map, tx, row, Tile.KidBridge);
    }
  }

  /** 매직 넘버 상태에서 떨어졌을 때 마지막 안전 지점으로 되돌린다 */
  rescuePlayer(): void {
    this.player.spawnAt(this.lastSafeX, this.lastSafeY, this.player.number);
    this.audio.play('checkpoint');
    this.particles.burst(this.player.centerX, this.player.centerY, 16, '#8fe07f');
    this.particles.floatingText(this.player.centerX, this.player.box.y - 8, '휴!', '#8fe07f');
    this.camera.follow(this.player.centerX, this.player.centerY, 1, true);
  }

  private tileKey(tx: number, ty: number): number {
    return ty * 4096 + tx;
  }

  /* ── 갱신 ─────────────────────────────────────────── */

  update(dt: number, input: Input): void {
    this.elapsed += dt;
    this.camera.update(dt);
    this.particles.update(dt);

    for (const p of this.platforms) updatePlatform(p, dt);

    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      this.player.update(dt, input);
      if (this.respawnTimer <= 0) this.respawn();
      this.camera.follow(this.player.centerX, this.player.centerY, dt);
      return;
    }

    if (!this.cleared) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.player.die();
      }
    }

    this.player.update(dt, input);

    // 땅에 서 있는 동안의 위치를 구조 지점으로 기억한다
    if (this.player.onGround && !this.player.dead) {
      this.lastSafeX = this.player.centerX;
      this.lastSafeY = this.player.box.y + this.player.box.h;
    }

    for (const e of this.enemies) {
      if (e.alive) {
        if (this.isNear(e.box, 400)) e.update(dt, this);
      } else if (e.dying > 0) {
        e.dying -= dt;
        e.box.y += 90 * dt;
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive || e.dying > 0);

    for (let i = this.stars.length - 1; i >= 0; i--) {
      if (!updateStar(this.stars[i], dt, this)) this.stars.splice(i, 1);
    }
    for (let i = this.fallingBlocks.length - 1; i >= 0; i--) {
      const b = this.fallingBlocks[i];
      updateFallingBlock(b, dt, this);
      if (!b.alive) this.fallingBlocks.splice(i, 1);
    }
    for (const item of this.items) updateItem(item, dt, this.map);

    for (let i = this.rainbow.length - 1; i >= 0; i--) {
      const r = this.rainbow[i];
      r.life -= dt;
      if (r.life <= 0) {
        if (getTile(this.map, r.tx, r.ty) === Tile.Rainbow) setTile(this.map, r.tx, r.ty, Tile.Empty);
        this.rainbow.splice(i, 1);
      }
    }

    if (!this.player.dead) {
      this.collideItems();
      this.collideEnemies();
      this.collideStars();
      this.collideFallingBlocks();
    }

    this.camera.follow(this.player.centerX, this.player.centerY, dt);
  }

  private isNear(box: Box, margin: number): boolean {
    return (
      box.x + box.w > this.camera.x - margin &&
      box.x < this.camera.x + 640 + margin
    );
  }

  /* ── 충돌 처리 ────────────────────────────────────── */

  private collideItems(): void {
    const pbox = this.player.box;
    for (const item of this.items) {
      if (item.taken || !item.active) continue;
      if (!overlaps(pbox, item.box)) continue;
      switch (item.kind) {
        case 'coin':
          item.taken = true;
          this.coins += 1;
          this.addScore(SCORE_COIN, item.box.x, item.box.y);
          this.audio.play('coin');
          this.particles.burst(item.box.x + item.box.w / 2, item.box.y, 6, '#ffd84d', { gravity: 120 });
          break;
        case 'orb':
          item.taken = true;
          this.addScore(SCORE_ORB, item.box.x, item.box.y);
          this.player.addNumber(1);
          break;
        case 'heart':
          item.taken = true;
          this.lives += 1;
          this.audio.play('numberUp');
          this.particles.floatingText(item.box.x, item.box.y - 8, '1UP', '#ff7d70');
          break;
        case 'checkpoint':
          if (this.checkpointX !== item.box.x) {
            this.checkpointX = item.box.x;
            this.checkpointY = item.box.y + item.box.h;
            this.checkpointNumber = this.player.number;
            item.value = 1; // 활성 표시
            this.audio.play('checkpoint');
            this.particles.floatingText(item.box.x, item.box.y - 8, '체크포인트!', '#5fcf5a');
          }
          break;
        case 'numberpad':
          if (this.player.number !== item.value && this.player.fitsAs(item.value)) {
            this.player.setNumber(item.value);
          }
          break;
        case 'goal':
          if (!this.cleared) this.clearLevel();
          break;
        default:
          break;
      }
    }
    this.items = this.items.filter((i) => !i.taken);
  }

  private collideEnemies(): void {
    const player = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!overlaps(player.box, e.box)) continue;

      // 롤링/슈퍼/대시/매직 넘버 상태에서는 닿기만 해도 적을 물리친다
      if (player.rollTime > 0 || player.superTime > 0 || player.dashTime > 0 || this.magicNumber) {
        if (e.kind === 'boss') {
          // 보스는 매직 넘버로도 밟아야만 피해를 준다
          if (player.superTime > 0) e.onStomp(this);
        } else {
          e.hit(this, 3);
          this.addScore(enemyScore(0), e.centerX, e.box.y);
        }
        continue;
      }

      if (isStompingFrom(player.box, e.box, player.vy)) {
        const killed = e.onStomp(this);
        if (killed) {
          this.addScore(enemyScore(player.stompCombo), e.centerX, e.box.y);
          player.stompCombo += 1;
          player.bounce();
        }
        continue;
      }

      player.hurt(e.damage, e.centerX, e.damageMode);
    }
  }

  private collideStars(): void {
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      const sbox: Box = { x: s.x - 6, y: s.y - 6, w: 12, h: 12 };
      for (const e of this.enemies) {
        if (!e.alive || !overlaps(sbox, e.box)) continue;
        e.hit(this);
        if (!e.alive) this.addScore(enemyScore(0), e.centerX, e.box.y);
        this.stars.splice(i, 1);
        break;
      }
    }
  }

  private collideFallingBlocks(): void {
    for (const b of this.fallingBlocks) {
      if (b.warn > 0) continue;
      if (overlaps(this.player.box, b.box)) {
        this.player.hurt(1, b.box.x + b.box.w / 2);
        b.alive = false;
      }
    }
  }

  /* ── 월드 API (플레이어/적이 호출) ────────────────── */

  playerColor(): NumberColor {
    return NUMBER_COLORS[this.player.number] ?? NUMBER_COLORS[1];
  }

  addScore(amount: number, x?: number, y?: number): void {
    this.score += amount;
    if (x !== undefined && y !== undefined) {
      this.particles.floatingText(x, y, String(amount));
    }
  }

  shake(magnitude: number, time = 0.25): void {
    this.camera.shake(magnitude, time);
  }

  platformBoxes(): Box[] {
    return this.platforms.map((p) => p.box);
  }

  ridePlatform(entity: { box: Box }, index: number, _dt: number): void {
    const p = this.platforms[index];
    if (!p) return;
    entity.box.x += p.dx;
    entity.box.y += p.dy;
  }

  spawnStar(x: number, y: number, dir: number): void {
    this.stars.push({ x, y, vx: dir * 300, vy: -140, life: 2.2, spin: 0 });
    this.audio.play('star');
  }

  spawnFallingBlock(x: number): void {
    this.fallingBlocks.push(makeFallingBlock(x, this.camera.y + 20));
  }

  spawnSlimeNear(x: number): void {
    const slime = new ZeroSlime(x + (Math.random() < 0.5 ? -90 : 90), 120);
    this.enemies.push(slime);
  }

  /** 머리로 블록을 쳤을 때 */
  bumpTile(tx: number, ty: number, player: Player): void {
    const tile = getTile(this.map, tx, ty);
    if (tile === Tile.Question) {
      setTile(this.map, tx, ty, Tile.Used);
      const isOrb = this.orbBlocks.has(this.tileKey(tx, ty));
      const cx = tx * TILE + TILE / 2;
      this.particles.burst(cx, ty * TILE, 6, '#ffd84d');
      if (isOrb) {
        // 오브는 블록 위로 튀어나온 뒤 굴러떨어져 플레이어가 주울 수 있는 곳에 멈춘다
        const item = makeItem('orb', tx, ty - 1);
        item.physics = true;
        item.vy = -250;
        item.vx = (player.facing || 1) * 78;
        this.items.push(item);
        this.audio.play('numberUp');
      } else {
        // 코인은 마리오처럼 즉시 획득 (튀어나오는 연출만)
        this.coins += 1;
        this.addScore(SCORE_COIN, cx, ty * TILE - 6);
        this.audio.play('coin');
        this.particles.coinPop(cx, ty * TILE);
      }
    } else if (tile === Tile.Brick) {
      // 4 이상이면 벽돌을 부순다
      if (player.number >= 4 || player.rollTime > 0 || player.superTime > 0) {
        this.breakTile(tx, ty);
      } else {
        this.particles.dust(tx * TILE + TILE / 2, ty * TILE + TILE, 3);
      }
    }
  }

  breakTile(tx: number, ty: number): void {
    if (getTile(this.map, tx, ty) !== Tile.Brick) return;
    setTile(this.map, tx, ty, Tile.Empty);
    this.particles.debris(tx * TILE + TILE / 2, ty * TILE + TILE / 2, '#c9773c');
    this.audio.play('break');
    this.addScore(20);
  }

  /** 롤링 중 앞의 벽돌을 부순다. 부순 게 있으면 true */
  breakWallAhead(player: Player): boolean {
    const stats = numberStats(player.number);
    const dir = player.facing;
    const startCol =
      dir > 0
        ? Math.floor((player.box.x + player.box.w + 2) / TILE)
        : Math.floor((player.box.x - 2) / TILE);
    const topRow = Math.floor(player.box.y / TILE) - 1;
    const bottomRow = Math.floor((player.box.y + player.box.h - 1) / TILE);
    let broke = false;
    for (let c = 0; c < 2; c++) {
      const tx = startCol + dir * c;
      for (let ty = topRow; ty <= bottomRow; ty++) {
        if (getTile(this.map, tx, ty) === Tile.Brick) {
          this.breakTile(tx, ty);
          broke = true;
        }
      }
    }
    if (broke) {
      this.shake(4);
      void stats;
    }
    return broke;
  }

  /** 슬램 착지 충격파: 아래 벽돌 파괴 + 주변 적 처치 */
  slamShockwave(player: Player): void {
    const stats = numberStats(player.number);
    const centerCol = Math.floor(player.centerX / TILE);
    const half = Math.floor(stats.cols / 2) + 1;
    const startRow = Math.floor((player.box.y + player.box.h + 2) / TILE);
    for (let tx = centerCol - half; tx <= centerCol + half; tx++) {
      for (let ty = startRow; ty < startRow + 2; ty++) {
        if (getTile(this.map, tx, ty) === Tile.Brick) this.breakTile(tx, ty);
      }
    }
    for (const e of this.enemies) {
      if (!e.alive || e.kind === 'boss') continue;
      if (Math.abs(e.centerX - player.centerX) < 150 && Math.abs(e.centerY - player.centerY) < 120) {
        e.hit(this, 3);
        this.addScore(enemyScore(0), e.centerX, e.box.y);
      }
    }
  }

  /** 7의 무지개 다리 생성 */
  buildRainbowBridge(player: Player): void {
    const row = Math.floor((player.box.y + player.box.h + 2) / TILE);
    const dir = player.facing;
    const start =
      dir > 0
        ? Math.floor((player.box.x + player.box.w) / TILE)
        : Math.floor(player.box.x / TILE) - BRIDGE_LENGTH;
    let placed = 0;
    for (let i = 0; i < BRIDGE_LENGTH; i++) {
      const tx = start + i;
      if (getTile(this.map, tx, row) !== Tile.Empty) continue;
      setTile(this.map, tx, row, Tile.Rainbow);
      this.rainbow.push({ tx, ty: row, life: RAINBOW_LIFETIME });
      this.particles.sparkle(tx * TILE + TILE / 2, row * TILE, '#8c4fd0');
      placed++;
    }
    if (placed === 0) this.particles.floatingText(player.centerX, player.box.y, '자리 없음', '#ffffff');
  }

  bossShockwave(boss: Enemy): void {
    const player = this.player;
    if (player.onGround && Math.abs(player.centerX - boss.centerX) < 260) {
      player.hurt(1, boss.centerX);
    }
    for (let i = 0; i < 10; i++) {
      this.particles.burst(boss.centerX + (i - 5) * 22, boss.box.y + boss.box.h, 2, '#6a7290', {
        gravity: 200,
      });
    }
  }

  onBossPhaseChange(phase: number): void {
    this.particles.floatingText(this.player.centerX, this.player.box.y - 20, `페이즈 ${phase}!`, '#ff7d70');
    // 회복 기회: 아레나 양쪽에 오브 재생성
    for (const tx of [6, 45]) {
      this.items.push(makeItem('orb', tx, 12));
    }
  }

  onBossDefeated(): void {
    this.audio.play('clear');
    this.shake(12, 0.6);
    for (let i = 0; i < 40; i++) {
      this.particles.burst(
        this.boss ? this.boss.centerX : this.player.centerX,
        this.boss ? this.boss.centerY : this.player.centerY,
        3,
        i % 2 ? '#ffd84d' : '#ffffff',
      );
    }
    const tx = Math.floor((this.boss?.centerX ?? this.player.centerX) / TILE);
    this.items.push(makeItem('goal', tx, 12));
  }

  onPlayerDeath(): void {
    this.deaths += 1;
    this.respawnTimer = 1.8;
    this.audio.stopMusic();
  }

  private respawn(): void {
    this.lives -= 1;
    if (this.lives < 0) {
      this.events.onGameOver();
      return;
    }
    const x = this.checkpointX ?? this.spawnX;
    const y = this.checkpointX !== null ? this.checkpointY : this.spawnY;
    const num = this.checkpointX !== null ? Math.max(MIN_NUMBER, this.checkpointNumber) : 1;
    this.player.spawnAt(x, y, num);
    this.timeLeft = Math.max(this.timeLeft, 60);
    this.camera.follow(this.player.centerX, this.player.centerY, 1, true);
    this.audio.startMusic(this.level.theme);
    this.events.onLifeLost();
  }

  private clearLevel(): void {
    this.cleared = true;
    this.goalTouchedAt = this.elapsed;
    this.audio.stopMusic();
    this.audio.play('clear');
    this.particles.burst(this.player.centerX, this.player.centerY, 40, '#ffd84d');
    this.events.onLevelClear();
  }

  get justCleared(): boolean {
    return this.goalTouchedAt >= 0;
  }

  /** 디버그/테스트용: 특정 좌표가 solid 인지 */
  solidAt(tx: number, ty: number): boolean {
    return isSolidAt(this.map, tx, ty);
  }
}
