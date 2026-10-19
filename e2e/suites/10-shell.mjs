import { B, OUT, ok, newPage, login, api, j, finish } from '../lib.mjs';
const p = await newPage({ width: 1280, height: 800 });
await login(p, 'admin@example.com');
await p.goto(B + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const box = (loc) => loc.boundingBox();
// ---- header layout on the tree page
const name = await p.locator('header p.font-display').innerText();
ok('header shows the family name', name === 'Họ Nguyễn', name);
const search = await box(p.getByLabel('Tìm thành viên theo tên'));
const hb = await box(p.locator('header'));
const mid = search.x + search.width / 2;
ok('search is centred in the header', Math.abs(mid - (hb.x + hb.width / 2)) <= 2, JSON.stringify([mid, hb.x + hb.width / 2]));
const user = await box(p.locator('header').getByText('Admin Nguyễn', { exact: true }));
const bell = await box(p.getByRole('button', { name: /^Thông báo/ }));
const theme = await box(p.getByRole('button', { name: 'Đổi giao diện màu' }));
const out = await box(p.getByRole('button', { name: 'Đăng xuất' }));
ok('name+role sit just left of the three icons, which are in a row at the far right', user.x + user.width < bell.x && bell.x - (user.x + user.width) < 24 && bell.x < theme.x && theme.x < out.x && out.x + out.width > 1250 && Math.abs(bell.y - out.y) < 2, JSON.stringify([user, bell, theme, out].map((b) => Math.round(b.x))));
// the family name is the same on every page and no page title replaces it
for (const path of ['/lich', '/nhap-lieu', '/su-ky', '/admin', '/nhat-ky', '/thong-ke']) {
  await p.goto(B + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok(`${path}: header still says the family name`, (await p.locator('header p.font-display').innerText()) === 'Họ Nguyễn');
  ok(`${path}: exactly one h1 (the page's own)`, (await p.locator('h1').count()) === 1);
}
// ---- popovers close when pressing outside
await p.goto(B + '/lich', { waitUntil: 'networkidle' });
const themeBtn = p.getByRole('button', { name: 'Đổi giao diện màu' });
await themeBtn.click();
ok('theme menu opens, button highlighted (aria-expanded)', (await themeBtn.getAttribute('aria-expanded')) === 'true' && (await p.getByRole('button', { name: /Di sản/ }).count()) === 1);
await p.mouse.click(600, 500);
ok('pressing outside closes the theme menu', (await p.getByRole('button', { name: /Di sản/ }).count()) === 0);
await themeBtn.click(); await themeBtn.click();
ok('pressing the icon again still toggles it', (await p.getByRole('button', { name: /Di sản/ }).count()) === 0);
await themeBtn.click(); await p.keyboard.press('Escape');
ok('Esc closes it too', (await p.getByRole('button', { name: /Di sản/ }).count()) === 0);
const bellBtn = p.getByRole('button', { name: /^Thông báo/ });
await bellBtn.click();
ok('bell opens', (await p.getByRole('dialog', { name: 'Thông báo' }).count()) === 1);
await themeBtn.click();
ok('opening the theme menu closes the bell list (pressing outside it)', (await p.getByRole('dialog', { name: 'Thông báo' }).count()) === 0);
await p.keyboard.press('Escape');
// ---- hover on the bell like the others
const bg = async (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor);
await p.mouse.move(5, 5);
const before = await bg(bellBtn);
await bellBtn.hover();
const hovered = await bg(bellBtn);
await p.mouse.move(5, 5);
await themeBtn.hover();
const themeHover = await bg(themeBtn);
ok('bell has a hover background like the other icons', before !== hovered && hovered === themeHover, JSON.stringify([before, hovered, themeHover]));
// ---- current menu item is highlighted (gold bar + tint)
const cur = p.locator('aside nav a[aria-current="page"]').first();
const style = await cur.evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, shadow: getComputedStyle(e).boxShadow }));
ok('current menu item has the gold bar and tint', style.shadow !== 'none' && style.shadow.includes('rgb') && style.bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(style));
// ---- admin console structure
await p.goto(B + '/admin', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
const tiles = await p.locator('main a').allInnerTexts();
const labels = tiles.join(' | ');
ok('admin home no longer has Sao lưu / Nhật ký / Xuất bản tiles', !/Sao lưu|Xuất bản/.test(labels) && !tiles.some((t) => t.startsWith('Nhật ký')), labels.slice(0, 200));
ok('Link tile renamed', /Link lịch & thiệp mời/.test(labels));
ok('no "đăng ký" wording left', !/đăng ký/i.test(await p.locator('main').innerText()));
await p.goto(B + '/admin/nhat-ky?loai=security', { waitUntil: 'networkidle' });
ok('/admin/nhat-ky redirects to /nhat-ky keeping the query', p.url().endsWith('/nhat-ky?loai=security'), p.url());
await p.goto(B + '/admin/sao-luu', { waitUntil: 'networkidle' });
ok('/admin/sao-luu goes back to the admin home', new URL(p.url()).pathname === '/admin');
// ---- audit: superadmin badge + actor filter
const root = await newPage();
await login(root, 'root@example.com');
const trees = await j(await api(root, 'GET', '/trees'));
const mine = trees.find((t) => t.name === 'Họ Nguyễn');
await root.request.fetch(B + '/api/members', { method: 'POST', data: { full_name: 'Do hệ thống thêm' }, headers: { 'content-type': 'application/json', 'X-Tree-Id': String(mine.id) } });
await p.goto(B + '/nhat-ky', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
ok('log shows the "Quản trị hệ thống" badge on the superadmin\'s entries', (await p.locator('ol > li').filter({ hasText: 'Root' }).filter({ hasText: 'Quản trị hệ thống' }).count()) >= 1);
const sel = p.getByLabel('Người thực hiện');
ok('"Người thực hiện" filter lists the actors', (await sel.locator('option').count()) >= 2 && (await sel.locator('option', { hasText: 'Root (Quản trị hệ thống)' }).count()) === 1);
await sel.selectOption({ label: 'Root (Quản trị hệ thống)' });
await p.waitForTimeout(800);
const rows = await p.locator('ol > li').allInnerTexts();
ok('filtering by actor shows only that person', rows.length > 0 && rows.every((t) => t.includes('Root')), String(rows.length));
await p.screenshot({ path: OUT + '/sh-audit.png' });
// ---- phone
const ph = await newPage({ width: 390, height: 844 });
await login(ph, 'admin@example.com');
await ph.goto(B + '/', { waitUntil: 'networkidle' });
await ph.waitForTimeout(1000);
await ph.screenshot({ path: OUT + '/sh-phone.png', clip: { x: 0, y: 0, width: 390, height: 260 } });
ok('phone: no horizontal scroll', await ph.evaluate(() => document.body.scrollWidth <= window.innerWidth));
ok('phone: name, search (own row) and the icons all visible', (await ph.locator('header p.font-display').isVisible()) && (await ph.getByLabel('Tìm thành viên theo tên').isVisible()) && (await ph.getByRole('button', { name: 'Đăng xuất' }).isVisible()));
await finish();
