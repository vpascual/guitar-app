// End-to-end check against the production build at a mobile viewport:
// time to first puzzle (cold and from the service-worker cache), offline load, one-thumb layout,
// a run through the feed, and a full practice session.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const URL = 'http://localhost:4173/';
const LIMIT_MS = 2000;
const shots = process.env.SHOTS_DIR;
if (shots) mkdirSync(shots, { recursive: true });
const fail = [];
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail.push(msg); };

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const timeToPuzzle = async () => {
    const t0 = Date.now();
    await page.goto(URL, { waitUntil: 'commit' });
    await page.waitForSelector('[data-testid=puzzle] .prompt');
    return Date.now() - t0;
  };

  const cold = await timeToPuzzle();
  check(cold < LIMIT_MS, `cold load to first puzzle: ${cold} ms (limit ${LIMIT_MS})`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(800);
  const warm = await timeToPuzzle();
  check(warm < LIMIT_MS, `cached load to first puzzle: ${warm} ms`);
  await context.setOffline(true);
  const offline = await timeToPuzzle();
  check(offline < LIMIT_MS, `offline load to first puzzle: ${offline} ms`);
  await context.setOffline(false);
  if (shots) await page.screenshot({ path: `${shots}/feed.png` });

  // One-thumb rule: every answer control is at least 48 px tall and sits in the lower 60 % of the screen.
  const vh = page.viewportSize().height;
  let thumbOk = true;
  let kinds = new Set();
  for (let i = 0; i < 150 && (i < 40 || kinds.size < 2); i++) {
    const options = page.locator('.answers .option');
    const n = await options.count();
    if (n) {
      for (let k = 0; k < n; k++) {
        const b = await options.nth(k).boundingBox();
        if (b.height < 48 || b.y < vh * 0.4 - 1) thumbOk = false;
      }
      kinds.add('choice');
      await options.nth(i % n).click();
    } else {
      kinds.add('tap');
      await page.locator('.fretboard .tap').nth(7).click();
    }
    await page.waitForSelector('[data-testid=explanation]');
    const words = (await page.locator('[data-testid=explanation] > p').first().innerText()).split(/\s+/).length;
    if (words > 90) thumbOk = false;
    if (shots && i === 0) await page.screenshot({ path: `${shots}/explanation.png` });
    const next = await page.locator('[data-testid=next]').boundingBox();
    if (next.y + next.height > vh + 1 || next.height < 48) thumbOk = false;
    await page.locator('[data-testid=next]').click();
  }
  check(thumbOk, 'answers and "next" are thumb-reachable (>= 48 px, lower 60 % of the screen), explanations under 90 words');
  check(kinds.has('choice') && kinds.has('tap'), `feed served both multiple choice and fretboard tap within 150 puzzles (${[...kinds]})`);
  const today = await page.locator('.today').innerText();
  check(/avui: \d+/.test(today), `daily counter visible: "${today}"`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check(!overflow, 'no horizontal scroll on the feed');

  // Practice: build a 30-minute session, check its parts, rate every block.
  const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const p2 = await tablet.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.goto(URL + '#/practica');
  await p2.getByRole('button', { name: '30 min' }).click();
  await p2.waitForSelector('.block');
  check((await p2.locator('.block').count()) === 4, 'session has four blocks');
  check((await p2.locator('.tab pre').count()) >= 3, 'tabs are rendered');
  const tab = await p2.locator('.tab pre').first().innerText();
  check(['e|', 'B|', 'G|', 'D|', 'A|', 'E|'].every((l) => tab.includes(l)), 'tab labels all six strings');
  if (shots) await p2.screenshot({ path: `${shots}/practice.png`, fullPage: true });
  await p2.getByRole('button', { name: 'Metrònom' }).first().click();
  await p2.waitForTimeout(900);
  check((await p2.locator('.beat.on').count()) >= 1, 'metronome runs and shows the beat');
  await p2.getByRole('button', { name: 'Metrònom' }).first().click();
  await p2.getByRole('button', { name: 'Comença' }).first().click();
  await p2.waitForTimeout(1300);
  check((await p2.locator('.clock').first().innerText()) !== '04:00', 'block timer counts down');
  for (let i = 0; i < 4; i++) {
    await p2.locator('.block[open] .rate .btn.clean').click();
    await p2.waitForTimeout(150);
    if (shots && i === 1) await p2.screenshot({ path: `${shots}/practice-chords.png`, fullPage: true });
  }
  check(await p2.getByText('Sessió acabada.').isVisible(), 'session completes after rating all blocks');
  check((await p2.locator('.chord svg').count()) >= 2, 'chord diagrams are SVG');

  check(errors.length === 0, `no console or page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} finally {
  await browser.close();
  server.kill();
}
if (fail.length) { console.error(`\n${fail.length} check(s) failed`); process.exit(1); }
console.log('\nAll end-to-end checks passed');
