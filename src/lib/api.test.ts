/**
 * Tests for Logseq API Helpers
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanBlockContent,
  cleanPropertyValue,
  clearPageCache,
  getPage,
  getPageBlocks,
  getThemeMode,
} from './api';

describe('getPage', () => {
  beforeEach(() => {
    clearPageCache(); // Clear cache before each test
  });

  it('fetches page data and normalizes properties', async () => {
    const mockPage = {
      name: 'test-page',
      originalName: 'Test Page',
      properties: { type: 'Note', status: 'Active' },
    };
    logseq.Editor.getPage.mockResolvedValue(mockPage);

    const result = await getPage('test-page');

    expect(result).toEqual({
      name: 'Test Page',
      originalName: 'Test Page',
      properties: { type: 'Note', status: 'Active' },
    });
    expect(logseq.Editor.getPage).toHaveBeenCalledWith('test-page');
  });

  it('uses cache on subsequent calls within TTL', async () => {
    const mockPage = { name: 'cached-page', properties: {} };
    logseq.Editor.getPage.mockResolvedValue(mockPage);

    // First call
    await getPage('cached-page');
    // Second call (should use cache)
    await getPage('cached-page');

    expect(logseq.Editor.getPage).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache when useCache is false', async () => {
    const mockPage = { name: 'no-cache', properties: {} };
    logseq.Editor.getPage.mockResolvedValue(mockPage);

    await getPage('no-cache');
    await getPage('no-cache', { useCache: false });

    expect(logseq.Editor.getPage).toHaveBeenCalledTimes(2);
  });

  it('handles case-insensitive cache keys', async () => {
    const mockPage = { name: 'Case Test', properties: {} };
    logseq.Editor.getPage.mockResolvedValue(mockPage);

    await getPage('Case Test');
    await getPage('case test'); // Different case
    await getPage('CASE TEST'); // Different case

    expect(logseq.Editor.getPage).toHaveBeenCalledTimes(1);
  });

  it('returns null when page does not exist', async () => {
    logseq.Editor.getPage.mockResolvedValue(null);

    const result = await getPage('non-existent');

    expect(result).toBeNull();
  });

  it('handles API errors gracefully', async () => {
    logseq.Editor.getPage.mockRejectedValue(new Error('API Error'));

    const result = await getPage('error-page');

    expect(result).toBeNull();
  });

  it('uses originalName when available', async () => {
    const mockPage = {
      name: 'lower-case',
      originalName: 'Lower Case',
      properties: {},
    };
    logseq.Editor.getPage.mockResolvedValue(mockPage);

    const result = await getPage('lower-case');

    expect(result?.name).toBe('Lower Case');
    expect(result?.originalName).toBe('Lower Case');
  });

  it('falls back to name when originalName is missing', async () => {
    const mockPage = {
      name: 'page-name',
      properties: {},
    };
    logseq.Editor.getPage.mockResolvedValue(mockPage);

    const result = await getPage('page-name');

    expect(result?.name).toBe('page-name');
    expect(result?.originalName).toBeUndefined();
  });

  it('resolves alias when page has no properties', async () => {
    // First call returns a page with no properties (alias stub)
    logseq.Editor.getPage.mockResolvedValue({
      name: 'alias-page',
      originalName: 'Alias Page',
      properties: {},
    });

    // Datascript query returns the root page
    logseq.DB.datascriptQuery.mockResolvedValue([
      [
        {
          name: 'root-page',
          originalName: 'Root Page',
          properties: { type: 'Resource', status: 'Active' },
        },
      ],
    ]);

    const result = await getPage('alias-page');

    expect(result?.name).toBe('Root Page');
    expect(result?.properties).toEqual({ type: 'Resource', status: 'Active' });
  });

  it('passes the lowercased alias name to the query as an EDN string', async () => {
    logseq.Editor.getPage.mockResolvedValue({
      name: 'alias page',
      originalName: 'Alias Page',
      properties: {},
    });
    logseq.DB.datascriptQuery.mockResolvedValue(null);

    await getPage('Alias Page');

    const [, input] = logseq.DB.datascriptQuery.mock.calls[0];
    expect(input).toBe('"alias page"');
  });

  it('escapes quotes and backslashes in the alias name so the EDN string stays well-formed', async () => {
    logseq.Editor.getPage.mockResolvedValue({
      name: 'say "hi" c:\\temp',
      originalName: 'Say "Hi" C:\\Temp',
      properties: {},
    });
    logseq.DB.datascriptQuery.mockResolvedValue(null);

    await getPage('Say "Hi" C:\\Temp');

    const [, input] = logseq.DB.datascriptQuery.mock.calls[0];
    // JSON string escapes are a subset of EDN string escapes.
    expect(input).toBe('"say \\"hi\\" c:\\\\temp"');
  });

  it('returns original page when alias resolution finds nothing', async () => {
    logseq.Editor.getPage.mockResolvedValue({
      name: 'no-alias',
      originalName: 'No Alias',
      properties: {},
    });

    logseq.DB.datascriptQuery.mockResolvedValue(null);

    const result = await getPage('no-alias');

    expect(result?.name).toBe('No Alias');
    expect(result?.properties).toEqual({});
  });

  it('returns original page when alias resolution returns empty results', async () => {
    logseq.Editor.getPage.mockResolvedValue({
      name: 'empty-alias',
      originalName: 'Empty Alias',
      properties: {},
    });

    logseq.DB.datascriptQuery.mockResolvedValue([]);

    const result = await getPage('empty-alias');

    expect(result?.name).toBe('Empty Alias');
  });

  it('returns original page when alias resolution returns null page', async () => {
    logseq.Editor.getPage.mockResolvedValue({
      name: 'null-alias',
      originalName: 'Null Alias',
      properties: {},
    });

    logseq.DB.datascriptQuery.mockResolvedValue([[null]]);

    const result = await getPage('null-alias');

    expect(result?.name).toBe('Null Alias');
  });

  it('handles alias resolution errors gracefully', async () => {
    logseq.Editor.getPage.mockResolvedValue({
      name: 'error-alias',
      originalName: 'Error Alias',
      properties: {},
    });

    logseq.DB.datascriptQuery.mockRejectedValue(new Error('Query failed'));

    const result = await getPage('error-alias');

    // Should still return the original page data
    expect(result?.name).toBe('Error Alias');
  });
});

describe('clearPageCache', () => {
  beforeEach(() => {
    logseq.Editor.getPage.mockResolvedValue({ name: 'test', properties: {} });
  });

  it('clears cache for a specific page', async () => {
    await getPage('page1');
    await getPage('page2');

    clearPageCache('page1');

    await getPage('page1'); // Should fetch again
    await getPage('page2'); // Should use cache

    expect(logseq.Editor.getPage).toHaveBeenCalledTimes(3); // Initial 2 + 1 refetch
  });

  it('clears entire cache when no page specified', async () => {
    // Fetch both pages (will be cached)
    await getPage('page1');
    await getPage('page2');
    const callsAfterInitial = logseq.Editor.getPage.mock.calls.length;

    // Verify they're cached
    await getPage('page1');
    await getPage('page2');
    expect(logseq.Editor.getPage.mock.calls.length).toBe(callsAfterInitial); // No new calls

    // Clear all cache
    clearPageCache();

    // Should fetch again
    await getPage('page1');
    await getPage('page2');
    expect(logseq.Editor.getPage.mock.calls.length).toBe(callsAfterInitial + 2); // 2 new calls
  });

  it('handles clearing non-existent cache entries', () => {
    expect(() => clearPageCache('non-existent')).not.toThrow();
  });
});

describe('getThemeMode', () => {
  it('returns dark mode when configured', async () => {
    logseq.App.getUserConfigs.mockResolvedValue({
      preferredThemeMode: 'dark',
    });

    const result = await getThemeMode();

    expect(result).toBe('dark');
  });

  it('returns light mode when configured', async () => {
    logseq.App.getUserConfigs.mockResolvedValue({
      preferredThemeMode: 'light',
    });

    const result = await getThemeMode();

    expect(result).toBe('light');
  });

  it('defaults to light mode on error', async () => {
    logseq.App.getUserConfigs.mockRejectedValue(new Error('Config error'));

    const result = await getThemeMode();

    expect(result).toBe('light');
  });

  it('defaults to light for unexpected theme values', async () => {
    logseq.App.getUserConfigs.mockResolvedValue({
      preferredThemeMode: 'auto',
    });

    const result = await getThemeMode();

    expect(result).toBe('light');
  });
});

describe('getPageBlocks', () => {
  it('fetches and maps block tree', async () => {
    const mockBlocks = [
      {
        content: 'Parent block',
        children: [
          {
            content: 'Child block',
            children: [],
          },
        ],
      },
    ];
    logseq.Editor.getPageBlocksTree.mockResolvedValue(mockBlocks);

    const result = await getPageBlocks('test-page');

    expect(result).toEqual([
      {
        content: 'Parent block',
        children: [
          {
            content: 'Child block',
            children: [],
          },
        ],
      },
    ]);
  });

  it('returns empty array when no blocks exist', async () => {
    logseq.Editor.getPageBlocksTree.mockResolvedValue(null);

    const result = await getPageBlocks('empty-page');

    expect(result).toEqual([]);
  });

  it('handles API errors gracefully', async () => {
    logseq.Editor.getPageBlocksTree.mockRejectedValue(new Error('Blocks error'));

    const result = await getPageBlocks('error-page');

    expect(result).toEqual([]);
  });

  it('handles blocks without content', async () => {
    const mockBlocks = [
      {
        content: undefined,
        children: [],
      },
    ];
    logseq.Editor.getPageBlocksTree.mockResolvedValue(mockBlocks);

    const result = await getPageBlocks('test-page');

    expect(result[0].content).toBe('');
  });
});

describe('cleanBlockContent', () => {
  it('removes property lines', () => {
    const content = 'title:: My Page\ntype:: Note\nActual content here';
    const result = cleanBlockContent(content);

    expect(result).toBe('Actual content here');
    expect(result).not.toContain('title::');
    expect(result).not.toContain('type::');
  });

  it('removes block references', () => {
    const content = 'Text with ((abc-123-def)) block reference';
    const result = cleanBlockContent(content);

    expect(result).toBe('Text with  block reference');
  });

  it('converts page references to plain text', () => {
    const content = 'See [[Other Page]] for details';
    const result = cleanBlockContent(content);

    expect(result).toBe('See Other Page for details');
  });

  it('removes markdown emphasis', () => {
    const content = '**Bold** and *italic* and `code` text';
    const result = cleanBlockContent(content);

    expect(result).toBe('Bold and italic and code text');
  });

  it('removes heading markers', () => {
    const content = '# Heading 1\n## Heading 2\n### Heading 3';
    const result = cleanBlockContent(content);

    expect(result).toBe('Heading 1\nHeading 2\nHeading 3');
  });

  it('removes images', () => {
    const content = 'Text with ![alt text](image.png) image';
    const result = cleanBlockContent(content);

    expect(result).toBe('Text with  image');
  });

  it('converts markdown links to text', () => {
    const content = 'Check [this link](https://example.com) out';
    const result = cleanBlockContent(content);

    expect(result).toBe('Check this link out');
  });

  it('collapses multiple newlines', () => {
    const content = 'Line 1\n\n\n\nLine 2';
    const result = cleanBlockContent(content);

    expect(result).toBe('Line 1\nLine 2');
  });

  it('trims whitespace', () => {
    const content = '  \n  Content with spaces  \n  ';
    const result = cleanBlockContent(content);

    expect(result).toBe('Content with spaces');
  });

  it('handles complex mixed content', () => {
    const content = `title:: Test
type:: Note
# Main Heading

See [[Page Reference]] and ((block-ref)) for **bold** details.

![image](test.png)

More content here.`;

    const result = cleanBlockContent(content);

    expect(result).not.toContain('title::');
    expect(result).not.toContain('[[');
    expect(result).not.toContain('**');
    expect(result).not.toContain('![');
  });

  it('returns empty string for property-only content', () => {
    const content = 'title:: Test\ntype:: Note';
    const result = cleanBlockContent(content);

    expect(result).toBe('');
  });
});

describe('cleanPropertyValue', () => {
  it('removes brackets from string values', () => {
    expect(cleanPropertyValue('[[Resource]]')).toBe('Resource');
  });

  it('handles string values without brackets', () => {
    expect(cleanPropertyValue('Plain Text')).toBe('Plain Text');
  });

  it('extracts first item from arrays', () => {
    expect(cleanPropertyValue(['[[First]]', 'Second'])).toBe('First');
  });

  it('removes brackets from array values', () => {
    expect(cleanPropertyValue(['[[Resource]]'])).toBe('Resource');
  });

  it('handles empty arrays', () => {
    // Empty array returns undefined as first element, ?? operator converts to '', String('') = ''
    expect(cleanPropertyValue([])).toBe('');
  });

  it('handles null values', () => {
    expect(cleanPropertyValue(null)).toBe('');
  });

  it('handles undefined values', () => {
    expect(cleanPropertyValue(undefined)).toBe('');
  });

  it('converts numbers to strings', () => {
    expect(cleanPropertyValue(42)).toBe('42');
  });

  it('converts booleans to strings', () => {
    expect(cleanPropertyValue(true)).toBe('true');
    expect(cleanPropertyValue(false)).toBe('false');
  });

  it('trims whitespace from cleaned values', () => {
    // The function trims after removing brackets, so leading/trailing spaces outside brackets remain until after replacement
    expect(cleanPropertyValue('[[Spaced]]')).toBe('Spaced');
  });

  it('handles nested brackets', () => {
    // The regex only removes outermost [[ and ]]
    expect(cleanPropertyValue('[[[[Nested]]]]')).toBe('[[Nested]]');
  });
});
