import { getPage, getPageBlocks } from '../../lib/api';
import type { Platform } from './types';

/**
 * Logseq v1 (file/markdown) platform. This is the source of truth for today's
 * behavior; `v2` starts by mirroring it (see `./v2`).
 */
export const v1Platform: Platform = {
  version: 'v1',

  selectors: {
    observerRoot: '#main-content-container',
    block: '.ls-block',
    blockContent: '.block-content-wrapper',
    pageRef: '.page-ref, .tag',
    externalLink: 'a.external-link',
    pageTitle: 'h1.title',
    propertyKey: '.page-properties .page-property-key',
  },

  api: {
    getPageData: (name, options) => getPage(name, options),
    getPageBlocks: name => getPageBlocks(name),
    getFavorites: async () => (await logseq.App.getCurrentGraphFavorites()) || [],
    toggleFavorite: async (pageName, shouldFavorite) => {
      // v1 stores favorites in the graph config; rewrite the list. Read current
      // favorites first to preserve the other entries' original case.
      const current = (await logseq.App.getCurrentGraphFavorites()) || [];
      const lower = pageName.toLowerCase();
      const favorites = shouldFavorite
        ? [...current, pageName]
        : current.filter(name => name.toLowerCase() !== lower);
      await logseq.App.setCurrentGraphConfigs({ favorites });
    },
  },

  theme: {
    accentVars: [
      '--ls-link-text-color',
      '--lx-accent-09',
      '--ls-active-primary-color',
      '--ls-link-ref-text-color',
    ],
    accentFallbackSelector: 'a.page-ref, .page-property-value a',
  },
};
