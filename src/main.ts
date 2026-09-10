import { FIXED_DT, MAX_FRAME_DT, VIEW_H, VIEW_W } from './core/constants';
import { audio } from './core/audio';
import { Input } from './core/input';
import { preventBrowserGestures } from './core/touch';
import { createJoystick } from './ui/joystick';
import { clearSummary, type ClearSummary } from './game/scoring';
import { LEVELS } from './game/levels/data';
import { World } from './game/world';
import { drawWorld } from './render/draw';
import { drawWorldMap } from './render/worldmap';
import { MAP_NODES, loadProgress, nodeAt, pathPoint, saveProgress } from './game/worldmap';
import { addRecord, loadRecords, saveRecords, type RunRecord } from './game/records';
import { drawHud, drawStageIntro } from './render/hud';
import {
  STORY_PAGE_COUNT,
  drawClear,
  drawEnding,
  drawGameOver,
  drawHelp,
  drawPause,
  drawRecords,
  drawStory,
  drawTitle,
  type Menu,
} from './ui/screens';

type Screen =
  | 'title'
  | 'story'
  | 'help'
  | 'map'
  | 'intro'
  | 'play'
  | 'pause'
  | 'clear'
  | 'gameover'
  | 'ending'
  | 'name'
  | 'records';

interface Settings {
  sound: boolean;
  music: boolean;
  kid: boolean;
  /** 매직 넘버(무적) 도우미 */
  magic: boolean;
}

const STORAGE_BEST = 'numberrun.best';
const STORAGE_SETTINGS = 'numberrun.settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (raw) return { sound: true, music: true, kid: false, magic: false, ...JSON.parse(raw) };
  } catch {
    /* 저장소 접근 불가 시 기본값 */
  }
  return { sound: true, music: true, kid: false, magic: false };
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

  /* 월드맵 */
  private unlocked = loadProgress();
  private mapCursor = 0;
  private mapMarker = { x: MAP_NODES[0].x, y: MAP_NODES[0].y };
  private mapMove: { from: number; to: number; t: number } | null = null;

  /* 기록 */
  private records: RunRecord[] = loadRecords();
  private runAssisted = false;
  private recordsScroll = 0;
  /** 이번에 스테이지에 들어갈 때 점수를 초기화할지 */
  private freshRun = true;

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
    this.world.magicNumber = this.settings.magic;
    audio.soundOn = this.settings.sound;
    audio.setMusicOn(this.settings.music);
    this.refreshMenus();

    this.input.attach(window);
    this.bindTouch();
    this.bindMagicButton();
    this.bindNameEntry();
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
    // 방향은 조이스틱, 동작은 버튼
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    if (stick && knob) {
      createJoystick(stick, knob, this.input, () => audio.init());
    }

    const buttons: Record<string, Parameters<Input['setTouch']>[0]> = {
      'btn-jump': 'jump',
      'btn-skill': 'skill',
      'btn-pause': 'pause',
    };
    for (const [id, action] of Object.entries(buttons)) {
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

  /** 완주 기록 등록 창 */
  private openNameEntry(): void {
    this.setScreen('name');
    const panel = document.getElementById('nameentry');
    const input = document.getElementById('ne-input') as HTMLInputElement | null;
    if (!panel || !input) {
      this.setScreen('records');
      return;
    }
    panel.hidden = false;
    input.value = '';
    window.setTimeout(() => input.focus(), 60);
  }

  private closeNameEntry(save: boolean): void {
    const panel = document.getElementById('nameentry');
    const input = document.getElementById('ne-input') as HTMLInputElement | null;
    if (panel) panel.hidden = true;
    if (save && input) {
      const name = input.value.trim().slice(0, 10) || '이름없음';
      const record: RunRecord = {
        name,
        score: this.world.score,
        coins: this.world.coins,
        deaths: this.world.deaths,
        seconds: this.world.playSeconds,
        bestNumber: this.world.bestNumber,
        assisted: this.runAssisted,
        at: new Date().toISOString(),
      };
      this.records = addRecord(this.records, record);
      saveRecords(this.records);
      audio.play('clear');
    }
    this.recordsScroll = 0;
    this.setScreen('records');
  }

  private bindNameEntry(): void {
    const save = document.getElementById('ne-save');
    const skip = document.getElementById('ne-skip');
    const input = document.getElementById('ne-input') as HTMLInputElement | null;
    save?.addEventListener('click', () => this.closeNameEntry(true));
    skip?.addEventListener('click', () => this.closeNameEntry(false));
    input?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.closeNameEntry(true);
    });
  }

  private bindMagicButton(): void {
    const el = document.getElementById('btn-magic');
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      audio.init();
      this.toggleMagic();
    });
    this.syncMagicButton();
  }

  /** 매직 넘버(무적) 켜기/끄기 */
  private toggleMagic(): void {
    this.settings.magic = !this.settings.magic;
    this.world.magicNumber = this.settings.magic;
    saveSettings(this.settings);
    this.syncMagicButton();
    audio.play(this.settings.magic ? 'numberUp' : 'select');
    if (this.settings.magic) {
      this.world.particles.burst(this.world.player.centerX, this.world.player.centerY, 20, '#ffd84d');
    }
  }

  private syncMagicButton(): void {
    const el = document.getElementById('btn-magic');
    if (!el) return;
    el.classList.toggle('on', this.settings.magic);
    el.setAttribute('aria-pressed', String(this.settings.magic));
  }

  private refreshMenus(): void {
    this.titleMenu.items = [
      ...(this.unlocked > 0 ? ['이어하기', '처음부터'] : ['게임 시작']),
      '기록 보기',
      '조작법 / 스킬',
      `어린이 모드: ${this.settings.kid ? '켬' : '끔'}`,
      `소리: ${this.settings.sound ? '켬' : '끔'}`,
    ];
    this.titleMenu.index = Math.min(this.titleMenu.index, this.titleMenu.items.length - 1);
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
    // 매직 넘버 버튼은 실제로 플레이 중일 때만 보인다
    const playing = next === 'play' || next === 'pause' || next === 'intro';
    document.body.classList.toggle('playing', playing);
    if (next === 'pause' || next === 'title' || next === 'gameover' || next === 'ending') {
      audio.stopMusic();
    }
  }

  /** 지도에서 시작 (fresh 면 처음부터) */
  private beginRun(fresh: boolean): void {
    if (fresh) {
      this.unlocked = 0;
      saveProgress(0);
      this.refreshMenus();
    }
    this.freshRun = fresh;
    this.runAssisted = this.settings.kid || this.settings.magic;
    this.mapCursor = fresh ? 0 : Math.min(this.unlocked, MAP_NODES.length - 1);
    const node = nodeAt(this.mapCursor);
    this.mapMarker = { x: node.x, y: node.y };
    this.mapMove = null;
    audio.stopMusic();
    this.setScreen('map');
  }

  /** 지도 위에서 옆 지점으로 걸어간다 */
  private moveMapCursor(dir: number): void {
    const next = this.mapCursor + dir;
    if (next < 0 || next >= MAP_NODES.length || next > this.unlocked) return;
    this.mapMove = { from: this.mapCursor, to: next, t: 0 };
    audio.play('select');
  }

  private enterStage(index: number): void {
    const fresh = this.freshRun;
    this.freshRun = false;
    if (this.settings.kid || this.settings.magic) this.runAssisted = true;
    this.loadLevel(index, !fresh);
  }

  private loadLevel(index: number, keepProgress: boolean): void {
    this.levelIndex = index;
    this.stageStartScore = keepProgress ? this.world.score : 0;
    this.world.kidMode = this.settings.kid;
    this.world.magicNumber = this.settings.magic;
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

  /**
   * 메뉴 확정. 'jump' 는 확정으로 치지 않는다 —
   * ↑ 키가 jump 에도 매핑돼 있어서, 위로 이동하는 순간 그 항목이
   * 선택되어 버리기 때문이다. (터치 점프 버튼은 confirm 도 함께 보낸다)
   */
  private confirmPressed(): boolean {
    return this.input.justPressed('confirm');
  }

  private update(dt: number): void {
    // 매직 넘버는 어느 화면에서든 M 키로 켜고 끌 수 있다
    if (this.input.justPressed('magic')) this.toggleMagic();

    switch (this.screen) {
      case 'title': {
        this.menuNav(this.titleMenu);
        if (this.confirmPressed()) {
          audio.init();
          audio.play('select');
          const picked = this.titleMenu.items[this.titleMenu.index];
          if (picked === '이어하기') {
            this.beginRun(false);
          } else if (picked === '게임 시작' || picked === '처음부터') {
            this.unlocked = 0;
            saveProgress(0);
            this.refreshMenus();
            this.storyPage = 0;
            this.setScreen('story');
          } else if (picked === '기록 보기') {
            this.recordsScroll = 0;
            this.setScreen('records');
          } else if (picked === '조작법 / 스킬') {
            this.setScreen('help');
          } else if (picked.startsWith('어린이 모드')) {
            this.settings.kid = !this.settings.kid;
            this.world.kidMode = this.settings.kid;
            saveSettings(this.settings);
            this.refreshMenus();
          } else if (picked.startsWith('소리')) {
            this.settings.sound = !this.settings.sound;
            this.settings.music = this.settings.sound;
            audio.soundOn = this.settings.sound;
            audio.setMusicOn(this.settings.music);
            saveSettings(this.settings);
            this.refreshMenus();
          }
        }
        break;
      }
      case 'story': {
        if (this.input.anyPressed() && this.screenTime > 0.35) {
          this.storyPage += 1;
          this.screenTime = 0;
          audio.play('select');
          if (this.storyPage >= STORY_PAGE_COUNT) this.beginRun(true);
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
          const cleared = this.levelIndex;
          this.unlocked = Math.max(this.unlocked, Math.min(cleared + 1, LEVELS.length - 1));
          saveProgress(this.unlocked);
          this.refreshMenus();
          if (cleared + 1 >= LEVELS.length) {
            this.setScreen('ending');
          } else {
            const from = nodeAt(cleared);
            this.mapCursor = cleared;
            this.mapMarker = { x: from.x, y: from.y };
            this.mapMove = { from: cleared, to: cleared + 1, t: 0 };
            this.setScreen('map');
          }
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
            this.world.resetLives(); // 게임 오버 후에는 라이프를 되돌려 준다
          } else {
            this.setScreen('title');
          }
        }
        break;
      }
      case 'ending': {
        if (this.input.anyPressed() && this.screenTime > 1.5) this.openNameEntry();
        break;
      }
      case 'map': {
        if (this.mapMove) {
          this.mapMove.t += dt * 1.5;
          const from = nodeAt(this.mapMove.from);
          const to = nodeAt(this.mapMove.to);
          this.mapMarker = pathPoint(from, to, Math.min(1, this.mapMove.t));
          if (this.mapMove.t >= 1) {
            this.mapCursor = this.mapMove.to;
            this.mapMove = null;
          }
          break;
        }
        if (this.input.justPressed('left')) this.moveMapCursor(-1);
        if (this.input.justPressed('right')) this.moveMapCursor(1);
        if (this.input.justPressed('pause')) {
          this.setScreen('title');
          break;
        }
        if (this.confirmPressed() && this.mapCursor <= this.unlocked) {
          audio.play('select');
          this.enterStage(this.mapCursor);
        }
        break;
      }
      case 'name':
        // DOM 입력창이 처리한다
        break;
      case 'records': {
        if (this.input.justPressed('down')) this.recordsScroll += 1;
        if (this.input.justPressed('up')) this.recordsScroll -= 1;
        this.recordsScroll = Math.max(0, Math.min(this.recordsScroll, Math.max(0, this.records.length - 8)));
        if ((this.confirmPressed() || this.input.justPressed('pause')) && this.screenTime > 0.3) {
          this.setScreen('title');
        }
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
        drawPause(ctx, this.pauseMenu, this.time, this.settings.sound, this.settings.kid, this.settings.magic);
        break;
      case 'clear':
        drawWorld(ctx, this.world, this.time);
        drawClear(
          ctx,
          this.summary,
          this.world.level.name,
          this.screenTime,
          this.levelIndex + 1 >= LEVELS.length,
          this.world.level.id,
        );
        break;
      case 'gameover':
        drawWorld(ctx, this.world, this.time);
        drawGameOver(ctx, this.overMenu, this.time, this.world.score);
        break;
      case 'ending':
        drawEnding(ctx, this.world.score, this.screenTime);
        break;
      case 'map':
        drawWorldMap(ctx, {
          unlocked: this.unlocked,
          cursor: this.mapCursor,
          marker: this.mapMarker,
          cleared: this.unlocked,
          time: this.time,
          moving: this.mapMove !== null,
        });
        break;
      case 'name':
        drawEnding(ctx, this.world.score, 12);
        break;
      case 'records':
        drawRecords(ctx, this.records, this.recordsScroll, this.time);
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
