---
name: plan-probe
description: Plan a feature/fix by treating every Logseq DOM selector, plugin-API shape, edition difference, CSS variable, and broad command as a HYPOTHESIS to verify with a tiny read-only probe BEFORE writing production code. Use for any non-trivial change touching Logseq's DOM or API, v1/v2 edition behavior, settings, or commands that touch many files. Catches wrong-approach friction in seconds instead of after a release.
---

# plan-probe — verify assumptions before you build

> **Model — intentionally not pinned.** This skill *inherits the caller's model* on purpose:
> assumption verification is exactly the high-leverage reasoning the strong model exists for.
> Invoked inside `ticket`'s Opus design phase it runs on **Opus**; standalone it runs on your session
> model. Do **not** add `model: sonnet` — that would silently downgrade the probing this skill
> exists to protect.

A plugin change can pass typecheck, lint, and every jsdom test, then do nothing in Logseq: a
selector that only exists in one edition, an `Editor.getPage` field that v2 names differently, a
CSS variable the DB app doesn't define, a `fetch` the v2 CSP blocks. Each is an **unverified
assumption**, and jsdom tests built on the same assumption confirm it instead of catching it. This
skill makes you probe first.

## Steps

1. **Write the plan** — a short paragraph and the list of files you'll touch. (If in plan mode,
   this feeds ExitPlanMode.)

2. **Build the assumption risk-list.** Enumerate every load-bearing thing you're *assuming* but
   haven't *seen*, especially:
   - **DOM selectors and structure** — does this element exist, in *which* edition, and is it where
     you think in the tree? The two editions differ a lot (`src/core/platform/v1.ts` vs `v2.ts`).
   - **Plugin API shapes** — `@logseq/libs` is pinned at 0.0.17, so method signatures and return
     types are that version's, not the latest docs'.
   - **Edition data shapes** — v1 and v2 return very different `Editor.getPage` data (v2 property
     keys are namespaced and id-suffixed, values are entity ids; see `src/lib/api.v2.ts`).
   - **Theme and CSS variables** — which `--ls-*` variables each edition defines, and where the
     accent color comes from (`src/core/theme.ts`).
   - **Edition restrictions** — v2 blocks plugin `fetch` and `data:` URIs (use `logseq.Request` and
     inline SVG), and the plugin runs in an iframe that reaches into the parent document.
   - **Empty / edge inputs** — a page with no properties, an unresolved entity id, a block with no
     children, a setting toggled off then on (does `destroy()` undo everything `init()` did?).
   - Any command that touches files broadly (format, codemods).

3. **Probe each high-risk assumption** with the smallest possible read-only check, before
   production code:
   - **Selectors / DOM** → the captured Logseq pages in `.samples/*.html`. They are gitignored, so
     they exist only in the **main checkout** (`git worktree list | head -1` prints its path). They
     were captured **with the plugin loaded**, so they contain the plugin's own `<style>` text: match
     selectors as DOM attributes/elements, not raw substrings. Check `data-pl-version` on `<html>` to
     see which edition a sample is.
   - **API / type shape** → the installed types in `node_modules/@logseq/libs/dist/*.d.ts`, a
     throwaway one-line Vitest, or the source itself — **orient with CodeGraph (`codegraph_explore`,
     or `codegraph explore "..."`) before opening source files** (the repo's codegraph-first
     convention, CLAUDE.md).
   - **Real graph data** → the `mcp-logseq` tools against the companion graph
     (`~/Documents/projects/logseq/`), **read calls only**: `get_page_content`, `search`, `query`,
     `find_pages_by_property`. That server talks to the user's live graph — never call a
     create/update/delete tool from a probe.
   - **Edition behavior** → the platform adapter (`src/core/platform/`) and the existing tests that
     use `setVersionForTest()` / `setPlatformForTest()`; mirror one for the case you're unsure of.
   - **Empty / edge handling** → build the empty case with the `test/mocks/logseq.ts` helpers
     (`mockPageData`, `mockPageWithProperties`) and run it.

4. **Report probe results, then build.** Show what each probe proved. Only write production code
   for assumptions that survived. If a probe falsifies an assumption, revise the plan first.

## Guardrails

- Probes must be **read-only and scoped**. Never probe with a repo-wide format (`pnpm check`), and
  never with a mutating `mcp-logseq` call — the companion graph is the user's real notes.
- Some things no probe here can settle — how a style looks inside the running app, or behavior that
  only shows in a live Logseq session. Name those as **unverified** in the plan rather than
  treating a jsdom result as proof.
- Keep probes throwaway — delete scratch files when done.
