/**
 * 브라우저 기본 터치 제스처(더블탭 확대, 핀치 줌, 당겨서 새로고침, 롱프레스 메뉴)를 막는다.
 *
 * CSS `touch-action` 은 **상속되지 않으므로** 요소마다 지정해야 하고,
 * iOS Safari 는 `user-scalable=no` 를 무시하기 때문에
 * 제스처 이벤트를 직접 취소해야 한다.
 */

/** 더블탭으로 간주하는 두 탭 사이의 최대 간격(ms) */
export const DOUBLE_TAP_MS = 350;

/**
 * 직전 탭과의 간격으로 더블탭(=확대 제스처)인지 판정한다.
 * 순수 함수라 단위 테스트로 검증한다.
 */
export function isDoubleTap(now: number, lastTapAt: number, threshold = DOUBLE_TAP_MS): boolean {
  if (lastTapAt <= 0) return false;
  const gap = now - lastTapAt;
  return gap >= 0 && gap <= threshold;
}

export function preventBrowserGestures(target: Document = document): void {
  const stop = (e: Event) => e.preventDefault();

  // iOS Safari 전용 핀치 줌 제스처
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    target.addEventListener(type, stop, { passive: false });
  }

  // 더블탭/더블클릭 확대
  target.addEventListener('dblclick', stop, { passive: false });

  // touch-action 을 무시하는 브라우저를 위한 이중 방어:
  // 짧은 간격으로 두 번째 탭이 끝나면 기본 동작(확대)을 취소한다
  let lastTapAt = 0;
  target.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (isDoubleTap(now, lastTapAt)) e.preventDefault();
      lastTapAt = now;
    },
    { passive: false },
  );

  // 손가락 두 개 이상 = 핀치 줌
  target.addEventListener(
    'touchmove',
    (e) => {
      if ((e as TouchEvent).touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );

  // 롱프레스 컨텍스트 메뉴
  target.addEventListener('contextmenu', stop);
}
