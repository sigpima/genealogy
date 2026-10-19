// Makes the data the suites rely on, through the API, as the platform owner (root@example.com, made by run.sh with the CLI).
// Two families, an admin in each, a member account, and a tree of 10 people in the first one. Writes e2e/state.json.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { B, newPage, login, api, j, finish, ok } from './lib.mjs';

const root = await newPage();
await login(root, 'root@example.com');
const as = (tree, method, path, data) => root.request.fetch(B + '/api' + path, { method, data, headers: { 'content-type': 'application/json', 'X-Tree-Id': String(tree.id) } });

const made = async (name, slug, email, adminName) => {
  const r = await api(root, 'POST', '/trees', { name, slug, admin_email: email, admin_name: adminName, admin_password: 'password-123' });
  ok(`family ${name} created`, r.ok(), String(r.status()));
  return (await j(r)).tree;
};
const a = await made('Họ Nguyễn', 'ho-nguyen', 'admin@example.com', 'Admin Nguyễn');
const b = await made('Họ Trần', 'ho-tran', 'admin-tran@example.com', 'Admin Trần');

const add = async (tree, body) => {
  const r = await as(tree, 'POST', '/members', body);
  if (!r.ok()) throw new Error(`member ${body.full_name}: ${r.status()} ${await r.text()}`);
  return (await j(r)).id;
};
const to = await add(a, { full_name: 'Nguyễn Tổ', gender: 'male', birth_year: 1750 });
const hai = await add(a, { full_name: 'Nguyễn Văn Hai', parent_id: to, gender: 'male', birth_year: 1780, title: 'Tiến sĩ', courtesy_name: 'Văn Hải', notes: 'Làm quan triều Nguyễn, có công khai khẩn đất.' });
let p = hai;
const chain = [];
for (const [i, name] of ['Nguyễn Văn Ba', 'Nguyễn Văn Tư', 'Nguyễn Văn Năm', 'Nguyễn Văn Sáu'].entries()) {
  p = await add(a, { full_name: name, parent_id: p, gender: 'male', birth_year: 1810 + i * 30 });
  chain.push(p);
}
const la = await add(a, { full_name: 'Nguyễn Văn Lá', parent_id: to, gender: 'male', birth_year: 1785 });
const hoa = await add(a, { full_name: 'Nguyễn Thị Hoa', parent_id: to, gender: 'female', birth_year: 1790 });
const bac = await add(a, { full_name: 'Nguyễn Văn Bác', parent_id: to, gender: 'male', birth_year: 1788 });
let q = await add(b, { full_name: 'Trần Tổ', gender: 'male' });
for (const name of ['Trần Văn Một', 'Trần Thị Hai']) q = await add(b, { full_name: name, parent_id: q });

const u = await as(a, 'POST', '/admin/users', { email: 'thanhvien@example.com', full_name: 'Thành Viên', role: 'member', password: 'password-123' });
ok('member account created', u.ok(), String(u.status()));

writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'state.json'),
  JSON.stringify({ trees: { a: a.id, b: b.id }, people: { to, hai, ba: chain[0], tu: chain[1], nam: chain[2], sau: chain[3], la, hoa, bac }, accounts: { root: 'root@example.com', admin: 'admin@example.com', adminB: 'admin-tran@example.com', member: 'thanhvien@example.com' }, password: 'password-123' }, null, 2),
);
await finish();
