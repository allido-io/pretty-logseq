# Review instructions for pretty-logseq

The Claude review (`.github/workflows/claude-review.yml`) reads this file from the base branch
and adds it to its prompt, so a PR cannot change the instructions it is reviewed under. It
replaced CodeRabbit. When a false-positive class keeps coming back, add a rule here instead of
answering it again on every PR.

## Tone

Readers are AI agents who must answer every comment. Report defects with a concrete failure
scenario. No praise, no speculative "consider" remarks, no style Biome enforces.

## Do not review

Generated or vendored files; skip them even when the diff touches them:

- `pnpm-lock.yaml`
- `dist/**`
- `CHANGELOG.md` (release-please writes it)

## Rules by path

Apply each section to changed files matching its glob.

### `src/**`

The plugin supports both Logseq editions, and v2 work is strictly additive: v1 behaviour must
never regress (CLAUDE.md, "Cross-Version Support"). Flag:
- A change to v1 behaviour, selectors or styles made for v2's sake. `src/core/platform/v1.ts` is
  the source of truth; `v2.ts` spreads it and overrides only differences confirmed against a real
  DB instance.
- Code that reads `logseq.settings` directly instead of `getSettings()`, or a new setting that is
  not added to both the schema and `PluginSettings` in `src/settings/schema.ts` and handled in
  `onSettingsChanged`.
- A feature that injects CSS other than through its `getStyles()` (all CSS goes through the single
  `logseq.provideStyle()` call in `src/core/styles.ts`), or whose `destroy()` leaves an observer,
  listener or timer behind.
- DOM work against the wrong document: popovers and observers run in Logseq's parent document
  (`getParentDoc`), not the plugin iframe.

### `src/lib/api.v2.ts`

The DB `Editor.getPage` returns namespaced, id-suffixed property keys whose values are entity ids.
`normalizeProperties` must produce the same flat `PageProperties` map the v1 path does, resolving
ids in one batched query. Flag per-id queries in a loop and any shape that differs from v1's.

### `vite.config.ts`, `package.json`, `manifest.json`

`package.json` `main` must stay `dist/index.html`, and `@logseq/libs` must stay bundled (not
external), or the plugin fails to load in Logseq.

### `**/*.test.ts`

Flag tests that would pass against the unfixed code, assert on mocks instead of behaviour, or
depend on wall-clock timing. Coverage thresholds in `vitest.config.ts` gate CI; flag a change that
lowers them to make a PR pass.

### `**/*.md`

Flag only statements that contradict the code: a wrong command, path, setting or behaviour. Skip
wording and Markdown style.

### `.github/workflows/**`

`ci.yml` supplies the checks the merge gate requires (Lint & Format, Test, Build). Flag a change
that drops one, skips the suite or lets a job pass without running it. `claude-review.yml`
supplies the gate's `review=done`; it stays a copy of the alliai plugin's
`packages/plugin/templates/claude-review.yml` apart from `runs-on`. Flag a change that lets its job
succeed without the tagged summary comment for the head, reads `.github/claude-review.md` from the
PR head instead of the base branch, widens its tool allowlist to commands that write to the repo,
or renames the job (the gate matches the check run name `claude-review`).
