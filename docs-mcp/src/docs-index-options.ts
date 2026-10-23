import { stemmer } from '@orama/stemmers/spanish';
import { stopwords } from '@orama/stopwords/spanish';
import type { Options, SearchOptions } from 'minisearch';

export interface DocsSection {
  readonly id: string;
  readonly url: string;
  readonly page: string;
  readonly title: string;
  readonly endpoint: string;
  readonly text: string;
}

const MIN_FUZZY_TERM_LENGTH = 5;
const FUZZINESS = 0.2;
const COMBINING_MARKS = /\p{Mn}/gu;
const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u;

const STOPWORDS: ReadonlySet<string> = new Set(stopwords.map(withoutAccents));

export function tokenize(text: string): string[] {
  return text.split(SPACE_OR_PUNCTUATION);
}

export function processTerm(term: string): string | null {
  const folded = withoutAccents(term.toLowerCase());
  return STOPWORDS.has(folded) ? null : stemmer(folded);
}

const searchOptions: SearchOptions = {
  boost: { title: 3, page: 1.5, endpoint: 2 },
  prefix: false,
  fuzzy: (term) => (term.length >= MIN_FUZZY_TERM_LENGTH ? FUZZINESS : false),
};

export const DOCS_INDEX_OPTIONS: Options<DocsSection> = {
  fields: ['title', 'page', 'endpoint', 'text'],
  storeFields: ['title', 'page', 'url', 'text'],
  tokenize,
  processTerm,
  searchOptions,
};

function withoutAccents(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '');
}
