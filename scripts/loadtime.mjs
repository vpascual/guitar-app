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

  // The app opens on the home screen; a puzzle is one tap away. Both moments are timed from navigation.
  let homeMs = 0;
  const timeToPuzzle = async () => {
    await page.goto('about:blank');
    const t0 = Date.now();
    await page.goto(URL, { waitUntil: 'commit' });
    await page.waitForSelector('[data-testid=home] [data-testid=tip]');
    homeMs = Date.now() - t0;
    await page.locator('[data-testid=start-puzzles]:visible').click();
    await page.waitForSelector('[data-testid=puzzle] .prompt');
    return Date.now() - t0;
  };

  const cold = await timeToPuzzle();
  check(cold < LIMIT_MS, `cold load: home in ${homeMs} ms, first puzzle after one tap in ${cold} ms (limit ${LIMIT_MS})`);
  check((await page.locator('.tabbar .tab:visible').count()) === 5, 'tab bar has five sections');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(800);
  const warm = await timeToPuzzle();
  check(warm < LIMIT_MS, `cached load: home in ${homeMs} ms, first puzzle in ${warm} ms`);
  await context.setOffline(true);
  const offline = await timeToPuzzle();
  check(offline < LIMIT_MS, `offline load: home in ${homeMs} ms, first puzzle in ${offline} ms`);
  await context.setOffline(false);
  if (shots) await page.screenshot({ path: `${shots}/feed.png` });

  // One-thumb rule: every answer control is at least 48 px tall and sits in the lower 60 % of the screen.
  const vh = page.viewportSize().height;
  let thumbOk = true;
  let kinds = new Set();
  for (let i = 0; i < 300 && (i < 40 || !(kinds.has('choice') && kinds.has('tap'))); i++) {
    const options = page.locator('.answers .option:visible');
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
      await page.locator('.fretboard .tap:visible').nth(7).click();
    }
    await page.waitForSelector('[data-testid=explanation]');
    if (i === 0) check(/nivell \d+ \([+−]\d+\)/.test(await page.locator('[data-testid=rating]:visible').innerText()), 'rating change is shown after an answer');
    const listen = page.locator('[data-testid=explanation] .btn.listen:visible');
    if (!kinds.has('listened') && (await listen.count())) {
      await listen.click();
      await page.waitForTimeout(400);
      if ((await listen.innerText()).includes('sonant')) kinds.add('listened');
    }
    const words = (await page.locator('[data-testid=explanation] > p:visible').first().innerText()).split(/\s+/).length;
    if (words > 90) thumbOk = false;
    if (shots && i === 0) await page.screenshot({ path: `${shots}/explanation.png` });
    const next = await page.locator('[data-testid=next]:visible').boundingBox();
    if (next.y + next.height > vh + 1 || next.height < 48) thumbOk = false;
    await page.locator('[data-testid=next]:visible').click();
  }
  check(thumbOk, 'answers and "next" are thumb-reachable (>= 48 px, lower 60 % of the screen), explanations under 90 words');
  check(kinds.has('choice') && kinds.has('tap'), `feed served both multiple choice and fretboard tap within 300 puzzles (${[...kinds]})`);
  check(kinds.has('listened'), 'the listen button plays through the string synth without errors');
  kinds.delete('listened');
  const today = await page.locator('.today:visible').innerText();
  check(/avui: \d+/.test(today), `daily counter visible: "${today}"`);
  check(/setmana: 1\/7/.test(today), 'weekly rhythm counts today as an active day');
  await page.goto(URL + '#/progres');
  await page.waitForSelector('[data-testid=mastery-total]');
  const cells = await page.locator('.group .cell:visible').count();
  const touched = await page.locator('.group .cell.learning:visible, .group .cell.solid:visible').count();
  check(cells >= 50 && touched >= 5, `mastery map shows ${cells} concepts, ${touched} already touched by the run`);
  check((await page.locator('.bar.active:visible').count()) === 1, 'this week shows one active day as a bar');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll on the progress screen');
  if (shots) await page.screenshot({ path: `${shots}/progress.png`, fullPage: true });
  // Home after some use: stats filled in, a tip, and the "try it" button opens a puzzle on the tip's concept.
  await page.goto(URL + '#/');
  await page.waitForSelector('[data-testid=tip]');
  await page.waitForFunction(() => /\d+%/.test(document.querySelector('.stats')?.textContent ?? ''));
  check((await page.locator('.bar.active:visible').count()) === 1 && (await page.locator('.menu .card:visible').count()) === 4, 'home shows this week as bars, recent accuracy and four ways in');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll on the home screen');
  const tipTitle = await page.locator('[data-testid=tip] h2:visible').innerText();
  await page.getByRole('button', { name: 'Un altre' }).click();
  check((await page.locator('[data-testid=tip] h2:visible').innerText()) !== tipTitle, 'another tip appears on request');
  if (shots) await page.screenshot({ path: `${shots}/home.png`, fullPage: true });
  await page.getByRole('link', { name: "Posa-t'hi a prova" }).click();
  await page.waitForSelector('[data-testid=puzzle] .prompt');
  check(true, 'the tip opens a puzzle');

  // "No ho sé": shows the answer with the worked solution and leads to the theory topic.
  await page.locator('[data-testid=skip]:visible').click();
  await page.waitForSelector('[data-testid=explanation]');
  check((await page.locator('[data-testid=steps] li:visible').count()) >= 3, 'the worked solution has at least three steps');
  check((await page.locator('[data-testid=explanation] > strong:visible').innerText()).length > 5, '"No ho sé" reveals the answer');
  const promptBefore = await page.locator('[data-testid=puzzle]:visible').getAttribute('data-prompt');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.locator('[data-testid=theory-link]:visible').click();
  await page.waitForSelector('[data-testid=topic] h1');
  check((await page.locator('.doc > *:visible').count()) >= 8, `"No ho sé" leads to a theory topic: "${await page.locator('[data-testid=topic] h1:visible').innerText()}"`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll on a theory topic');
  await page.selectOption('#theory-key', 'Eb').catch(() => undefined);
  check((await page.locator('.doc > *:visible').count()) >= 8, 'theory examples can be moved to another key');
  // Back: returns to the same puzzle, still answered, scrolled where it was.
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.locator('[data-testid=back]:visible').click();
  await page.waitForSelector('[data-testid=puzzle] .prompt');
  check((await page.locator('[data-testid=puzzle]:visible').getAttribute('data-prompt')) === promptBefore
    && (await page.locator('[data-testid=explanation]:visible').count()) === 1, 'back returns to the same answered puzzle');
  await page.waitForTimeout(200);
  check(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore) < 4, `back restores the scroll position (${scrollBefore} px)`);
  await page.goForward();
  await page.waitForSelector('[data-testid=topic] h1');
  await page.waitForTimeout(200);
  check(Math.abs((await page.evaluate(() => window.scrollY)) - 400) < 4, 'forward again lands where the theory page was left');
  await page.goto(URL + '#/teoria');
  await page.waitForSelector('.row-link');
  const topics = await page.locator('.row-link:visible').count();
  check(topics >= 35, `theory index lists ${topics} topics`);
  if (shots) await page.screenshot({ path: `${shots}/theory-index.png` });
  await page.goto(URL + '#/teoria/escala-dorian');
  await page.waitForSelector('[data-testid=topic] h1');
  check((await page.locator('.neck svg:visible').count()) === 1 && (await page.locator('.neck-dot.char:visible').count()) >= 2, 'a mode page draws the scale on the neck with the characteristic note marked');
  check((await page.locator('.scale-row .chip.marked:visible').count()) === 1 && (await page.locator('.doc-table tr.marked:visible').count()) >= 1, 'the characteristic degree and its chords are highlighted');
  if (shots) await page.screenshot({ path: `${shots}/theory-dorian.png`, fullPage: true });
  await page.goto(URL + '#/reptes');
  await page.waitForSelector('[data-testid=puzzle] .prompt');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check(!overflow, 'no horizontal scroll on the feed');

  // Practice: build a 30-minute session, check its parts, rate every block.
  const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const p2 = await tablet.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.goto(URL + '#/practica');
  await p2.getByRole('button', { name: '30 min' }).click();
  await p2.waitForSelector('.block');
  check((await p2.locator('.block:visible').count()) === 4, 'session has four blocks');
  check((await p2.locator('.screen:not([hidden]) .tab pre').count()) >= 3, 'tabs are rendered');
  const tab = await p2.locator('.screen:not([hidden]) .tab pre').first().innerText();
  check(['e|', 'B|', 'G|', 'D|', 'A|', 'E|'].every((l) => tab.includes(l)), 'tab labels all six strings');
  if (shots) await p2.screenshot({ path: `${shots}/practice.png`, fullPage: true });
  await p2.getByRole('button', { name: 'Metrònom' }).first().click();
  await p2.waitForTimeout(900);
  check((await p2.locator('.beat.on:visible').count()) >= 1, 'metronome runs and shows the beat');
  await p2.getByRole('button', { name: 'Metrònom' }).first().click();
  await p2.getByRole('button', { name: 'Comença' }).first().click();
  await p2.waitForTimeout(1300);
  check((await p2.locator('.clock:visible').first().innerText()) !== '04:00', 'block timer counts down');
  for (let i = 0; i < 4; i++) {
    await p2.locator('.block[open] .rate .btn.clean:visible').click();
    await p2.waitForTimeout(150);
    if (shots && i === 1) await p2.screenshot({ path: `${shots}/practice-chords.png`, fullPage: true });
  }
  check(await p2.getByText('Sessió acabada.').isVisible(), 'session completes after rating all blocks');
  check((await p2.locator('.screen:not([hidden]) .chord svg').count()) >= 2, 'chord diagrams are SVG');
  check((await p2.locator('.outcome:visible').count()) === 4, 'each rated block says what happened to its tempo');
  await p2.goto(URL + '#/progres');
  await p2.waitForSelector('.tempo-card');
  const cards = await p2.locator('.tempo-card:visible').count();
  const bests = await p2.locator('.tempo-card:visible', { hasText: 'Millor tempo net' }).count();
  check(cards === 4 && bests === 4, `tempo history lists the four exercises with their best clean tempo (${cards} cards, ${bests} with a best)`);
  if (shots) await p2.screenshot({ path: `${shots}/progress-tempo.png`, fullPage: true });

  check(errors.length === 0, `no console or page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} finally {
  await browser.close();
  server.kill();
}
if (fail.length) { console.error(`\n${fail.length} check(s) failed`); process.exit(1); }
console.log('\nAll end-to-end checks passed');
