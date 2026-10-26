import { getParentDoc } from '../lib/dom';
import { getPlatform } from './platform';

const GRAY_PATTERN = /^rgb\((\d+),\s*\1,\s*\1\)$/;

function isUsableColor(color: string): boolean {
  return !!color && color !== 'rgb(0, 0, 0)' && !GRAY_PATTERN.test(color);
}

function getAccentColor(): string | null {
  const doc = getParentDoc();
  const { accentVars, accentFallbackSelector, accentAttr, accentColorMap } = getPlatform().theme;

  // Highest priority: the user's explicit accent choice, if the version exposes
  // it as an attribute on `<html>` (v2 `data-color`). An unmapped value falls
  // through to the CSS-var probe below.
  if (accentAttr && accentColorMap) {
    const name = doc.documentElement.getAttribute(accentAttr);
    const mapped = name ? accentColorMap[name] : undefined;
    if (mapped && isUsableColor(mapped)) return mapped;
  }

  const probe = doc.createElement('span');
  doc.body.appendChild(probe);

  for (const varName of accentVars) {
    probe.style.color = `var(${varName})`;
    const color = getComputedStyle(probe).color;

    if (isUsableColor(color)) {
      probe.remove();
      return color;
    }
  }

  probe.remove();

  // Fallback: try to find a link element with accent color
  const link = doc.querySelector(accentFallbackSelector);

  if (link) {
    const color = getComputedStyle(link).color;
    if (isUsableColor(color)) return color;
  }

  return null;
}

function parseRGB(color: string): { r: number; g: number; b: number } | null {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

  if (match) {
    return {
      r: Number.parseInt(match[1], 10),
      g: Number.parseInt(match[2], 10),
      b: Number.parseInt(match[3], 10),
    };
  }

  return null;
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Whether the current theme renders on a dark background. Probes the primary
 * background color and compares its relative luminance. Defaults to dark when
 * the color can't be read.
 */
function isDarkTheme(): boolean {
  const doc = getParentDoc();
  const probe = doc.createElement('span');
  probe.style.color = 'var(--ls-primary-background-color)';
  doc.body.appendChild(probe);
  const bg = getComputedStyle(probe).color;
  probe.remove();

  const rgb = parseRGB(bg);
  if (!rgb) return true;

  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance < 128;
}

/** Linear mix of a channel toward a target (0..1 amount). */
function mixChannel(channel: number, target: number, amount: number): number {
  return Math.round(channel + (target - channel) * amount);
}

export function generateThemeCSS(): string {
  const accentColor = getAccentColor();

  // Default purple fallback
  let r = 139,
    g = 92,
    b = 246;
  let accent = `rgb(${r}, ${g}, ${b})`;

  if (accentColor) {
    const rgb = parseRGB(accentColor);

    if (rgb) {
      r = rgb.r;
      g = rgb.g;
      b = rgb.b;
      accent = accentColor;
    }
  }

  // A high-contrast variant of the accent for glyphs/text that sit on a
  // same-hue tinted chip (where the raw accent reads as low-contrast). Lighten
  // toward white on dark themes; darken toward black on light themes.
  const dark = isDarkTheme();
  const brightTarget = dark ? 255 : 0;
  const brightAmount = dark ? 0.6 : 0.35;
  const br = mixChannel(r, brightTarget, brightAmount);
  const bg = mixChannel(g, brightTarget, brightAmount);
  const bb = mixChannel(b, brightTarget, brightAmount);
  const accentBright = `rgb(${br}, ${bg}, ${bb})`;

  // Generate CSS with actual color values
  return `
/* Pretty Logseq Theme Colors (auto-detected) */
:root {
  --pl-accent: ${accent};
  --pl-accent-text: ${accent};
  --pl-accent-bright: ${accentBright};
  --pl-accent-subtle: ${rgba(r, g, b, 0.1)};
  --pl-accent-light: ${rgba(r, g, b, 0.15)};
  --pl-accent-medium: ${rgba(r, g, b, 0.25)};
  --pl-accent-strong: ${rgba(r, g, b, 0.35)};
  --pl-accent-border: ${rgba(r, g, b, 0.4)};
  --pl-accent-border-strong: ${rgba(r, g, b, 0.6)};
}
`;
}

/**
 * Re-detect the accent once the theme's CSS variables are available.
 *
 * At cold app startup the plugin loads before Logseq applies the active theme's
 * stylesheet, so the first `getAccentColor()` probe reads no usable accent and
 * `generateThemeCSS()` falls back to the default purple. No attribute change
 * fires for an already-active theme, so the MutationObserver never corrects it
 * (the user would have to manually reload the plugin). This polls until a usable
 * accent resolves and the value stops changing (theme fully settled), refreshing
 * each time so styles converge on the real accent, then stops.
 *
 * @param onReady - callback to invoke when the accent should be re-applied
 */
export function detectAccentWhenReady(onReady: () => void): void {
  const intervalMs = 200;
  const maxAttempts = 25; // ~5s ceiling before giving up (keeps the fallback)
  let attempts = 0;
  let stableCount = 0;
  let last: string | null = null;

  const tick = (): void => {
    attempts += 1;
    const current = getAccentColor();

    if (current !== null) {
      // A usable accent is readable — apply it, and track whether it has settled
      // (a theme may briefly expose a default accent before its own override lands).
      onReady();
      stableCount = current === last ? stableCount + 1 : 0;
      last = current;
    }

    if (stableCount >= 2 || attempts >= maxAttempts) return;
    setTimeout(tick, intervalMs);
  };

  setTimeout(tick, intervalMs);
}

/**
 * Setup theme color observer to update when theme changes
 * @param onThemeChange - callback to invoke when theme changes (should refresh styles)
 */
export function setupThemeObserver(onThemeChange: () => void): void {
  const doc = getParentDoc();

  // One theme switch produces several signals within a few ms (html + body
  // class flips, the accent attribute, and both Logseq hooks). Each refresh
  // re-probes the DOM and re-injects the whole stylesheet, so coalesce them
  // into a single trailing-edge call 100ms after the last signal.
  let pending: ReturnType<typeof setTimeout> | undefined;
  const schedule = (): void => {
    clearTimeout(pending);
    pending = setTimeout(onThemeChange, 100);
  };

  // Logseq's own theme/mode change events are the reliable signal for a *live*
  // theme switch — those don't always flip a watched attribute on html/body, so
  // the MutationObserver below can miss them. Guarded so tests (and any host
  // lacking the hook) don't break.
  logseq.App?.onThemeChanged?.(schedule);
  logseq.App?.onThemeModeChanged?.(schedule);

  // Attributes whose change may flip the accent: `class` (dark/light + skins) and
  // the version's accent attribute (v2 `data-color`), if any. Resolved per
  // mutation rather than once here: a `logseqVersion` override change re-detects
  // the version without re-running this setup, so the watched set must follow
  // the platform that is active when the mutation arrives.
  const isWatched = (attr: string): boolean =>
    attr === 'class' || attr === getPlatform().theme.accentAttr;

  // Re-inject when theme might change (class / accent-attr changes on html/body)
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.attributeName && isWatched(mutation.attributeName)) {
        schedule();
        break;
      }
    }
  });

  observer.observe(doc.documentElement, { attributes: true });
  observer.observe(doc.body, { attributes: true });
}
