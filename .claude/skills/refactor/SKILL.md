---
name: refactor
description: Run a deep audit-and-refactor quest over one Area or path set — census the code, build a falsified findings ledger, then land small, independently revertable, verified-green commits targeting correctness, edition regressions, true duplication, structural performance, dead code, and misplaced logic. Use when the user says "/refactor <area>", "audit and refactor X", "deep refactor", "clean up the X feature", "dedupe X", or asks an agent to improve a subsection of the codebase end to end. Behavior-preserving by default; follows a finding out of the target into shared code or a sibling feature when that is where the root cause or the true home lives, under an explicit anchor rule. Never merges — a broad refactor is always human-reviewed. Assumes a high-capability session model; it checks and stops if not.
---

# refactor — one deep refactor quest

You are doing a **deep audit and refactor** of a single target. The deliverable is not a report and
not a rewrite: it is a **series of small, independently revertable, individually verified-green
commits** that leave the target measurably cleaner, faster, and less buggy — plus an honest account
of what you did, what you deliberately didn't, and what you found that a refactor can't fix.

Read for **intent**, not just shape: what is this code *trying* to do, and where does it disagree
with its own names, types, comments, or callers? Follow that reasoning across feature boundaries
when the real problem lives elsewhere.

Six non-negotiables. Breaking any one makes the whole run worthless:

1. **Behavior-preserving by default.** Any intentional behavior change is its own commit, called out
   explicitly in the report. Never let one ride along inside a "cleanup".
2. **v1 never changes to suit v2.** v1 is the source of truth and v2 is purely additive (CLAUDE.md
   §Cross-Version Support). A refactor of shared code must leave v1 output identical, proven by
   v1's existing tests passing unmodified.
3. **Every commit is green** by §5's gate. Not "should be green" — you ran it and read the output.
4. **No unverified claims.** Every finding you act on survives an active attempt to falsify it
   (§3). Every claim in the report is something you observed, not inferred.
5. **Never merge, never push to `main`.**
6. **Stop at the budget, not mid-change.** A clean tree with 5 landed items beats 20 half-applied
   ones.

## 0. Preconditions — resolve all of these before the first edit

**Target.** `$ARGUMENTS` names the target: an Area from the Area → paths table in
`.claude/skills/scout/SKILL.md` §Constants (read it there rather than assuming a fixed set — it
grows as features land), or an explicit path set. If it names neither, ask — do not guess a target
for a run this expensive.

**Session model.** This runbook assumes an Opus/Fable-class session. A SKILL.md `model:` override
only applies to the turn that invokes the skill, so it cannot tier a run this long — that is why
this skill declares none. State the model you are running as in your first message; if it is Sonnet
or smaller, say so and ask whether to continue before spending budget.

**Budget.** Default: stop starting new items at ~70% of context. If the user gave a budget (commit
count, "one session", a time box), use theirs.

**Branch.** Never work on `main`. Create the worktree yourself, off a freshly fetched `main`:

```bash
git fetch origin main
git worktree add .claude/worktrees/refactor-<target> -b refactor/<target> origin/main
```

This is **not** a Linear ticket run — do not claim a ticket, and do not follow `/ticket`. If the
user wants it tracked, they'll say so.

**Baseline.** In the fresh worktree run `pnpm install --frozen-lockfile` **first** (worktrees have
no `node_modules`), then the `green` skill on the pristine cut, so any later failure is
attributable to you. Use **absolute paths**. `.samples/` (captured Logseq DOM) is gitignored and
lives only in the main checkout — read it from there (`git worktree list | head -1`).

**Contracts.** Read `CLAUDE.md` — §Architecture is authoritative for the feature interface, the
registry lifecycle, settings-driven styles, the single `provideStyle` injection, the platform
adapter, and the v2 data adapter. Judge code against those, not against generic best practice.

## 1. Scope contract

- **Editable:** the target.
- **Editable outside the target — wherever the finding actually leads.** Any path outside the
  read-only set below is fair game when it is the **root cause of**, or the **true home for**, a
  finding that originated in the target. That explicitly includes a **sibling feature**: if a
  `popovers` symptom's real bug is in `src/lib/api.ts`, fix it there; if the same logic is
  copy-pasted across three features, the fix spans three. Fixing a symptom inside the target
  because the cause was out of scope is a **failure** of this run — say so in the report if you
  ever do it.

  Four obligations come with leaving the target:

  1. **A ledger entry that names the originating finding.** No cross-feature edit exists on its own.
  2. **An exhaustive call-site audit** (§3) — every caller in every feature, enumerated as a
     checklist, before you change a shared signature.
  3. **That area's own contracts respected**, not the target's.
  4. **A separate commit per area touched**, so a reviewer can revert exactly that change.

- **The anchor rule (this is the bound).** You may leave the target to chase a **cause** or place a
  fix in its **right home**, never to opportunistically tidy where you landed. "While I'm in `links`
  anyway" is scope drift — file it as a follow-up. If fixing the root cause would mean refactoring
  the sibling more than the target itself, **stop and report**: re-aiming the run is the user's call.
- **Read-only for this run:** `.github/**`, `package.json`, `pnpm-lock.yaml`, `manifest.json`,
  `.claude/**`, and `CLAUDE.md` — the paths `ticket` sends to a human for merge. A finding there is
  recorded as a follow-up, never fixed in this run.
- **Out of bounds:** new features, dependency upgrades, formatting sweeps, and anything you cannot
  verify.

## 2. Phase A — Census (read-only; write it down before your first edit)

Do not start editing after a skim. The failure mode of this task is **omission**, and omission is
only prevented by an explicit checklist you tick off. Orient with the code graph before grepping:
`codegraph_explore` / `codegraph explore "<question>"`, plus `codegraph_impact` /
`codegraph_callers` for blast radius. (CodeGraph indexes the checkout it was built in; in a fresh
worktree run `codegraph init .` once, or confirm its answers with `Read`.)

Produce, in writing:

- **File table** — every file in scope: path, rough LOC, exported surface, one-line purpose, and
  edition (v1-only / v2-only / shared).
- **Dependency picture** — what the target imports, and every place that imports it. Use the code
  graph *and* grep: string-keyed references (CSS classes, `data-pl-*` attributes, settings keys,
  selectors in SCSS and tests) show up in neither alone.
- **Entry points** — `init()` / `destroy()`, `getStyles()`, DOM and `MutationObserver` callbacks,
  event listeners, settings-change handlers in `src/index.ts`, `logseq.*` registrations.
- **Coverage map** — per file: its tests, and which editions they exercise. Mark every
  behavior-bearing file with **no** test `UNCOVERED`; this drives §4's test-first rule.
- **Intent notes** — per module, one line on what it is *for*, plus every place the code and its
  name/type/comment/caller disagree. Those disagreements are where the real bugs are.
- **Cross-feature twins** — for each substantive behavior in the target (a property parse, a page
  lookup, a positioning calculation, an observer scan, an edition branch), search the *other*
  features for a second implementation of the same thing. Record each twin as a candidate finding
  with both locations, even if §3 rules it coincidental.

If the target exceeds ~40 files, **slice it** and do a full-depth pass per slice. A shallow pass
over everything is worse than a deep pass over half.

## 3. Phase B — Findings ledger

Every candidate change becomes a numbered ledger entry. Keep it in your todo list plus a scratch
file, and update it as you go. The shape (an illustrative entry, not a real finding):

```
F-07 | perf | src/features/<feature>/observer.ts:<line>
claim:      every mutation re-queries the whole document for property keys
evidence:   observer.ts:<line> runs querySelectorAll on the parent doc inside the MutationObserver
            callback; a long page fires it hundreds of times while scrolling
falsified?  looked for batching / a processed-marker — none; no debounce on the callback
risk:       med — changes when icons apply; output identical
blast:      1 call site; v1 and v2 share it
tests:      observer.test.ts covers injection only → add a call-count assertion first
value:      high
```

**Categories, in the order to spend effort on them:**

1. **Correctness / logic bugs** — wrong results, crashes, unhandled rejections, `await` in the
   wrong place, races between hover timers, `init()`/`destroy()` asymmetry (an observer, listener,
   or injected node that outlives a settings toggle), the intent mismatches from your census.
2. **Edition regressions and leaks** — v2 logic changing v1 behavior, a selector or API used in an
   edition that lacks it, `getVersion()` read before detection settles where it matters.
3. **True duplication** — the same decision expressed in N places, where one requirement change
   would have to touch all N.
4. **Structural performance** — `MutationObserver` callbacks that rescan the whole document,
   repeated `Editor.getPage` calls that bypass the cache, layout thrash in popover positioning,
   style re-injection storms, O(n²) over page-sized data.
5. **Dead code** — proved dead, not assumed dead.
6. **Wrong abstraction / misplaced logic** — edition branching inlined where the platform adapter
   or `pickStyles` belongs, a `lib` helper that knows about one feature, rendering logic outside the
   renderer pipeline.
7. **Clarity that changes maintenance cost** — imprecise types (`any` that should be `unknown` + a
   guard), inverted control flow, names that lie.
8. **Nothing else.** Cosmetic churn — reformatting, taste renames, comment polish, import
   reordering — is **forbidden**. It destroys review signal and `git blame` for zero value.

**Falsification is mandatory.** The characteristic failure of a capable model here is a fluent,
confident, wrong finding. Before an entry may be landed:

- *"This is duplicated"* → do the copies have the **same reason to change**? Invent one plausible
  future requirement; if it would change one and not the other, this is **coincidental** — leave it
  and say so. Code that looks alike across editions is often deliberately separate. Rule of three:
  two occurrences rarely justify an abstraction.
- *"This is dead"* → search the whole repo for the symbol **and its string forms**: re-exports,
  dynamic imports, settings keys in `src/settings/schema.ts`, CSS classes and selectors in SCSS,
  `data-pl-*` attributes, tests, docs. Only then delete.
- *"This is slow"* → name the **mechanism** and the **input size** at which it matters. No
  mechanism, no entry.
- *"This is a bug"* → state concrete inputs/state → the wrong output or crash, and which edition.
  If you can't, mark it **Suspected**, record it as a follow-up, and do **not** quietly "fix" it.
- *"I can move this to shared code"* → enumerate every caller, in both editions, and confirm each
  wants the new shared behavior.

## 4. Phase C — Landing plan

Order the ledger by value ÷ risk, then apply:

- **One concern per commit.** A reviewer must be able to revert exactly one idea.
- **Test-first for anything behavior-bearing and `UNCOVERED`:** write a characterization test
  against **current** behavior — for every edition the code serves (`setVersionForTest()` /
  `setPlatformForTest()`) — watch it pass, refactor, watch it still pass. Base DOM fixtures on the
  real structure in `.samples/`, not a guess.
- **If current behavior is wrong**, changing it is a separate `fix:` commit that *intentionally*
  changes the test, with old and new behavior both stated in the message.
- **Split mechanical from meaningful.** A move/rename with zero logic change goes in its own commit,
  ahead of the logic change. Never bundle a fix into a rename.
- **Cap the size.** Any item needing a >~300-line single-commit rewrite is a follow-up ticket, not
  a refactor item.
- **Conventional commit messages** — `refactor(<area>):` for behavior-preserving commits, `fix(<area>):`
  or `perf(<area>):` where that is what the commit is. release-please reads them.

## 5. Phase D — Execute

Per ledger item: re-read the actual bytes on disk (never edit off a stale index or cached search) →
edit → scoped checks → the gate → commit → tick the ledger. Re-census anything structural you just
changed before the next item.

**The gate.** The `green` skill is the definition of done: `pnpm check:ci`, `pnpm typecheck`,
`pnpm test:coverage`, `pnpm build`. Scope Vitest to touched files in the inner loop
(`pnpm vitest run <files>`); run the full suite before declaring done. Any change to `.scss` needs
the build — Vitest doesn't compile SCSS.

**Never buy green with a lie.** `as any`, a new `@ts-expect-error`, `.skip`, a loosened assertion, a
deleted test, an edited v1 test, or a widened type to silence an error are all **forbidden** as a
way through. If one is the only path, the item is **Abandoned** — revert it, record why, move on.
Three failed attempts on one item = revert and abandon it too. The tree is never left broken.

**Known friction in this repo:**

- The `rtk` Bash hook can return cached output — a check can report a stale clean right after a
  breaking edit. Confirm a suspicious pass with `rtk proxy <cmd>`.
- `.codegraph/` can lag a write or belong to another checkout. Confirm bytes with a read before
  editing; if an `Edit` fails to match, fall back to `Read`/`Grep`.
- Piping a command hides its exit code (`cmd | tail && commit` always commits). Redirect and echo
  `$?`.
- jsdom is not Logseq: a refactor that changes anything visible needs a manual check in the app,
  for each edition it touches. List it in the report; you can't do it yourself.

## 6. How this task goes wrong (read now, and again at the halfway point)

- **Abstraction inflation.** A wrapper/generic/helper "for reuse" with one caller. The metric is not
  fewer lines — it's **fewer places to edit when a requirement changes**.
- **DRYing coincidence.** See §3 — especially across editions. The abstraction grows a flag the
  first time the two cases diverge.
- **Merging the editions.** Folding a v1 and a v2 path into one "shared" function that subtly
  changes v1. Prove v1 is unchanged or don't do it.
- **The big-bang rewrite.** Unreviewable, unrevertable, and it silently drops edge cases the old
  code had earned.
- **Half-dedupe.** Extracting a shared helper and leaving one caller on the old copy — now there are
  two sources of truth. Finish or don't start.
- **Scope drift.** "While I was in there" is only allowed if it's in the ledger.
- **Trusting tooling over the file.** Indexes and output caches go stale.
- **Reporting a success you didn't observe.** The most damaging outcome of the whole run.

## 7. Budget & checkpointing

Work in passes, committing green as you go, so running out of budget leaves a **clean, landed,
partial** result rather than a broken tree. At ~70% of budget: stop starting new items, finish the
one in flight, write the report. Every unlanded finding goes into the report with enough detail
(file:line, claim, evidence, proposed approach, risk) that a cold agent could pick it up.

## 8. Wrap up

**Push and open a PR** against `main` from `refactor/<target>`, titled as a conventional commit
(`refactor(<area>): …`). **Never merge it** — a broad refactor is always human-reviewed. Say so in
the PR body, and recommend the human **merge it with "Rebase and merge"**: the run's value is its
independently revertable commits, and a squash would collapse them into one — and hide any `fix:`
commit from release-please behind a `refactor:` title.

**PR body / final report** — required sections:

1. **Landed** — one line per commit: `<short sha> F-nn — what changed, why`.
2. **Evidence of green** — the exact commands run and their real result. Quote any failure.
3. **Behavior changes** — explicit list, or the word `none`.
4. **Editions** — per commit, which edition(s) it touches, and how v1 was proven unchanged.
5. **Areas touched outside the target** — per area: which finding took you there, root cause or
   true home, and the call-site audit you ran.
6. **Manual check** — anything visible a human should confirm in Logseq, per edition; or `none`.
7. **Not done, and why** — per finding: risk / needs a product decision / read-only path / out of
   budget.
8. **Design findings** — the 1–3 structural problems a refactor can't fix, stated as proposals.
9. **Supportable metrics only** — files touched, net LOC, duplicate call sites collapsed, observer
   scans removed. No invented percentages, no "~40% faster" you didn't measure.
10. **Honesty clause** — if the run found little of value, say so plainly. A short truthful report
    is a good outcome; an inflated one poisons every decision made on top of it.

**Follow-up tickets — opt-in only.** If the user passed `--file-followups`, file **every** design
finding and every Abandoned item that survived §3 falsification into Linear `Triage` (team `PRE`),
labelled `claude` + one Type + one Area (+ one Edition if edition-specific). There is no count cap —
`groom` dedupes and parks noise downstream. Each ticket carries a concrete `file:line` and the
falsification note from §3. The only findings that stay prose-only are ones still **Suspected** with
no proposed approach — name them in the report as not filed, and why. Without the flag, the report
is the record — do not write to Linear.
