import type { BlockData, PageData } from '../../types';
import type { LogseqVersion } from '../version';

/**
 * DOM selectors that differ between Logseq versions. Features read these instead
 * of hardcoding class names, so a v1↔v2 difference is a single edit in a platform.
 */
export interface PlatformSelectors {
  /** Root element the content MutationObservers attach to. */
  observerRoot: string;
  /** A rendered block. */
  block: string;
  /** A block's own content wrapper (excludes its children). */
  blockContent: string;
  /** Page-reference / tag hover triggers (popovers). */
  pageRef: string;
  /** External-link anchors (favicons + link preview cards). */
  externalLink: string;
  /** Page title heading (favorite-star injection). */
  pageTitle: string;
  /** Property key cells inside the page-properties block. */
  propertyKey: string;
}

/**
 * Version-specific data access. Implementations normalize to the shared
 * `PageData`/`BlockData` shapes so consumers (e.g. the popover renderer) stay
 * version-agnostic.
 */
export interface PlatformApi {
  getPageData(name: string, options?: { useCache?: boolean }): Promise<PageData | null>;
  getPageBlocks(name: string): Promise<BlockData[]>;
  getFavorites(): Promise<string[]>;
  /**
   * Favorite or unfavorite `pageName`. The write mechanism differs by edition, so
   * this is a platform method rather than a shared list-write: v1 rewrites the
   * `:favorites` graph config, while v2 (DB) has no config `:favorites` key and
   * instead invokes the built-in `logseq.page/toggle-favorite` command (which
   * acts on the *current* page — the only page the favorite star is shown on).
   */
  toggleFavorite(pageName: string, shouldFavorite: boolean): Promise<void>;
}

/** Theme accent-color detection inputs, which vary by Logseq skin/version. */
export interface PlatformTheme {
  /** Accent CSS custom properties, probed in order. */
  accentVars: string[];
  /** Fallback selector whose computed color is used if the vars miss. */
  accentFallbackSelector: string;
  /**
   * Attribute on the host `<html>` holding the user's chosen accent name, if the
   * version exposes one (v2 writes `data-color="violet"` etc. from its settings
   * accent picker). Read before probing so the plugin matches the user's exact
   * choice rather than inferring it. Omit on versions without such an attribute.
   */
  accentAttr?: string;
  /**
   * Maps an `accentAttr` value to an `rgb(...)` string. A value not in the map
   * (or a missing attribute) falls through to the CSS-var probe, so an unknown
   * accent name is a safe no-op rather than a wrong color.
   */
  accentColorMap?: Record<string, string>;
}

/** The active version's adapter: all version-specific knowledge in one object. */
export interface Platform {
  version: LogseqVersion;
  selectors: PlatformSelectors;
  api: PlatformApi;
  theme: PlatformTheme;
}
