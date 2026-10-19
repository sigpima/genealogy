import { B, OUT, ok, newPage, login, api, j, finish } from '../lib.mjs';
const LINK = 'https://www.google.com/maps/place/Nghia+trang/@21.0285,105.8542,15z';
const SHORT = 'https://maps.app.goo.gl/AbCd123';
for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 800, 'phone']]) {
  const page = await newPage({ width: w, height: h });
  await login(page, 'admin@example.com');
  const t = await j(await api(page, 'GET', '/members/tree'));
  await api(page, 'PATCH', `/members/${t.id}`, { burial_map_url: null, burial_latitude: null, burial_longitude: null });
  await page.goto(B + `/?focus=${t.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Nguyễn Tổ/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('tab', { name: 'Tiểu sử' }).click();
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  ok(`${label}: no lat/lng inputs`, (await page.getByText('Vĩ độ mộ').count()) === 0 && (await page.getByText('Kinh độ mộ').count()) === 0);
  const field = page.getByLabel('Link Google Maps của mộ');
  ok(`${label}: link field is type=url`, (await field.getAttribute('type')) === 'url');
  await field.fill('http://evil.com');
  ok(`${label}: inline error for a bad link`, (await page.getByText('Đây chưa phải link Google Maps').count()) === 1);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(600);
  ok(`${label}: bad link not saved`, (await page.getByText('Link bản đồ phải là link Google Maps').count()) >= 1);
  await field.fill(LINK);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(1200);
  const m = await j(await api(page, 'GET', `/members/${t.id}`));
  ok(`${label}: saved with coordinates from the link`, m.burial_map_url === LINK && m.burial_latitude === 21.0285, JSON.stringify([m.burial_map_url, m.burial_latitude]));
  const view = page.getByRole('link', { name: 'Xem trên bản đồ' });
  ok(`${label}: "Xem trên bản đồ" opens the link safely`, (await view.getAttribute('href')) === LINK && (await view.getAttribute('rel')).includes('noopener'));
  // short link keeps coordinates
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  await field.fill(SHORT);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(1200);
  const m2 = await j(await api(page, 'GET', `/members/${t.id}`));
  ok(`${label}: short link stored, coordinates kept`, m2.burial_map_url === SHORT && m2.burial_latitude === 21.0285, JSON.stringify([m2.burial_map_url, m2.burial_latitude]));
  await page.screenshot({ path: `${OUT}/fb-p2-map-${label}.png` });
  // clear
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  await field.fill('');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(1200);
  const m3 = await j(await api(page, 'GET', `/members/${t.id}`));
  ok(`${label}: clearing the link clears the position`, m3.burial_map_url === null && m3.burial_latitude === null);
  // old coordinate-only person still has a link
  await api(page, 'PATCH', `/members/${t.id}`, { burial_latitude: 10.5, burial_longitude: 106.5 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Nguyễn Tổ/ }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('tab', { name: 'Tiểu sử' }).click();
  ok(`${label}: old coordinates still give a map link`, (await page.getByRole('link', { name: 'Xem trên bản đồ' }).getAttribute('href')) === 'https://www.google.com/maps?q=10.5,106.5');
  await page.context().close();
}
// places form
const p = await newPage();
await login(p, 'admin@example.com');
await p.goto(B + '/dia-diem', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Thêm địa điểm/ }).first().click();
ok('place form: no lat/lng inputs', (await p.getByLabel('Vĩ độ').count()) === 0);
await p.getByLabel('Tên').first().fill('Mộ thử bản đồ').catch(() => {});
await p.screenshot({ path: `${OUT}/fb-p2-places-form.png` });
await finish();
