// The platform owner sees ONE family at a time: the one in the header's switcher (the oldest by default), and the header says which.
import { B, ok, newPage, login, api, j, finish, state } from '../lib.mjs';
const S = state();
const p = await newPage({ width: 1440, height: 900 });
await login(p, S.accounts.root);

async function look(path) {
  await p.goto(B + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const comp = await j(await api(p, 'GET', '/members/completeness'));
  const head = await p.locator('header p.font-display').innerText();
  const switcher = (await p.getByLabel('Chọn họ để xem và quản lý').count()) ? await p.getByLabel('Chọn họ để xem và quản lý').evaluate((s) => s.options[s.selectedIndex].text) : null;
  return { total: comp.total, head, switcher };
}
let v = await look('/nhap-lieu');
ok('by default the oldest family, named in the header', v.head === 'Họ Nguyễn' && v.switcher === 'Họ Nguyễn' && v.total >= 10, JSON.stringify(v));
await p.context().addCookies([{ name: 'acting_tree', value: String(S.trees.b), url: B }]);
v = await look('/nhap-lieu');
ok('after switching, the other family: its data and its name', v.head === 'Họ Trần' && v.switcher === 'Họ Trần' && v.total === 3, JSON.stringify(v));
await p.context().addCookies([{ name: 'acting_tree', value: '99999', url: B }]);
v = await look('/nhap-lieu');
ok('an unknown family in the cookie falls back to the oldest', v.head === 'Họ Nguyễn', JSON.stringify(v));
await p.context().clearCookies();
await login(p, S.accounts.root);
for (const path of ['/he-thong', '/he-thong/ho', '/he-thong/nhat-ky', '/he-thong/he-thong']) {
  const r = await p.goto(B + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  ok(`console page ${path} renders`, r.status() === 200 && (await p.getByText('Application error').count()) === 0);
}
await finish();
