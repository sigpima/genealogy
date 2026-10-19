import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { B, OUT, FIXTURES, ok, newPage, login, api, j, finish, state } from '../lib.mjs';
const FX = FIXTURES + '/';
const BIG = OUT + '/big.jpg'; // 11 MB: over the 10 MB limit
writeFileSync(BIG, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), randomBytes(11 * 1024 * 1024)]));
const S = state();

for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 800, 'phone']]) {
  const page = await newPage({ width: w, height: h });
  await login(page, 'admin@example.com');
  const t = await j(await api(page, 'GET', '/members/tree'));
  // start clean: remove media of the root
  for (const m of await j(await api(page, 'GET', `/members/${t.id}/media`))) await api(page, 'DELETE', `/media/${m.id}`);
  await page.goto(B + `/?focus=${t.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Nguyễn Tổ/ }).first().click();
  await page.waitForTimeout(1000);
  const add = page.getByRole('button', { name: 'Thêm ảnh hoặc tài liệu' });
  await add.scrollIntoViewIfNeeded();
  ok(`${label}: upload button visible`, await add.isVisible());
  ok(`${label}: no bare file input visible`, (await page.locator('input[type=file]:visible').count()) === 0);
  ok(`${label}: an empty box for an admin has no long hint, just the upload button`, (await page.getByText('Ảnh, bản scan gia phả').count()) === 0 && (await page.getByRole('button', { name: 'Thêm ảnh hoặc tài liệu' }).count()) === 1);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), add.click()]);
  await chooser.setFiles([FX + 'anh1.png', BIG, FX + 'gia-pha.pdf', FX + 'anh2.png']);
  await page.waitForTimeout(2500);
  ok(`${label}: two photos listed`, (await page.getByRole('button', { name: /^Xem ảnh/ }).count()) === 2);
  ok(`${label}: one document listed`, (await page.getByRole('link', { name: /^Mở tài liệu/ }).count()) === 1);
  ok(`${label}: refused file named in an alert`, (await page.getByRole('alert').filter({ hasText: 'big.jpg' }).count()) >= 1);
  ok(`${label}: groups titled`, (await page.getByRole('heading', { name: /^Ảnh \(2\)/ }).count()) === 1 && (await page.getByRole('heading', { name: /^Tài liệu \(1\)/ }).count()) === 1);
  // cards do not overlap
  const cards = page.locator('section[aria-label="Ảnh"] li, section[aria-label="Tài liệu"] li');
  const boxes = [];
  for (let i = 0; i < (await cards.count()); i++) boxes.push(await cards.nth(i).boundingBox());
  let overlap = false;
  for (let i = 0; i < boxes.length; i++) for (let k = i + 1; k < boxes.length; k++) {
    const a = boxes[i], b = boxes[k];
    if (a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1) overlap = true;
  }
  ok(`${label}: cards do not overlap`, !overlap);
  ok(`${label}: no horizontal scroll`, await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: `${OUT}/fb-p2-media-${label}.png` });
  // menu: keyboard
  const menuBtn = page.getByRole('button', { name: /^Tuỳ chọn cho/ }).first();
  const mb = await menuBtn.boundingBox();
  ok(`${label}: ⋯ button ≥ 44`, mb.width >= 44 && mb.height >= 44);
  await menuBtn.focus(); await page.keyboard.press('Enter');
  ok(`${label}: menu opens with focus on first item`, await page.evaluate(() => document.activeElement?.textContent === 'Sửa chú thích'));
  await page.keyboard.press('ArrowDown');
  ok(`${label}: arrow moves to Xoá`, await page.evaluate(() => document.activeElement?.textContent === 'Xoá'));
  await page.keyboard.press('Escape');
  ok(`${label}: Esc closes menu only (panel still open)`, (await page.getByRole('menu').count()) === 0 && (await page.getByRole('complementary', { name: /Hồ sơ/ }).count()) === 1);
  // caption
  await menuBtn.click();
  await page.getByRole('menuitem', { name: 'Sửa chú thích' }).click();
  await page.getByLabel(/^Chú thích cho/).fill('Ảnh chân dung Tổ');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await page.waitForTimeout(800);
  ok(`${label}: caption saved`, (await page.getByText('Ảnh chân dung Tổ').count()) >= 1);
  // delete with confirmation
  await page.getByRole('button', { name: /^Tuỳ chọn cho/ }).first().click();
  await page.getByRole('menuitem', { name: 'Xoá' }).click();
  ok(`${label}: delete asks first`, (await page.getByRole('dialog', { name: 'Xoá tư liệu' }).count()) === 1);
  await page.keyboard.press('Escape');
  ok(`${label}: Esc cancels the confirmation`, (await page.getByRole('dialog', { name: 'Xoá tư liệu' }).count()) === 0 && (await page.getByRole('button', { name: /^Xem ảnh/ }).count()) === 2);
  await page.getByRole('button', { name: /^Tuỳ chọn cho/ }).first().click();
  await page.getByRole('menuitem', { name: 'Xoá' }).click();
  await page.getByRole('dialog', { name: 'Xoá tư liệu' }).getByRole('button', { name: 'Xoá' }).click();
  await page.waitForTimeout(800);
  ok(`${label}: one photo removed`, (await page.getByRole('button', { name: /^Xem ảnh/ }).count()) === 1);
  await page.context().close();
}

// member (non-admin) sees the grid without upload/menu
const adminPage = await newPage();
await login(adminPage, 'admin@example.com');
const stamp = Date.now().toString().slice(-5);
const created = await api(adminPage, 'POST', '/admin/users', { email: `tv${stamp}@example.com`, full_name: 'Thành viên', role: 'member', password: 'password-123' });
const pw = created.ok() ? 'password-123' : null;
console.log('member created', created.status(), pw ? 'pw' : 'no pw');
if (pw) {
  const m = await newPage();
  await login(m, `tv${stamp}@example.com`, pw);
  const t = await j(await api(m, 'GET', '/members/tree'));
  await m.goto(B + `/?focus=${t.id}`, { waitUntil: 'networkidle' });
  await m.waitForTimeout(1200);
  await m.getByRole('button', { name: /Nguyễn Tổ/ }).first().click();
  await m.waitForTimeout(1000);
  ok('member: no upload button', (await m.getByRole('button', { name: 'Thêm ảnh hoặc tài liệu' }).count()) === 0);
  ok('member: no ⋯ menu', (await m.getByRole('button', { name: /^Tuỳ chọn cho/ }).count()) === 0);
  ok('member: still sees the photo', (await m.getByRole('button', { name: /^Xem ảnh/ }).count()) >= 1);
}
await finish();
