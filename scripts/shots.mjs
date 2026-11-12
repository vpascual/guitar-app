// Screenshots of specific puzzles and of a practice session, for visual audits. Usage: node scripts/shots.mjs <dir>
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const dir = process.argv[2] ?? 'shots';
mkdirSync(dir, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ ...devices['Pixel 5'] })).newPage();
  for (const [g, seed] of [['tap-characteristic', 3], ['chord-from-diagram', 5], ['meter-from-notation', 2], ['spread-triad', 4], ['roman-analysis', 6]]) {
    await page.goto(`http://localhost:4174/?g=${g}&seed=${seed}&level=1`);
    await page.waitForSelector('[data-testid=puzzle]');
    await page.screenshot({ path: `${dir}/${g}.png` });
    const opt = page.locator('.answers .option').first();
    if (await opt.count()) await opt.click(); else await page.locator('.fretboard .tap').nth(3).click();
    await page.waitForSelector('[data-testid=explanation]');
    const help = page.locator('summary', { hasText: 'Com es toca?' });
    if (await help.count()) await help.click();
    await page.screenshot({ path: `${dir}/${g}-after.png`, fullPage: true });
  }
} finally {
  await browser.close();
  server.kill();
}
