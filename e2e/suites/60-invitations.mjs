// Invitation links: one-time link per person, the invite page, linking an account to a person, "Đây là tôi", "Xem với tôi".
import { B, OUT, ok, newPage, login, api, j, finish, state } from '../lib.mjs';
const S = state();

const admin = await newPage({ width: 1280, height: 900 });
await login(admin, S.accounts.admin);
const tree = await j(await api(admin, 'GET', '/members/tree'));
const bacId = S.people.bac;
const mineId = (await j(await api(admin, 'POST', '/members', { full_name: 'Nguyễn Văn Admin', parent_id: tree.id }))).id;

// the admin invites a person
await admin.goto(B + `/?focus=${bacId}`, { waitUntil: 'networkidle' });
await admin.waitForTimeout(1500);
await admin.getByRole('button', { name: /Nguyễn Văn Bác/ }).first().click();
await admin.waitForTimeout(1000);
await admin.getByRole('button', { name: 'Mời người này' }).click();
const dlg = admin.getByRole('dialog', { name: 'Mời người này' });
await dlg.getByLabel('Link mời').waitFor({ timeout: 10000 });
const link = await dlg.getByLabel('Link mời').inputValue();
ok('the dialog shows an invitation link once', /\/moi\/[\w-]{30,}$/.test(link), link);
ok('copy button or select-all fallback is offered', (await dlg.getByRole('button', { name: /Sao chép/ }).count()) === 1);
await admin.screenshot({ path: `${OUT}/invite-dialog.png` });
await dlg.getByRole('button', { name: 'Đóng' }).click();

// the relative opens it in their own browser
const relative = await newPage({ width: 390, height: 800 });
await relative.goto(link, { waitUntil: 'networkidle' });
ok('invite page greets with family and person', (await relative.getByText('Họ Nguyễn').count()) >= 1 && (await relative.getByText('Nguyễn Văn Bác').count()) >= 1);
ok('invite page is outside the app shell (no sidebar)', (await relative.getByRole('link', { name: 'Sử ký' }).count()) === 0);
await relative.getByLabel('Email').fill('bac@example.com');
await relative.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-moi-1');
await relative.getByLabel('Nhập lại mật khẩu').fill('khac-nhau-123');
await relative.getByRole('button', { name: /Tạo tài khoản/ }).click();
ok('mismatching passwords are caught', (await relative.getByText('Hai mật khẩu chưa giống nhau').count()) === 1);
await relative.getByLabel('Nhập lại mật khẩu').fill('mat-khau-moi-1');
await relative.getByRole('button', { name: /Tạo tài khoản/ }).click();
await relative.waitForURL((u) => !u.pathname.startsWith('/moi'), { timeout: 15000 });
await relative.waitForTimeout(2500);
ok('after accepting, lands on the tree', new URL(relative.url()).pathname === '/', relative.url());
const me = await j(await api(relative, 'GET', '/auth/me'));
ok('the new account is an active member linked to the invited person', me.role === 'member' && me.member?.id === bacId && me.status === 'active', JSON.stringify(me.member));
await relative.setViewportSize({ width: 1440, height: 800 });
await relative.reload({ waitUntil: 'networkidle' });
await relative.waitForTimeout(1500);
ok('header shows the profile link', (await relative.locator('header a[title="Hồ sơ của tôi"]').count()) === 1);
ok('a member sees no invite/link buttons', (await relative.getByRole('button', { name: 'Mời người này' }).count()) === 0);

// the same link again, as a stranger
const stranger = await newPage();
await stranger.goto(link, { waitUntil: 'networkidle' });
ok('a used link says it is no longer valid', (await stranger.getByText('không còn hiệu lực').count()) >= 1);
ok('...and shows no form', (await stranger.getByRole('button', { name: /Tạo tài khoản/ }).count()) === 0);

// the admin sees it used, makes another and revokes it
await admin.goto(B + '/admin/nguoi-dung', { waitUntil: 'networkidle' });
await admin.waitForTimeout(1000);
ok('admin list shows the link as used by that e-mail', (await admin.getByText('Đã dùng').count()) >= 1 && (await admin.getByText('bac@example.com').count()) >= 1);
ok('a second link can be made for another person', (await api(admin, 'POST', `/members/${mineId}/invitation`)).status() === 201);
await admin.reload({ waitUntil: 'networkidle' });
await admin.waitForTimeout(800);
await admin.getByRole('button', { name: 'Thu hồi' }).click();
await admin.getByRole('dialog', { name: 'Thu hồi lời mời?' }).getByRole('button', { name: 'Thu hồi' }).click();
await admin.waitForTimeout(800);
ok('revoked link is listed as revoked', (await admin.getByText('Đã thu hồi').count()) >= 1);

// the admin links themself ("Đây là tôi") and uses "Xem với tôi"
await admin.goto(B + `/?focus=${mineId}`, { waitUntil: 'networkidle' });
await admin.waitForTimeout(1500);
await admin.getByRole('button', { name: /Nguyễn Văn Admin/ }).first().click();
await admin.waitForTimeout(800);
await admin.getByRole('button', { name: 'Đây là tôi' }).click();
await admin.waitForTimeout(1500);
ok('"Đây là tôi" links the admin to the person, no approval', (await j(await api(admin, 'GET', '/auth/me'))).member?.id === mineId);
ok('the panel says "Đây là bạn"', (await admin.getByText('Đây là bạn').count()) >= 1);
await admin.goto(B + `/?focus=${bacId}`, { waitUntil: 'networkidle' });
await admin.waitForTimeout(1500);
await admin.getByRole('button', { name: /Nguyễn Văn Bác/ }).first().click();
await admin.waitForTimeout(800);
await admin.getByRole('button', { name: 'Xem quan hệ họ hàng…' }).click();
await admin.getByRole('button', { name: /Xem với tôi/ }).click();
await admin.waitForTimeout(1200);
ok('"Xem với tôi" shows the relationship', (await admin.getByLabel('Kết quả quan hệ').count()) === 1);
await admin.goto(B + '/admin/cai-dat', { waitUntil: 'networkidle' });
await admin.waitForTimeout(800);
ok('settings: no "Đăng ký tài khoản mới" block', (await admin.getByText('Đăng ký tài khoản mới').count()) === 0);
await finish();
