---
name: ticket
model: sonnet
description: Take a single Linear ticket (team PRE) from claim → implement → verify → PR → review + CI → merge, safely alongside other sessions. Use when the user says "work PRE-N", "pick up the next ticket", "/ticket PRE-5", or asks an agent to grind a Linear issue end-to-end. Claims on Linear and in alliai so parallel sessions never collide; answers CodeRabbit review; fixes CI failures it caused (≤3 attempts, then escalates); squash-merges its own PR once CI is green — except PRs touching .github/**, dependencies, manifest.json, or agent instructions, which a human merges. Never merges a release-please PR.
---

# ticket — one Linear issue, end to end

You may be one of several agent sessions working this repo at once. Your isolation comes from
three things: **the Linear status (the ticket claim), alliai (the path claims), and your git
worktree (the branch).** Run exactly one ticket through the loop below, then stop.

Invoked as `/ticket PRE-N` (explicit) or `/ticket next` (pick the next eligible ticket).

Linear calls below use the `mcp__linear-server__*` tools. They authenticate as the app user
**claude**, which is a member of team PRE. The `model: sonnet` above only applies to the turn that
invokes this skill — for a whole run on Sonnet, start the session with `claude --model sonnet`.

**Merging to `main` does not ship.** Users only get a change when a human merges the release PR
that release-please keeps open. That is the real release gate, and it is why you may merge your
own ordinary PRs — and why you must **never** merge a release PR.

## The loop

1. Claim → 2. Orient + merge-gate check → 3. Worktree + baseline → 4. Implement → 5. Verify →
6. Open the PR → 7. Review, CI, merge.

Investigation tickets (no code) skip 3–7 and use the **investigation terminal state**.

---

## 1. Claim

**One explicit ticket per session is the real guard against collision.** `/ticket PRE-N` is the
recommended mode; `/ticket next` is best-effort.

- **`/ticket PRE-N`:** `get_issue` for it.
- **`/ticket next`:** `list_issues` with `team: "PRE"`, `state: "Todo"`, `includeArchived: false`.
  Pick the highest-priority ticket **not** labelled `Needs Human Review` (a human has parked it;
  never auto-claim one). `Triage` is never auto-pulled — it is intake awaiting promotion.
- **Claim on Linear:** `save_issue` → `state: "In Progress"`, `assignee: "me"`, then `get_issue`
  again to confirm. Status is the signal, not assignee: every session authenticates as the same
  app user. This is check-then-act, not atomic.
- **Claim in alliai:** `work_item_claim` with `PRE-N`. This one *is* atomic. If it's refused,
  another live session holds the ticket: stop, move it back to `Todo`, and comment naming the
  holder the tool reported.

Capture: `gitBranchName`, the issue `url`, the **Type** label (`Bug`/`Feature`/`Improvement`/
`Tech Debt`), the **Area** label, the **Edition** label if any (`v1`/`v2`; unset means both),
priority, description, and acceptance criteria.

---

## 2. Orient + merge-gate check

**Check what other sessions know and hold.** `decision_search` for the paths and areas the ticket
touches and with `work_item_ref: "PRE-N"`; follow active decisions or supersede them explicitly
(`decision_supersede`), never quietly diverge. `search` the ticket's key terms — an earlier
session may have tried and abandoned this. `claims_list` for who holds what; if a live session
holds paths you need, coordinate (`request_create`) or narrow your change.

**Read the contracts before working:**

| Ticket touches | Read |
|---|---|
| any `src/**` | `CLAUDE.md` §Architecture (Feature System, Settings-Driven Styles, Style Injection), then the feature's `index.ts` and its tests. Orient with CodeGraph (`codegraph_explore`) before grepping |
| edition-specific code, or Edition `v2` | `CLAUDE.md` §Cross-Version Support, and `src/core/platform/{types,v1,v2}.ts`. **v1 is the source of truth and v2 is purely additive:** never change v1 behavior to make v2 work |
| a setting | `src/settings/schema.ts` — the schema and `PluginSettings` must stay in sync, and a change needs handling in `onSettingsChanged` (`src/index.ts`) |
| Area `infra` | the workflow files under `.github/workflows/`, and `CLAUDE.md` §CI |
| Area `tooling` | the skills/agents under `.claude/` you're changing, and `CLAUDE.md` |

**Merge gate — a human merges any PR that touches these paths:**

| Paths | Why |
|---|---|
| `.github/**` | A workflow edit can make CI pass without testing anything; the release workflow and Dependabot auto-merge live here too |
| `package.json`, `pnpm-lock.yaml` | Dependencies are bundled into the plugin users install (`@logseq/libs` included) |
| `manifest.json` | Marketplace listing metadata |
| `.claude/**`, `CLAUDE.md` | Agent instructions — an agent doesn't merge changes to its own guardrails |

This gates the **merge**, not the work. If the ticket will touch one, post a short `save_comment`
naming the path and that a human will merge, then implement normally and flag it at the top of the
PR body. If you discover it mid-implementation, do the same from that point.

---

## 3. Worktree + baseline

Create a worktree off fresh `origin/main` on the exact `gitBranchName` (that name is how Linear
links the PR and how alliai resolves your session's work item):

```bash
git fetch origin main
git worktree add ".claude/worktrees/<gitBranchName>" -b "<gitBranchName>" origin/main
```

then call `EnterWorktree` with that path. `.claude/worktrees/` is gitignored.

- Launched already inside the right worktree? Skip creation and confirm with
  `git branch --show-current`. Never invent a branch name.
- **Before your first edit, confirm you are in the worktree:** `git rev-parse --show-toplevel`
  must print the worktree path, not the main checkout's.
- **Main-checkout-only files.** `.samples/` (captured Logseq DOM) and `.ai/` (working notes) are
  gitignored, so the worktree doesn't have them. Read them from the main checkout's path
  (`git worktree list | head -1`).
- **CodeGraph indexes the checkout it was built in.** A fresh worktree has no `.codegraph/`; run
  `codegraph init .` there once, or treat CodeGraph results as the main checkout's bytes and
  confirm with `Read` before editing.

**Claim your paths in alliai** — `claim_create` with the paths or globs you expect to touch
(narrow to files when you know them) and a one-line summary naming `PRE-N`. Read the overlaps it
returns and act on them. Then `session_update` with a one-sentence intent.

**Baseline before you touch anything.** On the pristine cut of `origin/main`, run the `green`
skill's step 2 (install, `check:ci`, `typecheck`, `test:coverage`). Skip the build here; §5 runs
it.

- **Green** → continue. Any red after this is yours.
- **Red** → `main` can't merge red (all three checks are required, strict), so this is almost
  always the machine: a partial install. Report it either way. Don't side-fix it into your PR.
  Interactive: tell the user. Headless: Linear comment, leave `In Progress`, stop.

---

## 4. Implement

**Model routing — Opus designs, Sonnet implements.** Spend Opus where a wrong call is silent:
understanding the ticket, root-causing, and checking assumptions. Implementation mistakes get
caught by tests, `green`, CI and review; a wrong assumption about Logseq sails through all of them,
because the jsdom tests are written on the same assumption.

- **Trivial change** (one-line fix, copy, config) → implement inline.
- **Anything else** → first spawn a `general-purpose` subagent with `model: opus` to **design,
  not implement**. Pass it the ticket text, Type, Area, Edition, acceptance criteria, and the
  decisions you found in §2. Tell it to follow `.claude/skills/plan-probe/SKILL.md`: treat every
  load-bearing assumption — selectors, API shapes, edition differences — as a hypothesis and
  probe it with the smallest read-only check before planning.

  It returns: files to change, the approach, what each probe proved, the test plan, which
  edition(s) the change affects, and any merge-gated path it hits. It writes no production code.

Then implement inline. Record the approach you chose — and any you tried and abandoned — with
`decision_record` (areas + paths). Failed approaches are the most valuable records.

Type playbooks:

- **`Bug`** — reproduce first; don't fix on a hypothesis. Add a test that fails before the fix and
  passes after, and **prove it fails on the unpatched code** — a fixture that already looks
  correct passes on both and proves nothing. Build fixtures with `test/mocks/logseq.ts`,
  `test/fixtures/`, and the DOM helpers in `test/utils/dom.ts`; base DOM fixtures on the real
  structure in `.samples/`, not on a guess.
- **`Feature`** — follow `CLAUDE.md` §Adding a New Feature: a self-contained module under
  `src/features/`, registered in `src/index.ts`, with its setting in both the schema and
  `PluginSettings`. Scope an edition-only toggle with the schema's `versions` field. Every DOM
  change `init()` makes, `destroy()` must undo.
- **`Improvement`** — scoped; reuse existing helpers. A rename or dedupe across files needs an
  exhaustive call-site list first: grep the symbol *and* its string forms — CSS class names,
  `data-pl-*` attributes, settings keys, and selectors in tests and SCSS.
- **`Tech Debt`** — confirm the debt still exists on `origin/main` before touching code. If it
  doesn't, take the investigation terminal state.

**Editions.** Edition `v2` (or unset, if the change is shared) work must leave v1 behavior
byte-for-byte unchanged: add v2 code (`*.v2.ts`, `styles.v2.scss`, a `pickStyles({ v1, v2 })`
branch, a v2 platform override) rather than editing the v1 path. v1's existing tests must pass
without modification — editing a v1 test to make it pass is a regression, not a fix.

**Tests ship with the change.** New or changed logic → Vitest coverage of the new path and its
failure cases, co-located as `*.test.ts`, for each edition it affects. A change with no testable
surface (pure SCSS, copy, docs) → say so in the PR body.

**UI changes — the real check is manual.** No agent here can drive the Logseq desktop app, and
jsdom can't tell you a style looks right. So for anything a user would see:

1. Verify every selector you target against the `.samples/` captures for the edition(s) involved.
2. Cover the DOM behavior you can in jsdom — what gets injected, and that `destroy()` removes it.
3. Run `pnpm build` — it is the only local check that compiles SCSS.
4. Write a **Manual check** list for the PR body: edition(s), which page or setting to open, what
   should appear, and both a light and a dark theme if colors changed. The human runs it by
   loading the unpacked plugin (`CLAUDE.md` §Development Workflow) — before merging your PR or, at
   the latest, before merging the release PR that ships it.

Commit as you go. Messages are conventional commits (§6) ending with the repo's `Co-Authored-By`
trailer.

---

## 5. Verify

Run the `green` skill — including the build. Report honestly; quote any failure. Confirm the tests
you added in §4 actually ran, for every edition the change touches. If an Opus subagent produced
the plan, check you built what it specified, including every test in its test plan; don't drift
from a probed decision without re-probing.

Format only the files you touched (`pnpm exec biome check --write <files>`), never repo-wide.

---

## 6. Open the PR

**Titles are release input.** PRs are squash-merged, and release-please reads the squash commit's
title to decide the next version and write `CHANGELOG.md`. So the PR title — and every commit
title, since a one-commit PR's squash uses the commit's title — must be a conventional commit:

| Change | Title |
|---|---|
| User-visible bug fix | `fix(<area>): <what's fixed, for users>` |
| New user-visible capability or setting | `feat(<area>): <what users can now do>` |
| No user-visible change | `refactor:`, `perf:`, `test:`, `docs:`, `ci:`, `build:`, or `chore:` |

`fix` and `feat` titles become changelog lines, so write them for plugin users. Don't prefix the
title with `PRE-N:` — that's not a conventional commit, so release-please would silently leave the
change out of the release. The Linear link goes in the body.

Before pushing:

- `git fetch origin main`. If `main` moved, `git merge origin/main` (not rebase — never
  force-push) and re-run `green`. The ruleset's strict policy needs the branch up to date before
  merge anyway; doing it now saves a CI cycle.
- Read the landing check the alliai pre-push hook injects (or call `landing_check`) and resolve
  what it lists.

```bash
git push -u origin <gitBranchName>
gh pr create --base main --title "<conventional title>" --body-file <file>
```

The body puts the ticket's Linear `url` on its own line near the top (with it, CodeRabbit can check
the diff against the ticket's acceptance criteria), a **"Human merge: touches `<paths>`"** line
first if the §2 gate applies, then what changed and why, which edition(s) it affects, the test
evidence from §5, the **Manual check** list for UI changes, and the repo's PR trailer.

Then:

- `save_issue` → `state: "In Review"`, plus a `save_comment` with the PR URL (and the Manual check
  list, for UI changes).
- `claim_mark_in_review` with `github:#<PR>`, and `session_summary` with the PR ref.

---

## 7. Review, CI, merge

**CodeRabbit reviews every non-bot PR** within a few minutes: a walkthrough comment, a review, and
inline comments, often while the first CI run is still going. Your review-fix push restarts CI, so
**don't sink time watching the first run**. Wait for the review instead, in the background,
bounded:

```bash
timeout 600 bash -c 'until b=$(gh pr checks <pr> --json name,bucket --jq ".[] | select(.name==\"CodeRabbit\") | .bucket"); [ -n "$b" ] && [ "$b" != pending ]; do sleep 30; done; echo "CodeRabbit: ${b:-no check}"'
```

A `skipping` result or a rate-limit message means no review is coming. Then read it:

```bash
# Both endpoints paginate — always --paginate. Filter on the exact login.
gh api --paginate "repos/{owner}/{repo}/pulls/<pr>/reviews"  --jq '.[] | select(.user.login=="coderabbitai[bot]")'
gh api --paginate "repos/{owner}/{repo}/pulls/<pr>/comments" --jq '.[] | select(.user.login=="coderabbitai[bot]")'
```

**The verdict is advisory** (0 approvals required). **Investigate before applying** — reviewers are
often confidently wrong about this repo, and its tools' bundled metadata can lag the actions and
libraries actually in use.

| Verdict | When | Action |
|---|---|---|
| **Implement** | A clear correctness, edition-regression, or security catch, in scope | Fix, re-run `green`, fold into one commit, reply on the thread with what changed + the SHA |
| **Dismiss** | Nit, style Biome doesn't enforce, false positive, or out of scope (file a follow-up) | Reply once with the reason, addressed to `@coderabbitai`. For a false positive that reflects a repo rule, state it as one ("by design: X because Y") — CodeRabbit keeps replies as learnings, so it stops recurring |

If a fix would touch a merge-gated path the PR didn't already touch, that's allowed — the PR now
waits for a human (add the "Human merge" line to the body).

**Every thread must be resolved — the ruleset blocks the merge otherwise.** Reply on a thread,
then resolve it:

```bash
gh api "repos/{owner}/{repo}/pulls/<pr>/comments/<comment-id>/replies" -F body=@reply.md

gh api graphql -f owner="$(gh repo view --json owner -q .owner.login)" \
  -f name="$(gh repo view --json name -q .name)" -F pr=<pr> -f query='
  query($owner:String!,$name:String!,$pr:Int!){ repository(owner:$owner,name:$name){
    pullRequest(number:$pr){ reviewThreads(first:100){ nodes { id isResolved } } } } }' \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved==false) | .id'

gh api graphql -f threadId="<thread-node-id>" -f query='
  mutation($threadId:ID!){ resolveReviewThread(input:{threadId:$threadId}){ thread { isResolved } } }'
```

**Convergence: at most 3 code-changing review rounds.** Each push triggers another incremental
review. From the 4th round on, stop changing code for review: classify each remaining thread as
REAL_BUG, NITPICK or FALSE_POSITIVE with a `file:line` citation (read every thread in full first),
reply and resolve the nits and false positives, and file real bugs as follow-up tickets — or
escalate if merging would ship the defect. Say in the PR that the review converged.

**Watch the checks:**

```bash
gh pr checks <pr> --watch --fail-fast
```

Run it in the background and wait for it to exit; don't poll on top of it. If it exits instantly
with "no checks" right after PR-open, re-run it once. Required: **Lint & Format, Test, Build**.
`All Checks Passed` and `CodeRabbit` also report but don't gate.

On a failure, read the log before patching: `gh run view <run-id> --log-failed`. Reproduce with the
matching `green` command, fix, re-run `green`, push. That is one attempt.

**Budget: ≤ 3 fix attempts.** After the third, escalate: a Linear comment with the failing check,
the log excerpt, what each attempt tried, and why it's stuck; tell the user too when interactive.
Leave the ticket `In Review` unmerged and stop.

### Merge

Once CI is green and the review is settled (the `CodeRabbit` check for the **current head** has
finished, and every thread is resolved):

1. **Gate check:**
   `git fetch -q origin main && git diff --name-only origin/main...HEAD | grep -E '^(\.github/|\.claude/|CLAUDE\.md$|package\.json$|pnpm-lock\.yaml$|manifest\.json$)'`
   Any output → **a human merges.** Comment on the ticket "Ready for human merge: touches
   `<paths>`", leave it `In Review`, `session_summary`, and stop.
2. **Up to date?** `gh pr view <pr> --json mergeStateStatus -q .mergeStateStatus`. If `BEHIND`,
   `git merge origin/main`, re-run `green`, push, and wait for CI again (it counts toward the
   budget only if it fails).
3. **Title check:** `gh pr view <pr> --json title -q .title` must still be a conventional commit —
   it becomes the squash commit release-please reads.
4. **Squash-merge** (merge commits are disabled on this repo; the remote branch is deleted
   automatically):

   ```bash
   gh pr merge <pr> --squash
   ```

5. **Check `main` stays green.** The merge is a push by your `gh` login, so CI runs on `main`:
   `gh run list --branch main --event push --limit 3 --json headSha,status,workflowName,databaseId`.
   Watch the CI run in the background (`gh run watch <id> --exit-status`). A `fix`/`feat` merge also
   makes release-please open or update its release PR (`chore(main): release …`). **Leave it alone**
   — merging it publishes to every user, and that decision is the human's.
6. Move the ticket to **Done** with a `save_comment` naming the merge commit (harmless if Linear's
   GitHub integration already moved it), and noting the Manual check if one is still outstanding.
   `claim_release` your claims; `session_summary` with `merged`. Leave the worktree
   (`ExitWorktree`), then `git worktree remove` it.

---

## Investigation terminal state (no PR)

For spikes, questions, and debt that turned out stale: do the research, post findings as a Linear
comment (clear, actionable, naming any follow-up tickets), record any conclusion other sessions
should know with `decision_record`, move the ticket to **In Review** (a human confirms) or **Done**
if self-evidently complete, and `claim_release` any claims. No worktree, no PR.

If you abandon a ticket: `claim_release`, a Linear comment saying why, and move it back to `Todo`
only if someone else can pick it up as-is.

## Filing follow-ups

Out-of-scope findings go to Linear: team `PRE`, `state: "Triage"`, labels `claude` + one Type +
one Area (+ one Edition if the finding is edition-specific). Body: `file:line`, the concrete
failure or cost, and no fix approach unless you probed one. Don't scope-creep the PR.

## Linear quick reference (team PRE)

- **Statuses:** `Triage`, `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`, `Canceled`,
  `Duplicate`.
- **Labels:** Type `Bug`/`Feature`/`Improvement`/`Tech Debt`; Area (map in
  `.claude/skills/scout/SKILL.md` §Constants) `popovers`/`links`/`properties`/`todos`/`content`/
  `styling`/`navigation`/`core`/`infra`/`tooling`; Edition `v1`/`v2` (unset = both); Source
  `claude`/`scout`/`human`/`sentry`; `Needs Human Review`. The retired `Domain` group and the
  workspace-wide `db-migration` and `Port Strategy` labels belong to other teams — don't apply
  them.
- **Branch:** always the ticket's `gitBranchName`. **PR title:** a conventional commit (§6), never
  `PRE-N: …`.

## Guardrails

- Never push to `main`, never force-push, never rebase a pushed branch.
- Never run `pnpm check` — it rewrites the whole repo. Format only files you touched.
- Never merge a release-please PR (`release-please--*` branch, opened by `allido-release[bot]`).
- Never change v1 behavior to make v2 work; v1's tests pass unmodified.
- Never call a mutating `mcp-logseq` tool — the companion graph is the user's real notes.
- A human merges anything touching `.github/**`, `package.json`, `pnpm-lock.yaml`,
  `manifest.json`, `.claude/**`, or `CLAUDE.md`. Everything else, you squash-merge once CI is green
  and every review thread is resolved.
- ≤ 3 CI fix attempts and ≤ 3 code-changing review rounds; then escalate or converge.
