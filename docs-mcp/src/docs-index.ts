import MiniSearch from 'minisearch';
import * as z from 'zod/v4';

import { DATA_FILES, readDataFile } from './data-files.ts';
import { DOCS_INDEX_OPTIONS } from './docs-index-options.ts';
import type { DocsSection } from './docs-index-options.ts';
import { excerpt } from './excerpt.ts';

export interface DocsSearchResult {
  readonly title: string;
  readonly page: string;
  readonly url: string;
  readonly excerpt: string;
}

export interface DocsSearch {
  search(query: string, limit: number): DocsSearchResult[];
}

const storedSectionSchema = z.object({
  title: z.string(),
  page: z.string(),
  url: z.string(),
  text: z.string(),
});

const serializedIndexSchema = z.object({
  storedFields: z.record(z.string(), storedSectionSchema),
});

export class DocsIndex implements DocsSearch {
  readonly #index: MiniSearch<DocsSection>;

  private constructor(index: MiniSearch<DocsSection>) {
    this.#index = index;
  }

  static load(dataDir: URL): DocsIndex {
    return new DocsIndex(
      readDataFile(dataDir, DATA_FILES.docsIndex, (json) => {
        serializedIndexSchema.parse(JSON.parse(json));
        return MiniSearch.loadJSON<DocsSection>(json, DOCS_INDEX_OPTIONS);
      }),
    );
  }

  search(query: string, limit: number): DocsSearchResult[] {
    return this.#index
      .search(query)
      .slice(0, limit)
      .map((result) => {
        const { title, page, url, text } = storedSectionSchema.parse(result);
        return { title, page, url, excerpt: excerpt(text, result.terms, result.queryTerms) };
      });
  }
}
