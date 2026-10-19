// Contrast (≥ 4.5:1), touch targets (≥ 44 px) and no horizontal overflow, on the pages and dialogs we have redesigned.
// E2E_AUDIT=quick (default): 2 themes x 2 widths. E2E_AUDIT=full: 4 themes x 4 widths (several minutes).
import { B, newPage, login, api, j, finish, state } from '../lib.mjs';
import { auditMatrix } from '../audit-lib.mjs';
const S = state();
const full = process.env.E2E_AUDIT === 'full';
const themes = full ? ['heritage', 'warm', 'modern', 'elegant'] : ['heritage', 'elegant'];
const widths = full ? [[375, 800], [768, 900], [1024, 800], [1440, 900]] : [[375, 800], [1440, 900]];

const seed = await newPage();
await login(seed, S.accounts.admin);
const link = (await j(await api(seed, 'POST', `/members/${S.people.la}/invitation`))).path; // a fresh link for the invite page
const article = await j(await api(seed, 'POST', '/articles', { title: 'Bài kiểm tra', kind: 'origin', status: 'published', pinned: false, body: '# Tựa\n\nMột **đoạn** văn.', cover_media_id: null, member_ids: [] }));

const openPanel = async (p) => {
  // the tree takes a moment to draw and centre; retry once or twice before giving up
  for (let attempt = 0; attempt < 3; attempt++) {
    await p.goto(B + `/?focus=${S.people.hai}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    const card = p.getByRole('button', { name: /Nguyễn Văn Hai/ }).first();
    if (await card.waitFor({ state: 'attached', timeout: 8000 }).then(() => true, () => false)) {
      await card.dispatchEvent('click'); // a card can sit under the sidebar until the view is centred
      await p.waitForTimeout(900);
      return;
    }
  }
  throw new Error('the card of Nguyễn Văn Hai never appeared');
};
const panel = ['aside[aria-label^="Hồ sơ"]'];
const waitEditor = async (p) => { await p.getByRole('textbox', { name: 'Nội dung bài' }).waitFor(); await p.waitForTimeout(400); };

await auditMatrix(
  S.accounts.admin,
  [
    { path: '/lich', name: 'shell', scopes: ['header', 'aside'] },
    { path: '/lich', name: 'theme-menu-open', prepare: async (p) => { await p.getByRole('button', { name: 'Đổi giao diện màu' }).click(); await p.waitForTimeout(250); }, scopes: ['header'] },
    { path: '/nhat-ky', name: 'audit', scopes: ['main'] },
    { path: '/admin', name: 'admin-home', scopes: ['main'] },
    { path: '/admin/nguoi-dung', name: 'users+invitations', scopes: ['main'] },
    { path: '/nhap-lieu', name: 'data-entry-cards', scopes: ['section[aria-label="Mức độ đầy đủ"]', 'header'] },
    { path: '/', name: 'panel', prepare: openPanel, scopes: panel },
    { path: '/', name: 'panel-family', prepare: async (p) => { await openPanel(p); await p.getByRole('tab', { name: 'Hôn phối & con' }).click(); await p.waitForTimeout(300); }, scopes: panel },
    { path: '/', name: 'invite-dialog', prepare: async (p) => { await openPanel(p); await p.getByRole('button', { name: 'Mời người này' }).click(); await p.getByLabel('Link mời').waitFor(); }, scopes: ['[role=dialog][aria-label="Mời người này"]'] },
    { path: `/su-ky?sua=${article.id}`, name: 'editor', ignoreSmall: /^A "/, prepare: waitEditor, scopes: ['form[aria-label="Soạn bài"]'] },
    { path: `/su-ky?sua=${article.id}`, name: 'link-dialog', prepare: async (p) => { await waitEditor(p); await p.getByRole('button', { name: 'Chèn link' }).click(); await p.waitForTimeout(300); }, scopes: ['[role=dialog][aria-label="Chèn link"]'] },
    { path: link, name: 'invite-page', scopes: ['main'] },
  ],
  widths,
  themes,
);
await finish();
