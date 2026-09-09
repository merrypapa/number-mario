export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'skill' | 'pause' | 'confirm' | 'magic';

const KEY_MAP: Record<string, Action[]> = {
  ArrowLeft: ['left'],
  KeyA: ['left'],
  ArrowRight: ['right'],
  KeyD: ['right'],
  ArrowUp: ['up', 'jump'],
  KeyW: ['up', 'jump'],
  ArrowDown: ['down'],
  KeyS: ['down'],
  Space: ['jump', 'confirm'],
  KeyZ: ['jump'],
  KeyX: ['skill'],
  KeyK: ['skill'],
  ShiftLeft: ['skill'],
  ShiftRight: ['skill'],
  Enter: ['confirm'],
  Escape: ['pause'],
  KeyP: ['pause'],
  KeyM: ['magic'],
};

/** 키보드 + 터치 입력을 액션 단위로 정규화한다. */
export class Input {
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private virtual = new Set<Action>();
  /** 마지막 입력이 터치였는지 (가상 패드 표시 판단용) */
  touchUsed = false;

  attach(target: Window = window): void {
    target.addEventListener('keydown', (e) => {
      const actions = KEY_MAP[e.code];
      if (!actions) return;
      e.preventDefault();
      if (e.repeat) return;
      for (const a of actions) this.press(a);
    });
    target.addEventListener('keyup', (e) => {
      const actions = KEY_MAP[e.code];
      if (!actions) return;
      e.preventDefault();
      for (const a of actions) this.release(a);
    });
    target.addEventListener('blur', () => {
      for (const a of [...this.down]) this.release(a);
    });
  }

  press(a: Action): void {
    if (!this.down.has(a)) this.pressed.add(a);
    this.down.add(a);
  }

  release(a: Action): void {
    if (this.down.has(a)) this.released.add(a);
    this.down.delete(a);
  }

  /** 터치 버튼용. 같은 액션이 키보드와 겹쳐도 안전하게 동작한다. */
  setTouch(a: Action, isDown: boolean): void {
    this.touchUsed = true;
    if (isDown) {
      if (!this.virtual.has(a)) {
        this.virtual.add(a);
        this.press(a);
      }
    } else if (this.virtual.has(a)) {
      this.virtual.delete(a);
      this.release(a);
    }
  }

  isDown(a: Action): boolean {
    return this.down.has(a);
  }

  justPressed(a: Action): boolean {
    return this.pressed.has(a);
  }

  justReleased(a: Action): boolean {
    return this.released.has(a);
  }

  anyPressed(): boolean {
    return this.pressed.size > 0;
  }

  /** 프레임 끝에서 엣지 상태를 비운다. */
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
  }

  clearAll(): void {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
    this.virtual.clear();
  }
}
