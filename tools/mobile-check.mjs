import { chromium } from 'playwright';
const OUT = process.argv[2], URL = process.argv[3];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 }, // 가로 모드 폰
  hasTouch: true, isMobile: true, deviceScaleFactor: 3,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

console.log('터치 UI 표시:', await page.evaluate(() => document.body.classList.contains('touch')));
console.log('버튼 touch-action:', await page.evaluate(() =>
  getComputedStyle(document.getElementById('btn-jump')).touchAction));
console.log('캔버스 touch-action:', await page.evaluate(() =>
  getComputedStyle(document.getElementById('game')).touchAction));

// dblclick 기본동작이 취소되는지
const dblPrevented = await page.evaluate(() => {
  const e = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
  document.getElementById('btn-jump').dispatchEvent(e);
  return e.defaultPrevented;
});
console.log('dblclick 취소됨:', dblPrevented);

// 터치 버튼으로 게임 시작 (점프=확인)
for (let i = 0; i < 6; i++) {
  const s = await page.evaluate(() => window.numberRun.screen);
  if (s === 'play') break;
  await page.tap('#btn-jump');
  await page.waitForTimeout(600);
}
await page.waitForTimeout(500);
console.log('화면:', await page.evaluate(() => window.numberRun.screen));

const scaleBefore = await page.evaluate(() => window.visualViewport?.scale ?? 1);

// 점프 버튼 빠르게 연타 (더블탭 확대를 유발하던 동작)
const before = await page.evaluate(() => window.numberRun.world.player.box.y);
await page.tap('#btn-jump');
await page.waitForTimeout(90);
const midAir = await page.evaluate(() => window.numberRun.world.player.box.y);
await page.tap('#btn-jump');
await page.waitForTimeout(90);
const after = await page.evaluate(() => window.numberRun.world.player.box.y);
const scaleAfter = await page.evaluate(() => window.visualViewport?.scale ?? 1);

console.log('연타 반응  : 지면 y=%s → 점프중 y=%s → 재탭 y=%s', Math.round(before), Math.round(midAir), Math.round(after));
console.log('확대 배율  : %s → %s', scaleBefore, scaleAfter);

// 이동 버튼: CDP 로 진짜 "누르고 있기 → 떼기" 를 재현해 릴리즈 처리를 검증
const client = await ctx.newCDPSession(page);
const center = async (sel) => {
  const b = await (await page.$(sel)).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const hold = async (sel, ms) => {
  const p = await center(sel);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await page.waitForTimeout(ms);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

const x0 = await page.evaluate(() => Math.round(window.numberRun.world.player.box.x));
await hold('#btn-right', 700);
const x1 = await page.evaluate(() => Math.round(window.numberRun.world.player.box.x));
await page.waitForTimeout(600); // 뗀 뒤 멈추는지
const x2 = await page.evaluate(() => Math.round(window.numberRun.world.player.box.x));
console.log('오른쪽 누름: x %s → %s (이동), 뗀 뒤 600ms: %s', x0, x1, x2);
console.log('  → 이동함:', x1 > x0 + 20, '/ 뗀 뒤 멈춤:', Math.abs(x2 - x1) < 12);

// 더블탭처럼 빠르게 두 번 눌렀다 떼도 고착되지 않는지
await hold('#btn-right', 80);
await page.waitForTimeout(40);
await hold('#btn-right', 80);
await page.waitForTimeout(700);
const x3 = await page.evaluate(() => Math.round(window.numberRun.world.player.box.x));
await page.waitForTimeout(500);
const x4 = await page.evaluate(() => Math.round(window.numberRun.world.player.box.x));
console.log('연타 후 정지 확인: %s → %s / 고착 없음:', x3, x4, Math.abs(x4 - x3) < 12);

await page.screenshot({ path: `${OUT}/M-mobile.png` });
console.log('errors:', errors);
await browser.close();
