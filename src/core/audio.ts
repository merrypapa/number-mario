/**
 * WebAudio 합성 사운드. 외부 오디오 파일을 쓰지 않는다.
 * 브라우저 정책상 첫 사용자 입력 이후에 resume() 된다.
 */

type Wave = OscillatorType;

const A4 = 440;
/** 반음 오프셋(A4=0)을 주파수로 */
const hz = (semitone: number) => A4 * Math.pow(2, semitone / 12);

interface NoteOpts {
  wave?: Wave;
  gain?: number;
  attack?: number;
  decay?: number;
  glideTo?: number;
  detune?: number;
}

/** 8비트 느낌의 짧은 멜로디 루프 정의 */
interface Track {
  bpm: number;
  /** 8분음표 단위. null은 쉼표 */
  lead: (number | null)[];
  bass: (number | null)[];
  leadWave: Wave;
  bassWave: Wave;
}

const TRACKS: Record<string, Track> = {
  field: {
    bpm: 138,
    leadWave: 'square',
    bassWave: 'triangle',
    lead: [
      4, 7, 11, 14, 11, 7, 4, 7,
      2, 5, 9, 12, 9, 5, 2, 5,
      0, 4, 7, 12, 7, 4, 0, 4,
      -1, 2, 7, 11, 7, 2, -1, 2,
    ],
    bass: [-20, null, -8, null, -20, null, -8, null, -22, null, -10, null, -22, null, -10, null,
           -24, null, -12, null, -24, null, -12, null, -25, null, -13, null, -25, null, -13, null],
  },
  hill: {
    bpm: 126,
    leadWave: 'square',
    bassWave: 'triangle',
    lead: [
      7, null, 7, 9, 11, null, 9, 7,
      4, null, 4, 7, 9, null, 7, 4,
      2, null, 5, 7, 9, null, 7, 5,
      0, null, 4, 7, 4, null, 0, null,
    ],
    bass: [-17, null, -5, null, -17, null, -5, null, -20, null, -8, null, -20, null, -8, null,
           -22, null, -10, null, -22, null, -10, null, -24, null, -12, null, -12, null, -12, null],
  },
  canyon: {
    bpm: 144,
    leadWave: 'sawtooth',
    bassWave: 'triangle',
    lead: [
      12, 11, 9, 7, 9, 11, 12, 14,
      16, 14, 12, 11, 12, 14, 16, 19,
      14, 12, 11, 9, 11, 12, 14, 16,
      7, 9, 11, 12, 14, 16, 19, 21,
    ],
    bass: [-20, -20, -8, -20, -20, -20, -8, -20, -18, -18, -6, -18, -18, -18, -6, -18,
           -22, -22, -10, -22, -22, -22, -10, -22, -25, -25, -13, -25, -13, -13, -13, -13],
  },
  cave: {
    bpm: 112,
    leadWave: 'triangle',
    bassWave: 'sine',
    lead: [
      0, null, 3, null, 7, null, 3, null,
      -2, null, 3, null, 5, null, 3, null,
      -4, null, 0, null, 3, null, 0, null,
      -5, null, -1, null, 2, null, -1, null,
    ],
    bass: [-24, null, null, null, -24, null, null, null, -26, null, null, null, -26, null, null, null,
           -28, null, null, null, -28, null, null, null, -29, null, null, null, -29, null, null, null],
  },
  tower: {
    bpm: 152,
    leadWave: 'sawtooth',
    bassWave: 'square',
    lead: [
      0, 1, 0, -2, 0, 1, 0, 3,
      5, 4, 3, 1, 0, 1, 3, 5,
      7, 6, 5, 3, 1, 0, -2, 0,
      12, 11, 10, 8, 7, 5, 3, 1,
    ],
    bass: [-24, -24, -24, -24, -23, -23, -23, -23, -22, -22, -22, -22, -21, -21, -21, -21,
           -20, -20, -20, -20, -21, -21, -21, -21, -22, -22, -22, -22, -24, -24, -24, -24],
  },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private track: Track | null = null;

  soundOn = true;
  musicOn = true;

  /** 사용자 제스처 이후 호출. 여러 번 호출해도 안전. */
  init(): void {
    // 브라우저가 아닌 환경(테스트/SSR)에서는 아무것도 하지 않는다
    if (typeof window === 'undefined') return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.28;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.75;
    this.sfxGain.connect(this.master);
  }

  private note(semi: number, dur: number, when: number, dest: GainNode, o: NoteOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.wave ?? 'square';
    osc.frequency.setValueAtTime(hz(semi), when);
    if (o.glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(hz(o.glideTo), when + dur);
    if (o.detune) osc.detune.value = o.detune;
    const peak = o.gain ?? 0.25;
    const attack = o.attack ?? 0.005;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private noise(dur: number, when: number, gainValue = 0.2): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(gain);
    gain.connect(this.sfxGain);
    src.start(when);
  }

  play(name: string, param = 0): void {
    if (!this.soundOn) return;
    this.init();
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'jump':
        this.note(0, 0.14, t, dest, { wave: 'square', glideTo: 12, gain: 0.22 });
        break;
      case 'doubleJump':
        this.note(7, 0.14, t, dest, { wave: 'square', glideTo: 19, gain: 0.22 });
        break;
      case 'coin':
        this.note(14, 0.06, t, dest, { wave: 'square', gain: 0.2 });
        this.note(21, 0.16, t + 0.06, dest, { wave: 'square', gain: 0.2 });
        break;
      case 'numberUp':
        [0, 4, 7, 12].forEach((s, i) => this.note(s + 3, 0.11, t + i * 0.06, dest, { wave: 'square', gain: 0.2 }));
        break;
      case 'numberDown':
        [7, 3, 0, -5].forEach((s, i) => this.note(s, 0.11, t + i * 0.06, dest, { wave: 'triangle', gain: 0.2 }));
        break;
      case 'hurt':
        this.note(4, 0.3, t, dest, { wave: 'sawtooth', glideTo: -16, gain: 0.22 });
        this.noise(0.18, t, 0.16);
        break;
      case 'stomp':
        this.note(-5, 0.09, t, dest, { wave: 'square', glideTo: -17, gain: 0.24 });
        this.noise(0.07, t, 0.12);
        break;
      case 'star':
        this.note(16, 0.09, t, dest, { wave: 'square', glideTo: 26, gain: 0.16 });
        break;
      case 'skill':
        this.note(param, 0.12, t, dest, { wave: 'square', glideTo: param + 12, gain: 0.2 });
        break;
      case 'break':
        this.noise(0.22, t, 0.24);
        this.note(-7, 0.14, t, dest, { wave: 'sawtooth', glideTo: -19, gain: 0.16 });
        break;
      case 'slam':
        this.note(-12, 0.28, t, dest, { wave: 'sawtooth', glideTo: -26, gain: 0.28 });
        this.noise(0.3, t, 0.3);
        break;
      case 'checkpoint':
        [0, 7, 12].forEach((s, i) => this.note(s + 7, 0.12, t + i * 0.08, dest, { wave: 'triangle', gain: 0.22 }));
        break;
      case 'clear':
        [0, 4, 7, 12, 16, 19].forEach((s, i) =>
          this.note(s + 3, 0.18, t + i * 0.13, dest, { wave: 'square', gain: 0.24 }),
        );
        break;
      case 'death':
        [7, 5, 3, 0, -5, -12].forEach((s, i) =>
          this.note(s, 0.16, t + i * 0.1, dest, { wave: 'triangle', gain: 0.24 }),
        );
        break;
      case 'bossHit':
        this.note(-2, 0.35, t, dest, { wave: 'sawtooth', glideTo: -22, gain: 0.3 });
        this.noise(0.35, t, 0.28);
        break;
      case 'select':
        this.note(12, 0.07, t, dest, { wave: 'square', gain: 0.18 });
        break;
      default:
        break;
    }
  }

  startMusic(themeKey: string): void {
    this.init();
    const track = TRACKS[themeKey] ?? TRACKS.field;
    if (this.track === track && this.timer !== null) return;
    this.stopMusic();
    this.track = track;
    if (!this.musicOn || !this.ctx) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule(): void {
    const ctx = this.ctx;
    const track = this.track;
    const dest = this.musicGain;
    if (!ctx || !track || !dest) return;
    const stepDur = 60 / track.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const i = this.step % track.lead.length;
      const lead = track.lead[i];
      const bass = track.bass[i % track.bass.length];
      if (lead !== null && lead !== undefined) {
        this.note(lead, stepDur * 0.9, this.nextTime, dest, { wave: track.leadWave, gain: 0.16 });
      }
      if (bass !== null && bass !== undefined) {
        this.note(bass, stepDur * 1.4, this.nextTime, dest, { wave: track.bassWave, gain: 0.22 });
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }

  stopMusic(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.track = null;
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (!on) this.stopMusic();
  }
}

export const audio = new AudioEngine();
