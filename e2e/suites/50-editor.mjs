import { readFileSync } from 'node:fs';
import { B, OUT, FIXTURES, ok, newPage, login, api, j, finish } from '../lib.mjs';

const OLD = `# Nguồn gốc

Dòng họ **Nguyễn** ở _Hà Tĩnh_, xem [gia phả](https://example.com/gp).

- một
- hai

1. x
2. y

> Uống nước nhớ nguồn

---

Cuối bài: 2\\*3\\*4 và snake\\_case.`;

for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 800, 'phone']]) {
  const page = await newPage({ width: w, height: h });
  await login(page, 'admin@example.com');
  const created = await j(await api(page, 'POST', '/articles', { title: `Bài thử ${label}`, kind: 'origin', status: 'published', pinned: false, body: OLD, cover_media_id: null, member_ids: [] }));
  const id = created.id;
  await api(page, 'POST', `/articles/${id}/media`, undefined).catch(() => {});
  // a photo for the article
  const up = await page.request.post(B + `/api/articles/${id}/media`, { multipart: { file: { name: 'anh1.png', mimeType: 'image/png', buffer: readFileSync(FIXTURES + '/anh1.png') } } });
  const photo = await up.json();

  await page.goto(B + `/su-ky?sua=${id}`, { waitUntil: 'networkidle' });
  const surface = page.getByRole('textbox', { name: 'Nội dung bài' });
  await surface.waitFor({ timeout: 15000 });
  ok(`${label}: no Markdown textarea, no raw markers visible`, (await page.locator('textarea').count()) === 0 && !(await surface.innerText()).includes('**'));
  ok(`${label}: opens as formatted text (heading, list, quote)`, (await surface.locator('h1').count()) === 1 && (await surface.locator('ul li').count()) === 2 && (await surface.locator('blockquote').count()) === 1);
  ok(`${label}: escaped characters show literally`, (await surface.innerText()).includes('2*3*4 và snake_case'));

  // save without edits: body unchanged for the reader
  const before = (await j(await api(page, 'GET', `/articles/${id}`))).body;
  const save = page.getByRole('button', { name: 'Lưu bài' });
  await save.evaluate((b) => b.scrollIntoView({ block: 'center' }));
  await save.click();
  await page.waitForURL(/\/su-ky\/.+/, { timeout: 15000 });
  const after = (await j(await api(page, 'GET', `/articles/${id}`))).body;
  ok(`${label}: saving unedited text keeps the body (same text for the reader)`, after.replace(/\s+/g, ' ').includes('Dòng họ **Nguyễn** ở _Hà Tĩnh_') && after.includes('2\\*3\\*4') && after.includes('> Uống nước nhớ nguồn'), JSON.stringify({ before: before.slice(0, 60), after: after.slice(0, 120) }));

  // edit: select a word, press bold
  await page.goto(B + `/su-ky?sua=${id}`, { waitUntil: 'networkidle' });
  await surface.waitFor();
  const toolbar = page.getByRole('toolbar', { name: 'Định dạng bài viết' });
  ok(`${label}: toolbar buttons have names and are ≥ 44px`, await toolbar.evaluate((t) => [...t.querySelectorAll('button')].every((b) => b.getAttribute('aria-label') && b.getBoundingClientRect().width >= 43.5 && b.getBoundingClientRect().height >= 43.5)));
  const p = surface.locator('p').filter({ hasText: 'Cuối bài' });
  await p.dblclick({ position: { x: 20, y: 10 } }); // selects a word ("Cuối")
  await toolbar.getByRole('button', { name: 'In đậm' }).click();
  ok(`${label}: bold shows as pressed on the selection`, (await toolbar.getByRole('button', { name: 'In đậm' }).getAttribute('aria-pressed')) === 'true');
  ok(`${label}: the word became bold`, (await p.locator('strong').count()) === 1);
  await toolbar.getByRole('button', { name: 'Danh sách chấm' }).click();
  ok(`${label}: list button turns the paragraph into a bullet`, (await surface.locator('ul li').count()) === 3);
  await toolbar.getByRole('button', { name: 'Danh sách chấm' }).click();
  await surface.locator('p').filter({ hasText: 'Cuối bài' }).click();
  await toolbar.getByRole('button', { name: 'Tiêu đề nhỏ' }).click();
  ok(`${label}: small heading`, (await surface.locator('h3').count()) === 1);
  await toolbar.getByRole('button', { name: 'Hoàn tác' }).click();
  ok(`${label}: undo`, (await surface.locator('h3').count()) === 0);
  await toolbar.getByRole('button', { name: 'Làm lại' }).click();
  ok(`${label}: redo`, (await surface.locator('h3').count()) === 1);
  await toolbar.getByRole('button', { name: 'Đoạn văn thường' }).click();

  // link via dialog on a selection
  await surface.locator('p').filter({ hasText: 'Cuối bài' }).dblclick({ position: { x: 60, y: 10 } });
  await toolbar.getByRole('button', { name: 'Chèn link' }).click();
  const dlg = page.getByRole('dialog', { name: 'Chèn link' });
  await dlg.getByLabel('Địa chỉ link').fill('javascript:alert(1)');
  await dlg.getByRole('button', { name: 'Áp dụng' }).click();
  ok(`${label}: a javascript: address is refused`, (await dlg.getByRole('alert').count()) === 1);
  await dlg.getByLabel('Địa chỉ link').fill('example.org');
  await dlg.getByRole('button', { name: 'Áp dụng' }).click();
  ok(`${label}: link applied`, (await surface.locator('a[href="https://example.org"]').count()) === 1);
  await surface.locator('p').filter({ hasText: 'Cuối' }).click();
  await page.keyboard.press('End'); // collapse the selection so the photo does not replace the linked word

  // image from the picker
  await toolbar.getByRole('button', { name: 'Chèn ảnh' }).click();
  await page.getByRole('dialog', { name: 'Chèn ảnh' }).getByRole('button', { name: /^Chèn ảnh/ }).first().click();
  await page.waitForTimeout(500);
  ok(`${label}: image inserted and shown`, (await surface.locator(`img[data-media="media:${photo.id}"]`).count()) === 1 && (await surface.locator('img.rich-image').first().getAttribute('src')) !== '');

  // preview toggle
  await page.getByRole('button', { name: 'Xem trước' }).click();
  ok(`${label}: preview shows the reader view`, (await page.getByLabel('Xem trước bài').locator('strong').count()) >= 1);
  await page.getByRole('button', { name: 'Quay lại soạn thảo' }).click();

  await page.screenshot({ path: `${OUT}/fb-p3-editor-${label}.png` });
  const save2 = page.getByRole('button', { name: 'Lưu bài' });
  await save2.evaluate((b) => b.scrollIntoView({ block: 'center' }));
  await save2.click();
  await page.waitForURL(/\/su-ky\/.+/, { timeout: 15000 });
  const saved = (await j(await api(page, 'GET', `/articles/${id}`))).body;
  ok(`${label}: saved Markdown has the new formatting`, saved.includes('**Cuối**') && saved.includes('[') && saved.includes('](https://example.org)') && saved.includes(`](media:${photo.id})`), saved.slice(-160));
  // reader page renders it (give the article a moment to load)
  await page.locator('strong', { hasText: 'Cuối' }).first().waitFor({ timeout: 10000 }).catch(() => undefined);
  ok(`${label}: reader shows the bold word and the link`, (await page.locator('strong', { hasText: 'Cuối' }).count()) >= 1 && (await page.locator('a[href="https://example.org"]').count()) >= 1);
  await page.context().close();
}
await finish();
