import { B, ok, browser, errors, login } from './lib.mjs';

const VIEWPORTS = [[375, 800], [768, 900], [1024, 800], [1440, 900]];
const THEMES = ['heritage', 'warm', 'modern', 'elegant'];

export async function themedPage(theme, [width, height]) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript((t) => localStorage.setItem('genealogy-web:theme', t), theme);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  return page;
}

export const audit = (scopeSel) => {
  const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = '#000'; canvas.fillStyle = css; canvas.fillRect(0, 0, 1, 1); const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255]; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const background = (el) => {
    let color = [255, 255, 255];
    const chain = [];
    for (let e = el; e; e = e.parentElement) chain.push(e);
    for (const e of chain.reverse()) { const [r, g, b, a] = rgba(getComputedStyle(e).backgroundColor); if (a > 0) color = color.map((c, i) => Math.round([r, g, b][i] * a + c * (1 - a))); }
    return color;
  };
  const main = (scopeSel && document.querySelector(scopeSel)) || document.querySelector('main') || document.body;
  const low = [];
  const seen = new Set();
  for (const el of main.querySelectorAll('*')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (!r.width || !r.height || style.visibility === 'hidden' || +style.opacity === 0 || el.closest('[aria-hidden="true"]')) continue;
    const [fr, fg, fb, fa] = rgba(style.color);
    const bg = background(el);
    const fgc = [fr, fg, fb].map((c, i) => Math.round(c * fa + bg[i] * (1 - fa)));
    const l1 = lum(fgc), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(style.fontSize);
    const need = px >= 24 || (px >= 18.66 && +style.fontWeight >= 700) ? 3 : 4.5;
    const key = el.textContent.trim().slice(0, 30) + ratio.toFixed(1);
    if (ratio < need && !seen.has(key) && !el.closest('[disabled]')) { seen.add(key); low.push(`${el.textContent.trim().slice(0, 40)} (${ratio.toFixed(2)} < ${need}, ${px}px)`); }
  }
  const small = [...main.querySelectorAll('a, button, input, select, textarea, [role=button]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 43.5 || r.width < 43.5) && !(e.tagName === 'INPUT' && ['checkbox', 'radio'].includes(e.type) && e.closest('label') && e.closest('label').getBoundingClientRect().height >= 43.5); }).map((e) => `${e.tagName} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
  return {
    fits: document.documentElement.scrollWidth <= window.innerWidth,
    h1: main.querySelectorAll('h1').length,
    low, small,
    smallText: [...main.querySelectorAll('p, li, span, label, a, button')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 14 && e.getBoundingClientRect().width).map((e) => e.textContent.trim().slice(0, 30)).slice(0, 5),
  };
};

/** pages: [{path, prepare?: async (page) => void}] */
export async function auditMatrix(email, pages, viewports = VIEWPORTS, themes = THEMES) {
  for (const theme of themes) {
    for (const vp of viewports) {
      const page = await themedPage(theme, vp);
      await login(page, email);
      for (const spec of pages) {
        await page.goto(B + spec.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        if (spec.prepare) await spec.prepare(page);
        for (const scope of spec.scopes ?? [undefined]) {
          const r = await page.evaluate(audit, scope);
          const fits = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
          const small = spec.ignoreSmall ? r.small.filter((x) => !spec.ignoreSmall.test(x)) : r.small;
          ok(`${theme} ${vp[0]}px ${spec.path} ${scope ?? 'main'}: fits, targets ≥ 44px, contrast ≥ 4.5:1`, fits && small.length === 0 && r.low.length === 0, JSON.stringify({ fits, small: small.slice(0, 4), low: r.low.slice(0, 4) }));
        }
      }
      await page.context().close();
    }
  }
}
