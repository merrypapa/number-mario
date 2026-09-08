import { chromium } from 'playwright';

const OUT = process.argv[2] || '/tmp/shots';
const URL = process.argv[3] || 'http://localhost:4173/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/01-title.png` });

// 스토리 → 게임 시작
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/03-story.png` });
for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(600); }
await page.waitForTimeout(2200);

/** 오른쪽으로 달리며 주기적으로 점프/스킬 */
async function play(seconds, { skill = false } = {}) {
  await page.keyboard.down('ArrowRight');
  const start = Date.now();
  while (Date.now() - start < seconds * 1000) {
    await page.keyboard.down('Space');
    await page.waitForTimeout(160);
    await page.keyboard.up('Space');
    if (skill) await page.keyboard.press('KeyX');
    await page.waitForTimeout(300);
  }
  await page.keyboard.up('ArrowRight');
}

await play(4, { skill: true });
await page.evaluate(() => window.numberRun.debugSetNumber(4));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/05-stage1.png` });

async function goStage(i, number, name, seconds = 4) {
  await page.evaluate((idx) => window.numberRun.debugLoad(idx), i);
  await page.waitForTimeout(1900);
  if (number) await page.evaluate((n) => window.numberRun.debugSetNumber(n), number);
  await play(seconds, { skill: true });
  if (number) await page.evaluate((n) => window.numberRun.debugSetNumber(n), number);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}` });
}

await goStage(1, 6, '06-stage2.png');
await goStage(2, 7, '07-stage3.png');
await goStage(3, 9, '08-stage4.png');
await goStage(4, 10, '09-boss.png', 3);

// 10 상태 캐릭터 확인용 근접 샷
await page.evaluate(() => window.numberRun.debugSetNumber(10));
await page.waitForTimeout(400);
await page.keyboard.press('KeyX');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/10-ten.png` });

console.log(JSON.stringify({ errors: errors.filter((e) => !e.includes('404')) }, null, 2));
await browser.close();
