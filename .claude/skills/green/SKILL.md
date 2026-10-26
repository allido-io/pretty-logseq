---
name: green
model: sonnet
description: Finish a change the way this repo expects — install, run Biome + the type check (Lint & Format), Vitest with the coverage thresholds (Test), and the production build (Build), report results honestly, and fix only what changed this session. Use when wrapping up a task, before declaring work done, or when the user says "make it green" / "verify" / "is it ready". The `ticket` skill calls it for its baseline and its verify step. Never formats repo-wide.
---

# green — the finish loop

"Done" in this repo means the three checks `main`'s ruleset requires all pass: **Lint & Format,
Test, Build** (strict: the branch must also be up to date with `main`). This skill runs the same
commands locally, scoped to what changed, and reports the truth.

**Use absolute paths.** The shell's working directory does not persist between `Bash` calls, and
in a worktree a command run from the main checkout tests the wrong tree.

## Steps

1. **Scope it.** `git status --short` and `git diff --name-only origin/main...HEAD` to see what
   changed. Sort it:
   - **plugin source** — `src/**/*.ts`. Note the **edition** each file serves: `*.v2.ts`,
     `src/core/platform/v2.ts` and `src/lib/api.v2.ts` are v2-only; `v1.ts` files are v1-only;
     everything else is shared by both editions.
   - **styles** — `src/**/*.scss` (`styles.v2.scss` is v2-only).
   - **tests** — `*.test.ts`, `test/**`
   - **infra** — `.github/**`, `vite.config.ts`, `vitest.config.ts`, `biome.json`,
     `tsconfig.json`, `package.json`, `pnpm-lock.yaml`, `manifest.json`, `index.html`
   - **tooling** — `.claude/**`, `CLAUDE.md`, `README.md` and other markdown. Biome only checks
     `*.ts`, `*.js` and `*.json`, so no check reads these; say so rather than claiming green.
     `.mcp.json` is JSON, so Biome does check it.

2. **Run the checks** (each maps to a required CI job):

   ```bash
   pnpm install --frozen-lockfile   # unconditionally — a fresh worktree has no node_modules, and a
                                    # half-finished install gives false reds
   pnpm check:ci                    # Lint & Format (1/2) — Biome, read-only
   pnpm typecheck                   # Lint & Format (2/2) — tsc --noEmit
   pnpm test:coverage               # Test — Vitest (jsdom) + the thresholds in vitest.config.ts
   pnpm build                       # Build — vite build → dist/
   ```

   For a quick inner loop, run `pnpm vitest run <files>` on the tests you touched; run the full
   `pnpm test:coverage` before declaring done.

   **Style changes need the build.** Vitest does not compile SCSS: a feature's
   `import styles from './styles.scss?inline'` loads in tests even when the file has a syntax error
   (probed 2026-10-26). An unclosed brace or a bad `@use` in a `.scss` file fails `pnpm build` and
   nowhere else locally.

3. **Check both editions were exercised.** Tests pick an edition with `setVersionForTest()` /
   `setPlatformForTest()`. If you changed shared code, the v1 *and* v2 tests for that feature must
   run and pass. If you changed v2-only code, v1's tests must still pass **unchanged** — v2 is
   additive and must never regress v1 (CLAUDE.md §Cross-Version Support).

4. **Know what green can't tell you.** jsdom is not Logseq. Whether a selector matches the real app,
   or a style looks right in a light and a dark theme, is a manual check in Logseq (the `ticket`
   skill's UI step covers it). For a UI change, say plainly that green covers the logic, not the
   rendering.

5. **Fix only what you changed.** If a check fails on code introduced this session, fix it. Don't
   "fix" a failure in untouched files — surface it and ask. A red check on a pristine checkout of
   `origin/main` is almost always this machine (a partial install), because `main` can't merge red:
   all three checks are required, with the strict up-to-date policy.

6. **Report honestly.** Give each command and its result. If something failed, quote the output.
   If you skipped a step — a tooling-only change no check covers, no style change so the build
   proves less — say which and why. Never claim green on a typecheck-only pass, and a test that
   only typechecks is not a test that passes: run it.

## Guardrails

- **Never run `pnpm check`.** It is `biome check --write .` and rewrites the whole repo. Format
  only the files you touched: `pnpm exec biome check --write <files>`.
- Don't commit build or test output (`dist/` and `coverage/` are ignored; keep it that way).
- The `rtk` Bash hook can return cached output, so a check can report a stale pass right after a
  breaking edit. Confirm a suspicious pass with `rtk proxy <cmd>`.
- Piping a command hides its exit code (`cmd | tail` always succeeds). Read the real status.

## Note on naming

This is `green` — "do the checks pass". Whether the change actually looks and behaves right inside
Logseq is a separate question that only the running app can answer.
