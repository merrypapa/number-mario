import { VIEW_W, VIEW_H } from './constants';
import { clamp } from '../engine/physics';

/** 데드존을 가진 추적 카메라 + 화면 흔들림. */
export class Camera {
  x = 0;
  y = 0;
  private shakeTime = 0;
  private shakeMag = 0;
  shakeX = 0;
  shakeY = 0;
  enabledShake = true;

  constructor(public worldW: number, public worldH: number) {}

  setWorld(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
  }

  /** 목표 지점으로 부드럽게 이동하며 월드 밖을 보지 않도록 고정한다. */
  follow(targetX: number, targetY: number, dt: number, snap = false): void {
    const desiredX = targetX - VIEW_W / 2;
    const desiredY = targetY - VIEW_H * 0.58;
    const lerp = snap ? 1 : 1 - Math.pow(0.001, dt);
    this.x += (desiredX - this.x) * lerp;
    this.y += (desiredY - this.y) * lerp;
    this.clampToWorld();
  }

  clampToWorld(): void {
    this.x = clamp(this.x, 0, Math.max(0, this.worldW - VIEW_W));
    this.y = clamp(this.y, -VIEW_H * 0.5, Math.max(0, this.worldH - VIEW_H));
  }

  shake(magnitude: number, time = 0.25): void {
    if (!this.enabledShake) return;
    this.shakeMag = Math.max(this.shakeMag, magnitude);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  update(dt: number): void {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const power = this.shakeMag * Math.max(0, this.shakeTime / 0.25);
      this.shakeX = (Math.random() * 2 - 1) * power;
      this.shakeY = (Math.random() * 2 - 1) * power;
      if (this.shakeTime <= 0) {
        this.shakeMag = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }
  }

  get offsetX(): number {
    return Math.round(this.x + this.shakeX);
  }

  get offsetY(): number {
    return Math.round(this.y + this.shakeY);
  }
}
