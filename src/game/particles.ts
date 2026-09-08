import { COLORS } from '../render/palette';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  /** 'square' | 'circle' | 'text' */
  kind: 'square' | 'circle' | 'text';
  text?: string;
  fade: boolean;
}

export class ParticleSystem {
  readonly items: Particle[] = [];

  private push(p: Particle): void {
    if (this.items.length > 400) this.items.shift();
    this.items.push(p);
  }

  burst(x: number, y: number, count: number, color: string, opts: Partial<Particle> = {}): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 2 + Math.random() * 3,
        color,
        gravity: 420,
        kind: 'square',
        fade: true,
        ...opts,
      });
    }
  }

  dust(x: number, y: number, count = 5): void {
    for (let i = 0; i < count; i++) {
      this.push({
        x: x + (Math.random() - 0.5) * 14,
        y,
        vx: (Math.random() - 0.5) * 70,
        vy: -Math.random() * 50,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        size: 2 + Math.random() * 2,
        color: '#ffffff',
        gravity: 120,
        kind: 'circle',
        fade: true,
      });
    }
  }

  sparkle(x: number, y: number, color: string = COLORS.coin): void {
    this.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 30,
      vy: -30 - Math.random() * 30,
      life: 0.35,
      maxLife: 0.35,
      size: 2,
      color,
      gravity: 0,
      kind: 'circle',
      fade: true,
    });
  }

  debris(x: number, y: number, color: string): void {
    const speeds = [
      [-90, -260],
      [90, -260],
      [-60, -160],
      [60, -160],
    ];
    for (const [vx, vy] of speeds) {
      this.push({
        x,
        y,
        vx,
        vy,
        life: 0.9,
        maxLife: 0.9,
        size: 6,
        color,
        gravity: 900,
        kind: 'square',
        fade: false,
      });
    }
  }

  floatingText(x: number, y: number, text: string, color: string = COLORS.white): void {
    this.push({
      x,
      y,
      vx: 0,
      vy: -42,
      life: 0.9,
      maxLife: 0.9,
      size: 8,
      color,
      gravity: 0,
      kind: 'text',
      text,
      fade: true,
    });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  clear(): void {
    this.items.length = 0;
  }
}
