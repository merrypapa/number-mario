import { FIXED_DT, MAX_FRAME_DT, VIEW_H, VIEW_W } from './core/constants';
import { audio } from './core/audio';
import { Input } from './core/input';
import { preventBrowserGestures } from './core/touch';
import { clearSummary, type ClearSummary } from './game/scoring';
import { LEVELS } from './game/levels/data';
import { World } from './game/world';
import { drawWorld } from './render/draw';
import { drawHud, drawStageIntro } from './render/hud';
import {
  STORY_PAGE_COUNT,
  drawClear,
  drawEnding,
  drawGameOver,
  drawHelp,
  drawPause,
  drawStory,
  drawTitle,
  type Menu,
} from './ui/screens';

type Screen = 'title' | 'story' | 'help' | 'intro' | 'play' | 'pause' | 'clear' | 'gameover' | 'ending';

interface Settings {
  sound: boolean;
  music: boolean;
  kid: boolean;
}

const STORAGE_BEST = 'numberrun.best';
const STORAGE_SETTINGS = 'numberrun.settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (raw) return { sound: true, music: true, kid: false, ...JSON.parse(raw) };
  } catch {
    /* 저장소 접근 불가 시 기본값 */
  }
  return { sound: true, music: true, kid: false };
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(s));
  } catch {
    /* 무시 */
  }
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem(STORAGE_BEST) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(v: number): void {
  try {
    localStorage.setItem(STORAGE_BEST, String(v));
  } catch {
    /* 무시 */
  }
}

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input = new Input();
  private world: World;
  private screen: Screen = 'title';
  private time = 0;
  private screenTime = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private settings = loadSettings();
  private best = loadBest();
  private storyPage = 0;
  private levelIndex = 0;
  private stageStartScore = 0;
  private summary: ClearSummary = { base: 0, timeBonus: 0, noDeathBonus: 0, total: 0 };
  private scale = 1;

  private titleMenu: Menu = { items: [], index: 0 };
  private pauseMenu: Menu = { items: [], index: 0 };
  private overMenu: Menu = { items: ['다시 시도', '타이틀로'], index: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다');
    this.ctx = ctx;
    this.world = new World({
      onLevelClear: () => this.handleLevelClear(),
      onGameOver: () => this.handleGameOver(),
      onLifeLost: () => {
        /* 부활 연출은 월드가 처리 */
      },
    });
    this.world.kidMode = this.settings.kid;
    audio.soundOn = this.settings.sound;
    audio.setMusicOn(this.settings.music);
    this.refreshMenus();

    this.input.attach(window);
    this.bindTouch();
    preventBrowserGestures(document);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => {
      if (this.screen === 'play') this.setScreen('pause');
    });
    document.addEventListener(
      'pointerdown',
      () => {
        audio.init();
      },
      { once: false },
    );
    this.resize();
  }

  /* ── 화면 크기 ─────────────────────────────────────── */

  private resize(): void {
    const dpr = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    this.scale = dpr;
    this.canvas.width = VIEW_W * dpr;
    this.canvas.height = VIEW_H * dpr;
    const wrap = this.canvas.parentElement;
    const availW = wrap ? wrap.clientWidth : window.innerWidth;
    const availH = wrap ? wrap.clientHeight : window.innerHeight;
    const s = Math.min(availW / VIEW_W, availH / VIEW_H);
    this.canvas.style.width = `${Math.floor(VIEW_W * s)}px`;
    this.canvas.style.height = `${Math.floor(VIEW_H * s)}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  private bindTouch(): void {
    const map: Record<string, Parameters<Input['setTouch']>[0]> = {
      'btn-left': 'left',
      'btn-right': 'right',
      'btn-down': 'down',
      'btn-jump': 'jump',
      'btn-skill': 'skill',
      'btn-pause': 'pause',
    };
    for (const [id, action] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      const down = (e: Event) => {
        e.preventDefault();
        audio.init();
        this.input.setTouch(action, true);
        if (action === 'jump') this.input.setTouch('confirm', true);
        el.classList.add('active');
      };
      const up = (e: Event) => {
        e.preventDefault();
        this.input.setTouch(action, false);
        if (action === 'jump') this.input.setTouch('confirm', false);
        el.classList.remove('active');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch');
    }
  }

  private refreshMenus(): void {
    this.titleMenu.items = [
      '게임 시작',
      '조작법 / 스킬',
      `어린이 모드: ${this.settings.kid ? '켬' : '끔'}`,
      `소리: ${this.settings.sound ? '켬' : '끔'}`,
    ];
    this.pauseMenu.items = [
      '계속하기',
      '스테이지 다시 시작',
      `소리: ${this.settings.sound ? '켬' : '끔'}`,
      '타이틀로',
    ];
  }

  /* ── 상태 전환 ─────────────────────────────────────── */

  private setScreen(next: Screen): void {
    this.screen = next;
    this.screenTime = 0;
    this.input.clearAll();
    if (next === 'pause' || next === 'title' || next === 'gameover' || next === 'ending') {
      audio.stopMusic();
    }
  }

  private startGame(): void {
    this.levelIndex = 0;
    this.world.kidMode = this.settings.kid;
    this.stageStartScore = 0;
    this.world.load(LEVELS[0], 0, false);
    this.setScreen('intro');
  }

  private loadLevel(index: number, keepProgress: boolean): void {
    this.levelIndex = index;
    this.stageStartScore = keepProgress ? this.world.score : 0;
    this.world.kidMode = this.settings.kid;
    this.world.load(LEVELS[index], index, keepProgress);
    this.setScreen('intro');
  }

  private handleLevelClear(): void {
    this.summary = clearSummary(this.world.score, this.world.timeLeft, this.world.deaths);
    this.world.score = this.summary.total;
    if (this.world.score > this.best) {
      this.best = this.world.score;
      saveBest(this.best);
    }
    window.setTimeout(() => this.setScreen('clear'), 900);
  }

  private handleGameOver(): void {
    this.overMenu.index = 0;
    this.setScreen('gameover');
  }

  /** 디버그: 특정 스테이지로 바로 이동 */
  debugLoad(index: number): void {
    this.loadLevel(Math.max(0, Math.min(LEVELS.length - 1, index)), false);
  }

  /** 디버그: 플레이어 숫자 변경 */
  debugSetNumber(n: number): void {
    this.world.player.setNumber(n, true);
  }

  /* ── 루프 ──────────────────────────────────────────── */

  start(): void {
    this.lastFrame = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(MAX_FRAME_DT, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.time += dt;
      this.screenTime += dt;
      this.update(dt);
      this.render();
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private menuNav(menu: Menu): void {
    if (this.input.justPressed('up')) {
      menu.index = (menu.index + menu.items.length - 1) % menu.items.length;
      audio.play('select');
    }
    if (this.input.justPressed('down')) {
      menu.index = (menu.index + 1) % menu.items.length;
      audio.play('select');
    }
  }

  private confirmPressed(): boolean {
    return this.input.justPressed('confirm') || this.input.justPressed('jump');
  }

  private update(dt: number): void {
    switch (this.screen) {
      case 'title': {
        this.menuNav(this.titleMenu);
        if (this.confirmPressed()) {
          audio.init();
          audio.play('select');
          switch (this.titleMenu.index) {
            case 0:
              this.storyPage = 0;
              this.setScreen('story');
              break;
            case 1:
              this.setScreen('help');
              break;
            case 2:
              this.settings.kid = !this.settings.kid;
              this.world.kidMode = this.settings.kid;
              saveSettings(this.settings);
              this.refreshMenus();
              break;
            case 3:
              this.settings.sound = !this.settings.sound;
              this.settings.music = this.settings.sound;
              audio.soundOn = this.settings.sound;
              audio.setMusicOn(this.settings.music);
              saveSettings(this.settings);
              this.refreshMenus();
              break;
            default:
              break;
          }
        }
        break;
      }
      case 'story': {
        if (this.input.anyPressed() && this.screenTime > 0.35) {
          this.storyPage += 1;
          this.screenTime = 0;
          audio.play('select');
          if (this.storyPage >= STORY_PAGE_COUNT) this.startGame();
        }
        break;
      }
      case 'help': {
        if (this.input.anyPressed() && this.screenTime > 0.35) this.setScreen('title');
        break;
      }
      case 'intro': {
        if (this.screenTime > 1.6 || (this.input.anyPressed() && this.screenTime > 0.4)) {
          this.setScreen('play');
        }
        break;
      }
      case 'play': {
        if (this.input.justPressed('pause')) {
          this.pauseMenu.index = 0;
          this.setScreen('pause');
          break;
        }
        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= FIXED_DT && steps < 5) {
          this.world.update(FIXED_DT, this.input);
          this.accumulator -= FIXED_DT;
          steps++;
        }
        if (steps >= 5) this.accumulator = 0;
        break;
      }
      case 'pause': {
        this.menuNav(this.pauseMenu);
        if (this.input.justPressed('pause')) {
          this.setScreen('play');
          audio.startMusic(this.world.level.theme);
          break;
        }
        if (this.confirmPressed()) {
          audio.play('select');
          switch (this.pauseMenu.index) {
            case 0:
              this.setScreen('play');
              audio.startMusic(this.world.level.theme);
              break;
            case 1:
              this.world.score = this.stageStartScore;
              this.loadLevel(this.levelIndex, true);
              break;
            case 2:
              this.settings.sound = !this.settings.sound;
              this.settings.music = this.settings.sound;
              audio.soundOn = this.settings.sound;
              audio.setMusicOn(this.settings.music);
              saveSettings(this.settings);
              this.refreshMenus();
              break;
            case 3:
              this.setScreen('title');
              break;
            default:
              break;
          }
        }
        break;
      }
      case 'clear': {
        if (this.input.anyPressed() && this.screenTime > 0.5) {
          if (this.levelIndex + 1 >= LEVELS.length) this.setScreen('ending');
          else this.loadLevel(this.levelIndex + 1, true);
        }
        break;
      }
      case 'gameover': {
        this.menuNav(this.overMenu);
        if (this.confirmPressed() && this.screenTime > 0.3) {
          audio.play('select');
          if (this.overMenu.index === 0) {
            this.world.score = this.stageStartScore;
            this.loadLevel(this.levelIndex, true);
          } else {
            this.setScreen('title');
          }
        }
        break;
      }
      case 'ending': {
        if (this.input.anyPressed() && this.screenTime > 1.5) this.setScreen('title');
        break;
      }
      default:
        break;
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    switch (this.screen) {
      case 'title':
        drawTitle(ctx, this.titleMenu, this.time, this.best);
        break;
      case 'story':
        drawStory(ctx, this.storyPage, this.screenTime);
        break;
      case 'help':
        drawTitle(ctx, this.titleMenu, this.time, this.best);
        drawHelp(ctx, this.screenTime);
        break;
      case 'intro':
        drawWorld(ctx, this.world, this.time);
        drawHud(ctx, this.world, this.time);
        drawStageIntro(ctx, this.world, this.screenTime);
        break;
      case 'play':
        drawWorld(ctx, this.world, this.time);
        drawHud(ctx, this.world, this.time);
        break;
      case 'pause':
        drawWorld(ctx, this.world, this.time);
        drawHud(ctx, this.world, this.time);
        drawPause(ctx, this.pauseMenu, this.time, this.settings.sound, this.settings.kid);
        break;
      case 'clear':
        drawWorld(ctx, this.world, this.time);
        drawClear(ctx, this.summary, this.world.level.name, this.screenTime, this.levelIndex + 1 >= LEVELS.length);
        break;
      case 'gameover':
        drawWorld(ctx, this.world, this.time);
        drawGameOver(ctx, this.overMenu, this.time, this.world.score);
        break;
      case 'ending':
        drawEnding(ctx, this.world.score, this.screenTime);
        break;
      default:
        break;
    }
  }
}

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (canvas) {
  const game = new Game(canvas);
  game.start();
  // 디버그/자동 테스트용 훅 (콘솔에서 스테이지 이동 등에 사용)
  (window as unknown as Record<string, unknown>).numberRun = game;
}
