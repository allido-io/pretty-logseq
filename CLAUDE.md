# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Pretty Logseq** is a Logseq plugin for frontend customizations. It provides a
modular, settings-driven system of self-contained features: custom hover
popovers, enhanced external links, styled properties/tables/tags/templates/todos,
typography, and top bar / sidebar tweaks. Each feature can be toggled
independently from the plugin settings UI.

The plugin supports **both Logseq editions**: v1 (the file/markdown app) and v2
(the newer database-backed "DB" app). The two differ in DOM structure, CSS
variables, and the shape of data returned by `Editor.getPage`, so a cross-version
**platform adapter** (`src/core/platform/`) abstracts those differences behind a
single `Platform` interface. All v2 work is strictly **additive** — v1 behavior
must never regress (see the platform adapter section below).

## Tech Stack

- **Language:** TypeScript
- **Build:** Vite with vite-plugin-logseq
- **Styling:** SCSS (compiled via Vite, imported with `?inline`)
- **Testing:** Vitest (jsdom environment)
- **Linting/Formatting:** Biome
- **Package Manager:** pnpm 10.x
- **Runtime:** Logseq Plugin API (@logseq/libs)

## Commands

```bash
# Install dependencies
pnpm install

# Development (watch mode — rebuilds dist/ on change)
pnpm dev

# Production build
pnpm build

# Type check (no emit)
pnpm typecheck

# Tests
pnpm test              # Run tests once
pnpm test:coverage     # Run tests with coverage report

# Lint and format (Biome)
pnpm check             # Check + auto-fix
pnpm check:ci          # Check only (no writes) — used in CI
```

Note: there are no separate `lint`/`format` scripts — `check` covers both.

## Development Workflow

1. Run `pnpm dev` to start watching for changes
2. In Logseq: Settings → Advanced → Developer mode (enable)
3. In Logseq: Plugins → Load unpacked plugin → Select this project folder (not dist/)
4. Changes auto-rebuild; reload plugin in Logseq to see updates

## Build Configuration

The plugin uses Vite with vite-plugin-logseq. Key points:

- **Entry point:** `index.html` in project root loads `src/index.ts`
- **Output:** `dist/index.html` + `dist/assets/index-*.js`
- **package.json main:** Must be `"dist/index.html"` (not .js)
- **@logseq/libs:** Must be bundled (NOT external) - the browser needs the library code to set up the global `logseq` object
- **SCSS:** Uses the modern-compiler API (see `vite.config.ts`)

```
Build output:
dist/
├── index.html           # Entry point Logseq loads
└── assets/
    └── index-*.js       # ESM bundle (includes @logseq/libs + compiled CSS)
```

## Project Structure

```
pretty-logseq/
├── index.html            # Vite entry point (loads src/index.ts)
├── manifest.json         # Logseq plugin manifest
├── package.json          # Plugin manifest and dependencies
├── vite.config.ts        # Vite build configuration
├── vitest.config.ts      # Vitest configuration (jsdom, coverage)
├── biome.json            # Linting and formatting config
├── tsconfig.json         # TypeScript configuration
├── pnpm-workspace.yaml   # pnpm configuration
├── src/
│   ├── index.ts          # Bootstrap, feature registration, settings-change wiring
│   ├── types/            # TypeScript interfaces
│   │   ├── index.ts      # Re-exports
│   │   ├── feature.ts    # Feature / ConfigurableFeature interfaces
│   │   ├── logseq.ts     # PageProperties, etc.
│   │   └── scss.d.ts     # SCSS import declarations
│   ├── core/             # Core infrastructure
│   │   ├── registry.ts   # Feature lifecycle + style aggregation
│   │   ├── styles.ts     # Style injection (theme + features → provideStyle)
│   │   ├── theme.ts      # Accent-color auto-detection + theme observer
│   │   ├── version.ts    # Logseq edition detection (v1 vs v2), getVersion()
│   │   └── platform/     # Cross-version adapter (selectors, api, theme per edition)
│   │       ├── index.ts  # getPlatform() — resolves active Platform, pickStyles()
│   │       ├── types.ts  # Platform interface
│   │       ├── v1.ts     # v1 (file/markdown) platform — source of truth
│   │       ├── v2.ts     # v2 (DB) platform — spreads v1, overrides confirmed diffs
│   │       └── styles.ts # Version-aware style selection helpers
│   ├── lib/              # Shared utilities
│   │   ├── dom.ts        # Positioning, element creation, getParentDoc
│   │   ├── api.ts        # v1 Logseq API helpers with caching
│   │   └── api.v2.ts     # v2 (DB) data adapter — normalizes DB property shape
│   ├── settings/         # Plugin settings
│   │   ├── index.ts      # getSettings / initSettings / onSettingsChanged
│   │   └── schema.ts     # Settings UI schema + PluginSettings interface
│   └── features/         # Feature modules (each implements Feature)
│       ├── popovers/     # Custom hover previews for page references
│       │   ├── index.ts        # Feature entry point
│       │   ├── manager.ts      # Hover lifecycle, show/hide, positioning
│       │   ├── styles.scss     # Popover + native-suppression styles
│       │   └── renderers/
│       │       ├── index.ts        # Re-exports renderPopover
│       │       ├── unified.ts      # Config-driven renderer for all page types
│       │       ├── type-config.ts  # Property-driven popover config inference
│       │       └── helpers.ts      # Shared DOM helpers
│       ├── links/        # External-link favicons + hover preview cards
│       │   ├── index.ts, favicons.ts, metadata.ts, observer.ts,
│       │   ├── popover.ts, types.ts, styles.scss
│       ├── content/      # Bullet threading + favorite-star button
│       │   ├── index.ts, styles.scss, threading.scss
│       │   └── favorites/  # api.ts, observer.ts, styles.scss
│       ├── properties/   # Styled page properties (+ optional icons)
│       │   ├── index.ts, observer.ts, v1.ts + v2.ts (per-version strategies)
│       ├── todos/        # Restyled task blocks
│       │   ├── index.ts, observer.ts, v1.ts + v2.ts (per-version strategies)
│       ├── tables/       # Styled query-result tables
│       │   ├── index.ts, styles.scss
│       ├── tags/         # Styled inline tags (Pretty Tags)
│       │   ├── index.ts, styles.scss
│       ├── templates/    # Styled template blocks
│       │   ├── index.ts, styles.scss
│       ├── typography/   # Inter font, headers, prose styling
│       │   ├── index.ts, styles.scss, headers.scss, prose.scss
│       ├── topbar/       # Top navigation (gradient, icons, hide controls, nav arrows)
│       │   ├── index.ts, handlers.ts, styles.scss, gradient.scss,
│       │   ├── icon-styling.scss, hide-home.scss, hide-sync.scss,
│       │   └── hide-window-controls.scss
│       └── sidebar/      # Left sidebar (compact nav, hide create, graph selector)
│           ├── index.ts, compact-nav.scss, compact-nav.v2.scss,
│           ├── hide-create.scss, graph-bottom.scss, graph-bottom.v2.scss
├── test/                 # Test infrastructure (fixtures, mocks, utils, setup.ts)
├── dist/                 # Built output (gitignored)
├── CHANGELOG.md
├── CONTRIBUTING.md
├── README.md
└── SECURITY.md
```

Unit tests live next to the code as `*.test.ts` files throughout `src/`.

## Architecture

### Feature System

Each feature implements the `Feature` interface (`src/types/feature.ts`):

```typescript
interface Feature {
  id: string;
  name: string;
  description: string;
  getStyles(): string;
  init(): void | Promise<void>;
  destroy(): void;
}
```

Features are self-contained (styles, initialization, cleanup) and registered in
`src/index.ts` via `registry.register(...)`. The `FeatureRegistry`
(`src/core/registry.ts`) owns the lifecycle: `initializeAll`,
`initializeFeature(id)`, `destroyFeature(id)`, `destroyAll`, and
`getAggregatedStyles()`.

### Cross-Version Support (v1 file app / v2 DB app)

Logseq ships in two editions with different DOM, CSS variables, and API data
shapes. Pretty Logseq supports both behind a small set of abstractions.
**Guiding rule: v2 is purely additive — never regress v1.** v2 code starts by
mirroring v1 and overrides only differences that have been *confirmed against a
real DB instance*.

- **Version detection** (`src/core/version.ts`): `detectVersion()` resolves the
  active edition asynchronously at startup; `getVersion()` returns the cached
  result synchronously (defaulting to `v1` before detection completes, so it's
  safe to call anywhere). `applyVersionAttribute()` stamps `data-pl-version` on
  the root so stylesheets can scope by edition. Tests use `setVersionForTest()`.

- **Platform adapter** (`src/core/platform/`): the `Platform` interface
  (`types.ts`) groups everything that differs per edition — DOM `selectors`, an
  `api` object (page/blocks/theme/favorites), and `theme` config (accent vars /
  attributes). `v1.ts` is the source of truth; `v2.ts` does
  `{ ...v1Platform, ...overrides }`, so any field not explicitly overridden
  inherits v1 (and is flagged as needing v2 verification). `getPlatform()`
  returns the active adapter; `getObserverRoot()` resolves the observer mount
  point from it. Tests use `setPlatformForTest()`.

- **Version-aware styles** (`pickStyles`, `src/core/platform/styles.ts`):
  features import both `styles.scss` and (where the DOM diverged) `styles.v2.scss`
  with `?inline` and return `pickStyles({ v1, v2 })`. A missing/empty `v2` falls
  back to `v1`, so v2 renders with v1 styling until its own SCSS is authored.

- **Per-version feature strategies** (`features/*/v1.ts` + `v2.ts`): when a
  feature's `getStyles`/`init`/`destroy` differ enough between editions, the
  behavior is split into a `PropertiesStrategy`-style slice
  (`Pick<Feature, 'getStyles' | 'init' | 'destroy'>`). The feature's `index.ts`
  picks the strategy for the active version. Reuse v1's implementation wherever
  it's version-agnostic (e.g. the property-icon observer reads its key selector
  from `getPlatform().selectors.propertyKey`, so v2 reuses v1's `init`/`destroy`).

- **v2 data adapter** (`src/lib/api.v2.ts`): the DB `Editor.getPage` returns a
  very different shape than v1 — property keys are namespaced and id-suffixed
  (`:user.property/<name>-<8char>`) and values are entity ids (or arrays of them),
  not literals. `getPageV2`/`normalizeProperties` strip keys back to plain
  lowercased names and batch-resolve every referenced id to its `:block/title`
  (raw markdown like `[[Name]]`) in a single datascript query, producing the same
  flat `PageProperties` map (`string | string[]`) the renderer already consumes.
  See the module doc comment and `src/lib/api.v2.test.ts` for the exact shape.

### Settings-Driven Styles & Toggling

`getStyles()` typically reads live settings and returns styles conditionally,
e.g.:

```typescript
getStyles() {
  return getSettings().enablePrettyLinks ? linkStyles : '';
}
```

When settings change, `src/index.ts` reacts in `onSettingsChanged`:
- **Style-only settings** → call `refreshStyles()` (re-aggregates + re-injects).
- **Behavioral settings** → `registry.initializeFeature` / `destroyFeature` to
  wire up or tear down DOM observers, then `refreshStyles()`.

`getSettings()` merges `logseq.settings` over `defaultSettings` and strips
Logseq internals (like `disabled`). The settings UI schema and the
`PluginSettings` interface both live in `src/settings/schema.ts` — keep them in
sync when adding a setting.

### Style Injection & Theme Detection

All CSS is injected through a single `logseq.provideStyle()` call in
`src/core/styles.ts`. The aggregated stylesheet is:

1. **Generated theme CSS** (`src/core/theme.ts`) — auto-detects the theme's
   accent color from Logseq CSS variables and emits `--pl-accent-*` custom
   properties (with a purple fallback).
2. **Feature styles** — `registry.getAggregatedStyles()` concatenates each
   feature's `getStyles()` output.

`setupThemeObserver()` watches `class` attribute changes on `html`/`body` and
calls `refreshStyles()` (debounced) so accent colors update on theme switches.

There is no longer a `src/styles/` directory or `base.scss`/`content.scss`;
styling now lives with each feature and in the generated theme CSS.

### Popover Renderer System

Popovers use a unified, config-driven renderer that adapts to any page type:

1. **`type-config.ts`** — Property-driven inference. Classifies property names
   into roles (subtitle, detail row, tag pill) via priority-ordered lists.
   `resolveConfig(pageData)` returns a `PopoverConfig`. Adding a page type or
   property requires zero config changes.
2. **`helpers.ts`** — Shared DOM construction: title, description, tag pills,
   detail rows, smart property rendering (emails → mailto, URLs → external
   links, ratings → stars), content-snippet extraction.
3. **`unified.ts`** — The renderer, built as a section pipeline: header (with
   optional photo card) → description → snippet → detail rows → array tags →
   link section → property tags.

The **popover manager** (`manager.ts`) handles the hover lifecycle: event
delegation on `mouseenter` (capturing phase, to intercept before Logseq),
delayed show/hide timers, viewport-aware positioning, and race prevention via
anchor tracking.

### Adding a New Feature

1. Create a directory under `src/features/`
2. Implement the `Feature` interface in `index.ts`
3. Add styles in a `.scss` file (imported with `?inline`). If the DOM differs on
   v2, add a `styles.v2.scss` and return `pickStyles({ v1, v2 })`; if behavior
   differs, split into `v1.ts` + `v2.ts` strategies and pick one by `getVersion()`
4. Register the feature in `src/index.ts`
5. If it has a setting, add it to both the schema and `PluginSettings` in
   `src/settings/schema.ts`, and handle its change in `onSettingsChanged`. To
   scope a toggle to one edition, set its `versions` field in the schema
6. Add `*.test.ts` files alongside the new code

```typescript
// src/features/myfeature/index.ts
import { getSettings } from '../../settings';
import type { Feature } from '../../types';
import styles from './styles.scss?inline';

export const myFeature: Feature = {
  id: 'myfeature',
  name: 'My Feature',
  description: 'Description of what it does',
  getStyles() { return getSettings().enableMyFeature ? styles : ''; },
  init() { /* setup observers, etc. */ },
  destroy() { /* cleanup */ },
};
```

## Key Files

- **src/index.ts** - Bootstrap, feature registration, settings-change wiring
- **src/core/registry.ts** - Feature lifecycle + style aggregation
- **src/core/styles.ts** - Aggregates theme + feature styles, single `provideStyle` call
- **src/core/theme.ts** - Accent-color auto-detection + theme-change observer
- **src/core/version.ts** - Logseq edition detection (`getVersion`/`detectVersion`)
- **src/core/platform/** - Cross-version adapter (`getPlatform`, `pickStyles`)
- **src/lib/api.v2.ts** - v2 (DB) data adapter, normalizes DB property shape
- **src/settings/schema.ts** - Settings schema and `PluginSettings` interface
- **src/settings/index.ts** - `getSettings` / `initSettings` / `onSettingsChanged`
- **src/features/popovers/manager.ts** - Popover hover lifecycle
- **src/features/popovers/renderers/unified.ts** - Config-driven popover renderer
- **src/features/popovers/renderers/type-config.ts** - Property-driven inference
- **src/features/popovers/renderers/helpers.ts** - Shared popover DOM helpers
- **src/lib/api.ts** - Page data fetching with caching, property value cleanup
- **src/lib/dom.ts** - `getParentDoc`, viewport-aware positioning, element helpers

## Logseq Plugin API

Key methods used:

```typescript
// Inject CSS styles (single call for whole plugin)
logseq.provideStyle({ key: 'pretty-logseq-styles', style: cssString });

// Settings
logseq.useSettingsSchema(schema);
logseq.onSettingsChanged((newSettings, oldSettings) => { /* ... */ });

// Get page data including properties
const page = await logseq.Editor.getPage(pageName);

// Cleanup before unload
logseq.beforeunload(async () => { /* cleanup */ });
```

## Styling

Uses Logseq's CSS variables for theme compatibility (e.g.
`--ls-primary-background-color`, `--ls-border-color`, `--ls-primary-text-color`,
`--ls-secondary-text-color`, `--ls-tertiary-background-color`) plus the
plugin-generated `--pl-accent-*` variables from `theme.ts`.

## Testing

Automated tests use **Vitest** (jsdom). Tests live beside the code as
`*.test.ts`; shared fixtures, mocks, and helpers are under `test/`.

```bash
pnpm test              # Run once
pnpm test:coverage     # With coverage
```

Shared test helpers (`test/`):
- **mocks/logseq.ts** — `mockLogseqAPI()`, `mockPageData(overrides?)`,
  `mockPageWithProperties(properties)`, `mockBlockData(content, children?)`
- **fixtures/pages.ts** — sample `PageData` (`basicPage`, `personPage`,
  `resourcePage`, `codebasePage`)
- **fixtures/blocks.ts** — sample `BlockData` (`simpleBlock`,
  `blockWithProperties`, `blockWithReferences`, `nestedBlocks`, …)
- **utils/dom.ts** — `createPageRef(name)`, `createMockAnchor(rect?)`,
  `waitForElement(selector)`, `waitForPopover()`, `setViewport(w, h)`
- **setup.ts** — global test setup (loaded via `vitest.config.ts`)

Manual testing in Logseq:
1. Load plugin (select project root folder, not dist/)
2. Verify popovers on `[[page references]]`
3. Verify feature styles (properties, tables, todos, typography, top bar, sidebar)
4. Toggle features in settings and confirm live enable/disable
5. Test plugin load/unload via developer console

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`:
- **Lint & Format** — `pnpm check:ci` + `pnpm typecheck`
- **Test** — `pnpm test:coverage` (fails below the coverage thresholds in `vitest.config.ts`)
- **Build** — `pnpm build` (uploads `dist/` artifact)

Releases are handled by `.github/workflows/release.yml`; Dependabot updates are
auto-merged via `.github/workflows/dependabot-auto-merge.yml`.

## Related Repository

Works with the companion Logseq graph at `~/Documents/projects/logseq/`.

## codegraph

This project has a local code knowledge graph via [CodeGraph](https://github.com/colbymchenry/codegraph): a SQLite index under `.codegraph/` (gitignored, rebuilt per checkout) that a background daemon **auto-syncs on file changes** — no manual rebuild step. It is exposed to agents as MCP tools (`mcp__codegraph__*`) and mirrored by the `codegraph` CLI.

Rules:
- For codebase questions, orient with CodeGraph before broad grepping. `codegraph_explore` (the primary tool) answers most "how does X work / what touches Y" questions in one call — the relevant symbols' source, the call paths between them, and a blast-radius summary. Use `codegraph_impact` / `codegraph_callers` / `codegraph_callees` for change-impact. CLI equivalents: `codegraph explore "<question>"`, `codegraph impact <symbol>`, etc. These return a scoped result far smaller than raw grep output.
- The index auto-syncs, so there is normally nothing to run. If a result looks stale, `codegraph sync .` (incremental) refreshes it and `codegraph status .` shows index health. A fresh checkout with no `.codegraph/` needs a one-time `codegraph init .`.
- Grep or read raw files only after CodeGraph has oriented you, or to modify/debug specific lines.
