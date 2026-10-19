// Shared helpers of the browser suites. Each suite is its own node process: `node suites/NN-name.mjs`; exit code 1 when a check failed.
import { chromium } from 'playwright-core';
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const B = process.env.E2E_WEB ?? 'http://127.0.0.1:3101';
export const OUT = join(HERE, 'out');
export const FIXTURES = join(HERE, 'fixtures');
mkdirSync(OUT, { recursive: true });

let failed = 0;
export const ok = (name, cond, extra = '') => {
  if (!cond) failed++;
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''));
};
export const errors = [];

function chromePath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = join(process.env.HOME ?? '', '.cache/ms-playwright');
  if (existsSync(root)) {
    for (const dir of readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      const path = join(root, dir, 'chrome-linux64/chrome');
      if (existsSync(path)) return path;
    }
  }
  return undefined; // let playwright-core look for its own browser (npx playwright-core install chromium)
}

export const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });

/** The accounts and ids `seed.mjs` made (e2e/state.json). */
export function state() {
  return JSON.parse(readFileSync(join(HERE, 'state.json'), 'utf8'));
}

export async function newPage(viewport = { width: 1440, height: 900 }, colorScheme = 'light') {
  const page = await (await browser.newContext({ viewport, colorScheme, acceptDownloads: true })).newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300));
  });
  return page;
}

export async function login(page, email, password = 'password-123') {
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.locator('#email-address').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForTimeout(500);
}

export const api = (page, method, path, data, headers = {}) =>
  page.request.fetch(B + '/api' + path, { method, data, headers: { 'content-type': 'application/json', ...headers } });
export const j = (r) => r.json();

/** Node of the tree (from GET /members/tree) whose name contains `part`. */
export function findNode(node, part) {
  if (!node) return null;
  if (node.name.includes(part)) return node;
  for (const child of node.children ?? []) {
    const hit = findNode(child, part);
    if (hit) return hit;
  }
  return null;
}

export async function finish() {
  ok('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
}
