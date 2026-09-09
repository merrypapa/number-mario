import { describe, expect, it, vi } from 'vitest';
import { DOUBLE_TAP_MS, isDoubleTap, preventBrowserGestures } from '../src/core/touch';

describe('브라우저 제스처 차단', () => {
  it('짧은 간격의 두 번째 탭을 더블탭으로 본다', () => {
    expect(isDoubleTap(1000, 800)).toBe(true);
    expect(isDoubleTap(1000, 1000 - DOUBLE_TAP_MS)).toBe(true);
  });

  it('간격이 길면 더블탭이 아니다', () => {
    expect(isDoubleTap(1000, 1000 - DOUBLE_TAP_MS - 1)).toBe(false);
    expect(isDoubleTap(5000, 100)).toBe(false);
  });

  it('첫 탭은 더블탭이 아니다', () => {
    expect(isDoubleTap(1000, 0)).toBe(false);
  });

  it('확대를 일으키는 이벤트를 모두 등록한다', () => {
    const listeners: string[] = [];
    const fake = { addEventListener: (type: string) => listeners.push(type) } as unknown as Document;
    preventBrowserGestures(fake);
    for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'touchend', 'touchmove', 'contextmenu']) {
      expect(listeners, type).toContain(type);
    }
  });

  it('확대 제스처의 기본 동작을 취소한다', () => {
    const handlers = new Map<string, (e: Event) => void>();
    const fake = {
      addEventListener: (type: string, fn: (e: Event) => void) => handlers.set(type, fn),
    } as unknown as Document;
    preventBrowserGestures(fake);

    const makeEvent = (extra: Record<string, unknown> = {}) => ({
      preventDefault: vi.fn(),
      ...extra,
    });

    const gesture = makeEvent();
    handlers.get('gesturestart')!(gesture as unknown as Event);
    expect(gesture.preventDefault).toHaveBeenCalled();

    const dbl = makeEvent();
    handlers.get('dblclick')!(dbl as unknown as Event);
    expect(dbl.preventDefault).toHaveBeenCalled();

    // 손가락 두 개 = 핀치 줌은 막고, 한 개는 통과시킨다
    const pinch = makeEvent({ touches: { length: 2 } });
    handlers.get('touchmove')!(pinch as unknown as Event);
    expect(pinch.preventDefault).toHaveBeenCalled();

    const oneFinger = makeEvent({ touches: { length: 1 } });
    handlers.get('touchmove')!(oneFinger as unknown as Event);
    expect(oneFinger.preventDefault).not.toHaveBeenCalled();
  });

  it('연속 탭만 취소하고 느린 탭은 그대로 둔다', () => {
    const handlers = new Map<string, (e: Event) => void>();
    const fake = {
      addEventListener: (type: string, fn: (e: Event) => void) => handlers.set(type, fn),
    } as unknown as Document;
    preventBrowserGestures(fake);
    const touchend = handlers.get('touchend')!;

    const now = vi.spyOn(Date, 'now');

    now.mockReturnValue(1000);
    const first = { preventDefault: vi.fn() };
    touchend(first as unknown as Event);
    expect(first.preventDefault).not.toHaveBeenCalled(); // 첫 탭은 통과

    now.mockReturnValue(1100);
    const second = { preventDefault: vi.fn() };
    touchend(second as unknown as Event);
    expect(second.preventDefault).toHaveBeenCalled(); // 100ms 뒤 = 더블탭

    now.mockReturnValue(9000);
    const later = { preventDefault: vi.fn() };
    touchend(later as unknown as Event);
    expect(later.preventDefault).not.toHaveBeenCalled(); // 한참 뒤 = 정상 탭

    now.mockRestore();
  });
});
