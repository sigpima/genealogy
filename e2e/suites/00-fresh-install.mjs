// A fresh install: only the platform owner exists (made with the command line). No public sign-up door, and the owner lands on the console.
import { B, ok, newPage, login, finish } from '../lib.mjs';

const guest = await newPage();
await guest.goto(B + '/login', { waitUntil: 'networkidle' });
ok('login page has no Signup link', (await guest.getByRole('link', { name: /signup/i }).count()) === 0 && !(await guest.content()).includes('/signup'));
ok('forgot-password link is still there', (await guest.getByRole('link', { name: /forgot/i }).count()) >= 1);
ok('/signup is gone (404)', (await guest.goto(B + '/signup')).status() === 404);
const reg = await guest.request.post(B + '/api/auth/register', { data: { email: 'x@example.com', password: 'longenough1', full_name: 'X' } });
ok('there is no register endpoint', [404, 405].includes(reg.status()), String(reg.status()));
ok('nor a bootstrap one', [404, 405].includes((await guest.request.get(B + '/api/auth/bootstrap')).status()));

const root = await newPage();
await login(root, 'root@example.com');
await root.goto(B + '/', { waitUntil: 'networkidle' });
await root.waitForTimeout(1500);
ok('the owner with no family yet lands on /he-thong', root.url().includes('/he-thong'), root.url());
ok('...and sees no raw error', (await root.getByText('Không thể tải dữ liệu').count()) === 0);
await finish();
