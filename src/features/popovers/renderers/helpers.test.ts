/**
 * Tests for Popover Renderer Helpers
 */

import { describe, expect, it } from 'vitest';
import type { PageData } from '../../../types';
import {
  cleanAllValues,
  createAvatarSvg,
  createDescription,
  createDetailRow,
  createRatingDisplay,
  createTagPills,
  createTitle,
  extractSnippet,
  extractUrl,
  formatUrlLabel,
  renderPropertyValue,
} from './helpers';

describe('createAvatarSvg', () => {
  it('builds an inline SVG element (CSP-safe, no img src)', () => {
    const svg = createAvatarSvg();
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    // A head (circle) + body (path) silhouette, stroked with currentColor.
    expect(svg.querySelector('circle')).not.toBeNull();
    expect(svg.querySelector('path')).not.toBeNull();
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });
});

describe('extractUrl', () => {
  it('extracts plain http URL', () => {
    expect(extractUrl('http://example.com')).toBe('http://example.com');
  });

  it('extracts plain https URL', () => {
    expect(extractUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('extracts URL from markdown link', () => {
    expect(extractUrl('[Example](https://example.com)')).toBe('https://example.com');
  });

  it('returns null for non-URL string', () => {
    expect(extractUrl('just some text')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(extractUrl(null)).toBeNull();
    expect(extractUrl(undefined)).toBeNull();
  });

  it('handles array value (Logseq property format)', () => {
    expect(extractUrl(['https://example.com'])).toBe('https://example.com');
  });

  it('extracts URL from markdown link with descriptive text', () => {
    expect(extractUrl('[My Site](https://mysite.org/page)')).toBe('https://mysite.org/page');
  });
});

describe('formatUrlLabel', () => {
  it('returns path for URL with path', () => {
    expect(formatUrlLabel('https://github.com/user/repo')).toBe('user/repo');
  });

  it('returns hostname when no path', () => {
    expect(formatUrlLabel('https://example.com')).toBe('example.com');
  });

  it('returns hostname when path is just /', () => {
    expect(formatUrlLabel('https://example.com/')).toBe('example.com');
  });

  it('strips trailing slash from path', () => {
    expect(formatUrlLabel('https://github.com/user/repo/')).toBe('user/repo');
  });

  it('returns raw string for invalid URL', () => {
    expect(formatUrlLabel('not-a-url')).toBe('not-a-url');
  });
});

describe('cleanAllValues', () => {
  it('cleans a single string value', () => {
    expect(cleanAllValues('[[Hello]]')).toEqual(['Hello']);
  });

  it('cleans an array of values', () => {
    expect(cleanAllValues(['[[React]]', '[[Node]]'])).toEqual(['React', 'Node']);
  });

  it('filters out empty strings from arrays', () => {
    expect(cleanAllValues(['React', ''])).toEqual(['React']);
  });

  it('returns empty array for null', () => {
    expect(cleanAllValues(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(cleanAllValues(undefined)).toEqual([]);
  });

  it('handles numeric values', () => {
    expect(cleanAllValues(42)).toEqual(['42']);
  });
});

describe('createTitle', () => {
  it('creates an anchor element with page name', () => {
    const page: PageData = { name: 'My Page', properties: {} };
    const el = createTitle(page);

    expect(el.tagName).toBe('A');
    expect(el.textContent).toBe('My Page');
    expect(el.dataset.pageName).toBe('My Page');
    expect(el.className).toBe('pretty-popover__title');
  });

  it('prepends icon when present', () => {
    const page: PageData = {
      name: 'My Page',
      properties: { icon: '📄' },
    };
    const el = createTitle(page);

    expect(el.textContent).toBe('📄 My Page');
  });

  it('uses page name without icon when icon is absent', () => {
    const page: PageData = { name: 'Plain Page', properties: {} };
    const el = createTitle(page);

    expect(el.textContent).toBe('Plain Page');
  });

  it('cleans a [[ref]]-wrapped icon like the properties observer does', () => {
    const page: PageData = { name: 'My Page', properties: { icon: '[[📄]]' } };
    const el = createTitle(page);

    expect(el.textContent).toBe('📄 My Page');
  });

  it('uses the first element of an array-valued icon', () => {
    const page: PageData = { name: 'My Page', properties: { icon: ['📄', '📁'] } };
    const el = createTitle(page);

    expect(el.textContent).toBe('📄 My Page');
  });

  it('ignores an empty-array icon instead of rendering a leading space', () => {
    const page: PageData = { name: 'My Page', properties: { icon: [] } };
    const el = createTitle(page);

    expect(el.textContent).toBe('My Page');
  });

  it('treats a falsy icon value (false, 0) as no icon rather than stringifying it', () => {
    expect(createTitle({ name: 'My Page', properties: { icon: false } }).textContent).toBe(
      'My Page',
    );
    expect(createTitle({ name: 'My Page', properties: { icon: 0 } }).textContent).toBe('My Page');
  });
});

describe('createDescription', () => {
  it('creates a div with description text', () => {
    const el = createDescription('A short description');

    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('pretty-popover__description');
    expect(el.textContent).toBe('A short description');
  });
});

describe('createTagPills', () => {
  it('creates pill container with tag spans', () => {
    const el = createTagPills(['TypeA', 'StatusB']);

    expect(el).not.toBeNull();
    expect(el?.className).toBe('pretty-popover__properties');
    expect(el?.children.length).toBe(2);
    expect(el?.children[0].textContent).toBe('TypeA');
    expect(el?.children[1].textContent).toBe('StatusB');
  });

  it('returns null for empty array', () => {
    expect(createTagPills([])).toBeNull();
  });

  it('uses custom container class when provided', () => {
    const el = createTagPills(['tag1'], 'custom-class');
    expect(el?.className).toBe('custom-class');
  });

  it('creates spans with tag class', () => {
    const el = createTagPills(['tag1']);
    const span = el?.querySelector('.pretty-popover__tag');
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe('tag1');
  });
});

describe('createDetailRow', () => {
  it('creates a row with label and value', () => {
    const valueEl = document.createElement('span');
    valueEl.textContent = 'some value';

    const row = createDetailRow('Label', valueEl);

    expect(row.className).toBe('pretty-popover__detail-row');
    const label = row.querySelector('.pretty-popover__detail-label');
    expect(label?.textContent).toBe('Label');
    expect(row.contains(valueEl)).toBe(true);
  });
});

describe('renderPropertyValue', () => {
  it('renders rating as star display', () => {
    const el = renderPropertyValue('rating', 3);
    expect(el.className).toBe('pretty-popover__rating');
    expect(el.textContent).toBe('★★★☆☆');
  });

  it('renders email as mailto link', () => {
    const el = renderPropertyValue('email', 'test@example.com');
    expect(el.tagName).toBe('A');
    expect((el as HTMLAnchorElement).href).toBe('mailto:test@example.com');
    expect(el.textContent).toBe('test@example.com');
    expect(el.className).toBe('pretty-popover__detail-link');
  });

  it('renders phone as tel link', () => {
    const el = renderPropertyValue('phone', '555-1234');
    expect(el.tagName).toBe('A');
    expect((el as HTMLAnchorElement).href).toBe('tel:555-1234');
    expect(el.textContent).toBe('555-1234');
  });

  it('renders url as external link', () => {
    const el = renderPropertyValue('url', 'https://github.com/user/repo');
    expect(el.tagName).toBe('A');
    expect((el as HTMLAnchorElement).href).toBe('https://github.com/user/repo');
    expect((el as HTMLAnchorElement).target).toBe('_blank');
    expect(el.textContent).toBe('user/repo');
  });

  it('renders repository as external link', () => {
    const el = renderPropertyValue('repository', 'https://github.com/org/project');
    expect(el.tagName).toBe('A');
    expect(el.textContent).toBe('org/project');
  });

  it('renders url as plain text when not a valid URL', () => {
    const el = renderPropertyValue('url', 'not a url');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toBe('pretty-popover__detail-value');
    expect(el.textContent).toBe('not a url');
  });

  it('renders unknown properties as plain text', () => {
    const el = renderPropertyValue('location', 'NYC');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toBe('pretty-popover__detail-value');
    expect(el.textContent).toBe('NYC');
  });
});

describe('createRatingDisplay', () => {
  it('renders full stars', () => {
    const el = createRatingDisplay(5);
    expect(el.textContent).toBe('★★★★★');
    expect(el.title).toBe('5 / 5');
  });

  it('renders mixed filled and empty stars', () => {
    const el = createRatingDisplay(3);
    expect(el.textContent).toBe('★★★☆☆');
  });

  it('renders zero stars', () => {
    const el = createRatingDisplay(0);
    expect(el.textContent).toBe('☆☆☆☆☆');
  });

  it('clamps rating above 5', () => {
    const el = createRatingDisplay(7);
    expect(el.textContent).toBe('★★★★★');
  });

  it('clamps negative rating to 0', () => {
    const el = createRatingDisplay(-2);
    expect(el.textContent).toBe('☆☆☆☆☆');
  });

  it('floors fractional ratings', () => {
    const el = createRatingDisplay(3.7);
    expect(el.textContent).toBe('★★★☆☆');
  });

  it('falls back to plain text for non-numeric values', () => {
    const el = createRatingDisplay('Great');
    expect(el.textContent).toBe('Great');
  });

  it('handles string number values', () => {
    const el = createRatingDisplay('4');
    expect(el.textContent).toBe('★★★★☆');
  });

  it('has rating class', () => {
    const el = createRatingDisplay(3);
    expect(el.className).toBe('pretty-popover__rating');
  });
});

describe('extractSnippet', () => {
  it('returns null when no blocks', () => {
    const page: PageData = { name: 'P', properties: {}, blocks: [] };
    expect(extractSnippet(page)).toBeNull();
  });

  it('returns null when blocks is undefined', () => {
    const page: PageData = { name: 'P', properties: {} };
    expect(extractSnippet(page)).toBeNull();
  });

  it('extracts plain text from blocks', () => {
    const page: PageData = {
      name: 'P',
      properties: {},
      blocks: [{ content: 'Hello world' }],
    };
    expect(extractSnippet(page)).toEqual([{ text: 'Hello world', heading: false }]);
  });

  it('returns separate parts for multiple blocks', () => {
    const page: PageData = {
      name: 'P',
      properties: {},
      blocks: [{ content: 'First block' }, { content: 'Second block' }],
    };
    expect(extractSnippet(page)).toEqual([
      { text: 'First block', heading: false },
      { text: 'Second block', heading: false },
    ]);
  });

  it('strips property lines from blocks', () => {
    const page: PageData = {
      name: 'P',
      properties: {},
      blocks: [{ content: 'type:: Note\nActual content here' }],
    };
    expect(extractSnippet(page)).toEqual([{ text: 'Actual content here', heading: false }]);
  });

  it('cleans page references from blocks', () => {
    const page: PageData = {
      name: 'P',
      properties: {},
      blocks: [{ content: 'See [[Other Page]] for details' }],
    };
    expect(extractSnippet(page)).toEqual([{ text: 'See Other Page for details', heading: false }]);
  });

  it('skips empty blocks', () => {
    const page: PageData = {
      name: 'P',
      properties: {},
      blocks: [{ content: '' }, { content: 'Real content' }],
    };
    expect(extractSnippet(page)).toEqual([{ text: 'Real content', heading: false }]);
  });

  it('returns null when all blocks are empty', () => {
    const page: PageData = {
      name: 'P',
      properties: {},
      blocks: [{ content: '' }, { content: 'type:: Note' }],
    };
    expect(extractSnippet(page)).toBeNull();
  });

  it('truncates at word boundary when exceeding maxLength', () => {
    const longText = 'word '.repeat(200).trim();
    const page: PageData = {
      name: 'P',
      properties: {},
      blocks: [{ content: longText }],
    };
    const snippet = extractSnippet(page, 50);
    expect(snippet).not.toBeNull();
    expect(snippet).toHaveLength(1);
    const text = snippet?.[0].text;
    expect(text.length).toBeLessThanOrEqual(51); // 50 + ellipsis char
    expect(text.endsWith('\u2026')).toBe(true);
  });

  it('does not truncate when within maxLength', () => {
    const page: PageData = {
      name: 'P',
      properties: {},
      blocks: [{ content: 'Short text' }],
    };
    expect(extractSnippet(page, 100)).toEqual([{ text: 'Short text', heading: false }]);
  });
});
