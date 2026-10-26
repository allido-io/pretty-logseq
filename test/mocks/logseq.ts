/**
 * Logseq API Mocks
 *
 * Mock implementations of the Logseq Plugin API for testing.
 */

import { vi } from 'vitest';
import type { PageData } from '../../src/types';

export function mockLogseqAPI() {
  return {
    ready: vi.fn((fn: () => Promise<void>) => Promise.resolve(fn())),
    beforeunload: vi.fn(),
    provideStyle: vi.fn(),
    provideUI: vi.fn(),
    useSettingsSchema: vi.fn(),
    onSettingsChanged: vi.fn(),
    settings: { disabled: false } as { disabled: boolean } & Record<string, unknown>,

    Editor: {
      getPage: vi.fn(),
      getPageBlocksTree: vi.fn(),
      getCurrentPage: vi.fn(),
    },

    App: {
      getUserConfigs: vi.fn().mockResolvedValue({
        preferredThemeMode: 'light',
      }),
      pushState: vi.fn(),
      getCurrentGraph: vi.fn().mockResolvedValue({
        name: 'test-graph',
        url: 'logseq_local_/home/user/test-graph',
        path: '/home/user/test-graph',
      }),
      getCurrentGraphFavorites: vi.fn().mockResolvedValue([]),
      setCurrentGraphConfigs: vi.fn().mockResolvedValue(undefined),
      invokeExternalCommand: vi.fn().mockResolvedValue(undefined),
      onRouteChanged: vi.fn(),
      onThemeChanged: vi.fn(),
      onThemeModeChanged: vi.fn(),
    },

    DB: {
      datascriptQuery: vi.fn().mockResolvedValue(null),
    },

    Settings: {
      registerSettings: vi.fn(),
      on: vi.fn(),
    },
  };
}

export function mockPageData(overrides: Partial<PageData> = {}): PageData {
  return {
    name: 'Test Page',
    originalName: 'Test Page',
    properties: {},
    ...overrides,
  };
}

export function mockPageWithProperties(properties: Record<string, unknown>): PageData {
  return mockPageData({
    properties,
  });
}
