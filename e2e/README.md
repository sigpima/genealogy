# Browser tests (e2e)

Real Chromium against the real stack — API, production build of the web app, a throwaway Postgres — never your compose stack or its data.

```bash
e2e/run.sh                  # everything (~5 min; builds the web app first)
e2e/run.sh editor           # only suites whose file name contains "editor"
E2E_SKIP_BUILD=1 e2e/run.sh # reuse the last build made by this script
E2E_AUDIT=full e2e/run.sh   # contrast/target audit on 4 themes x 4 widths (default: 2 x 2)
KEEP_STACK=1 e2e/run.sh     # leave web :3101, api :8101, db :55434 running to poke at
scripts/verify.sh           # api tests + web types/lint/unit tests + this
```

Needs docker, `genealogy-api/.venv` (`uv sync`), `npm i` in `genealogy-web` and a Chromium (Playwright's cache in `~/.cache/ms-playwright`, or `CHROMIUM_PATH`;
`npx playwright-core install chromium` fetches one). Don't run it while `npm run dev` is running in `genealogy-web` (both use `.next`).

How it works: `run.sh` starts the stack, makes the platform owner with the command line, runs `suites/00-fresh-install.mjs` (nothing exists yet),
then `seed.mjs` (two families, admins, a member, 10 people in the first → `state.json`), then every `suites/[1-9]*.mjs` in order as separate node processes.
Each prints `PASS`/`FAIL` lines and exits 1 on any failure. Screenshots and logs go to `e2e/out/` (git-ignored).

Writing a suite: copy a small one (`suites/21-search.mjs`), import from `../lib.mjs` (`newPage`, `login`, `api`, `ok`, `state()`, `finish()`), use the people in `state().people`.
Suites share one database in file order, so create what you mutate (unique names) and don't rely on counts that earlier suites change.
Not ported from the old throwaway scripts: the per-phase checks of the admin and superadmin consoles of 18/10 (their pages are covered by rendering checks in `10-shell`, `70-superadmin-view` and the audit matrix).
