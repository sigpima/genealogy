import { B, OUT, ok, newPage, login, api, j, finish } from '../lib.mjs';
const admin = await newPage({ width: 1280, height: 950 });
await login(admin, 'admin@example.com');
const tree = await j(await api(admin, 'GET', '/members/tree'));
const mid = tree.children.find((c) => c.name.includes('Hai'));
const leafNode = tree.children.find((c) => c.name.includes('Lá'));
async function open(p, node) {
  await p.goto(B + `/?focus=${node.id}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: new RegExp(node.name) }).first().click();
  await p.waitForTimeout(1000);
}
await open(admin, mid);
const panel = admin.getByRole('complementary', { name: /Hồ sơ/ });
ok('no title/courtesy line under the name', (await panel.locator('h2 + p').filter({ hasText: /Tự:|Tiến sĩ/ }).count()) === 0);
ok('no "＋ Thêm vợ/chồng" / "＋ Thêm con" at the top', (await panel.getByRole('button', { name: /＋ Thêm/ }).count()) === 0);
const heads = await panel.locator('section h3').allInnerTexts();
ok('headers in order', JSON.stringify(heads) === JSON.stringify(['Thông tin', 'Hành trạng & công đức', 'Tư liệu & bút tích', 'Họ hàng']), JSON.stringify(heads));
const tiles = await Promise.all(['Lịch sử', 'Sửa', 'Mời người này'].map(async (n) => (await panel.getByRole(n === 'Lịch sử' ? 'link' : 'button', { name: n }).first().boundingBox())));
ok('three action tiles on one row', tiles.every((b) => b && Math.abs(b.y - tiles[0].y) < 2) && tiles[0].x < tiles[1].x && tiles[1].x < tiles[2].x, JSON.stringify(tiles.map((b) => b && [Math.round(b.x), Math.round(b.y)])));
ok('tiles are ≥ 44px tall', tiles.every((b) => b.height >= 44));
const close = await panel.getByRole('button', { name: 'Đóng' }).boundingBox();
ok('close is a bordered button ≥ 44px', close.height >= 44 && close.width >= 60);
ok('old text-only "Lịch sử"/"Sửa" next to Hành trạng are gone', (await panel.locator('section[aria-label="Hành trạng & công đức"] button, section[aria-label="Hành trạng & công đức"] a').count()) === 0);
ok('empty media: no long hint', (await panel.getByText('Ảnh, bản scan gia phả').count()) === 0);
const up = await panel.getByRole('button', { name: 'Thêm ảnh hoặc tài liệu' }).boundingBox();
const box = await panel.locator('section[aria-label="Tư liệu và bút tích"] > div').boundingBox();
ok('upload button is small and centred in the tinted box', up.width < box.width - 60 && Math.abs((up.x + up.width / 2) - (box.x + box.width / 2)) < 4, JSON.stringify([up.width, box.width]));
// bottom row
const view = await panel.getByRole('button', { name: 'Xem riêng nhánh này' }).boundingBox();
const del = await panel.getByRole('button', { name: 'Xoá thành viên' }).boundingBox();
ok('"Xem riêng" left, "Xoá" right on one row', Math.abs(view.y - del.y) < 2 && view.x < del.x);
// family tab
await panel.getByRole('tab', { name: 'Hôn phối & con' }).click();
const n = await panel.getByLabel('Tên vợ/chồng mới').boundingBox();
const y = await panel.getByLabel('Năm cưới').boundingBox();
const add = await panel.getByRole('button', { name: 'Thêm', exact: true }).first().boundingBox();
ok('spouse: name, year and button on one row', Math.abs(n.y - y.y) < 3 && Math.abs(n.y - add.y) < 3 && n.x < y.x && y.x < add.x, JSON.stringify([n, y, add].map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.width)])));
ok('spouse year is short', y.width <= 100 && y.width < n.width);
await panel.getByLabel('Năm cưới').scrollIntoViewIfNeeded(); await admin.screenshot({ path: OUT + '/pp-family2.png' });
const child = await panel.getByLabel('Tên con mới').boundingBox();
const addChild = await panel.getByRole('button', { name: 'Thêm', exact: true }).nth(1).boundingBox();
ok('child row: button reads "Thêm" and shares the button column with the spouse row', Math.abs((addChild.x + addChild.width) - (add.x + add.width)) < 3 && Math.abs(addChild.width - add.width) < 3);
// leaf
await open(admin, leafNode);
ok('leaf: no "Xem riêng nhánh này"', (await admin.getByRole('button', { name: 'Xem riêng nhánh này' }).count()) === 0);
const delLeaf = await admin.getByRole('button', { name: 'Xoá thành viên' }).boundingBox();
ok('leaf: delete is on the right', delLeaf.x + delLeaf.width > 1240);
// member (non-admin) view
await api(admin, 'POST', '/admin/users', { email: `pp${Date.now().toString().slice(-5)}@example.com`, full_name: 'TV', role: 'member', password: 'password-123' });
const users = await j(await api(admin, 'GET', '/admin/users'));
const mem = users.find((u) => u.role === 'member' && u.email.startsWith('pp'));
const m = await newPage({ width: 1280, height: 900 });
await login(m, mem.email);
await open(m, mid);
const mp = m.getByRole('complementary', { name: /Hồ sơ/ });
ok('member: one "Đề xuất chỉnh sửa" tile, no Sửa/Mời/Xoá/Lịch sử', (await mp.getByRole('button', { name: 'Đề xuất chỉnh sửa' }).count()) === 1 && (await mp.getByRole('button', { name: /^Sửa$|Mời người này|Xoá thành viên/ }).count()) === 0 && (await mp.getByRole('link', { name: 'Lịch sử' }).count()) === 0);
ok('member: "Xem riêng nhánh này" still there for a person with children', (await mp.getByRole('button', { name: 'Xem riêng nhánh này' }).count()) === 1);
ok('member: empty media shows a short line, no upload', (await mp.getByText('Chưa có tư liệu.').count()) === 1 && (await mp.getByRole('button', { name: 'Thêm ảnh hoặc tài liệu' }).count()) === 0);
// sidebar dividers
const admin2 = await newPage({ width: 1280, height: 900 });
await login(admin2, 'admin@example.com');
const lines = await admin2.locator('aside nav ul').evaluateAll((uls) => uls.map((u) => getComputedStyle(u).borderTopWidth));
ok('sidebar: admin sees two sections, a line between them', lines.length === 2 && lines[0] === '0px' && lines[1] === '1px', JSON.stringify(lines));
const memSide = await m.locator('aside nav ul').count();
ok('sidebar: member sees one section only', memSide === 1);
const root = await newPage({ width: 1280, height: 900 });
await login(root, 'root@example.com');
await root.goto(B + '/nhap-lieu', { waitUntil: 'networkidle' });
ok('sidebar: superadmin sees three sections', (await root.locator('aside nav ul').count()) === 3);
// data entry: no missing chips
await admin2.goto(B + '/nhap-lieu', { waitUntil: 'networkidle' });
await admin2.waitForTimeout(800);
ok('data entry: the "Thiếu …" chips are gone', (await admin2.getByRole('button', { name: /^Thiếu |^Chưa có năm mất/ }).count()) === 0);
ok('data entry: the cards are still there', (await admin2.locator('section[aria-label="Mức độ đầy đủ"] > button').count()) === 5);
ok('data entry: search and generation filter remain', (await admin2.getByLabel('Tìm theo tên').count()) === 1 && (await admin2.getByLabel('Lọc theo đời').count()) === 1);
await finish();
