import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import MiniSearch from 'minisearch';

import { DOCS_INDEX_OPTIONS, processTerm } from './docs-search.js';
import type { DocsDocument } from './docs-search.js';

export interface DocsResult {
  readonly title: string;
  readonly page: string;
  readonly url: string;
  readonly excerpt: string;
}

// Unos 750 tokens por resultado: 10 resultados caben en el límite de unos 10k tokens por respuesta.
export const MAX_EXCERPT_WORDS = 300;
export const MAX_EXCERPT_CHARS = 3_000;
// Contexto antes de la primera coincidencia, para que se lea de qué habla.
const WORDS_BEFORE_MATCH = 40;
const ELLIPSIS = '…';
const WORD = /\S+/g;

type StoredFields = Pick<DocsDocument, 'title' | 'page' | 'url' | 'text'>;

/** Índice léxico de docs.fiscalapi.com generado por scripts/build-data.mjs; se consulta sin red. */
export class DocsIndex {
  readonly #index: MiniSearch<DocsDocument>;

  private constructor(index: MiniSearch<DocsDocument>) {
    this.#index = index;
  }

  /** dataDir debe terminar en "/" para que las rutas relativas se resuelvan dentro de él. */
  static load(dataDir: URL): DocsIndex {
    const indexFile = new URL('docs-index.json', dataDir);
    try {
      return new DocsIndex(MiniSearch.loadJSON<DocsDocument>(readFileSync(indexFile, 'utf8'), DOCS_INDEX_OPTIONS));
    } catch (error) {
      throw new Error(`No se pudo leer el índice de la documentación (${fileURLToPath(indexFile)}). Corre npm run build:data.`, {
        cause: error,
      });
    }
  }

  /** Los limit resultados más relevantes, cada uno con un extracto alrededor de su primera coincidencia. */
  search(query: string, limit: number): DocsResult[] {
    return this.#index
      .search(query)
      .slice(0, limit)
      .map((result) => {
        const { title, page, url, text } = result as unknown as StoredFields;
        return { title, page, url, excerpt: excerpt(text, result.terms, result.queryTerms) };
      });
  }
}

const tokenize: (text: string) => string[] = MiniSearch.getDefault('tokenize');

/**
 * Hasta 300 palabras y 3,000 caracteres del texto, desde unas 40 palabras antes de la primera que
 * coincidió con la consulta. Así "CFDI40147" muestra la fila de esa tabla y no el inicio de la tabla.
 */
function excerpt(text: string, matchedTerms: readonly string[], queryTerms: readonly string[]): string {
  const words = [...text.matchAll(WORD)];
  if (words.length === 0) return '';
  const first = firstWord(words, firstMatch(words, matchedTerms, queryTerms));
  const last = Math.min(words.length, first + MAX_EXCERPT_WORDS) - 1;
  const budget = MAX_EXCERPT_CHARS - 2 * ELLIPSIS.length;
  let body = text.slice(words[first]!.index, endOf(words[last]!));
  let cutAtEnd = last < words.length - 1;
  if (body.length > budget) {
    body = cutAtWhitespace(body, budget);
    cutAtEnd = true;
  }
  return `${first > 0 ? ELLIPSIS : ''}${body}${cutAtEnd ? ELLIPSIS : ''}`;
}

// Primero una coincidencia exacta con la consulta: el fuzzy hace que "CFDI40147" también coincida con
// CFDI40101, que está antes en la misma tabla. Si no hay exacta, la primera coincidencia cualquiera, y
// si la coincidencia fue solo en el título, el inicio del texto.
function firstMatch(words: readonly RegExpExecArray[], matchedTerms: readonly string[], queryTerms: readonly string[]): number {
  const exact = new Set(matchedTerms.filter((term) => queryTerms.includes(term)));
  const any = new Set(matchedTerms);
  for (const terms of [exact, any]) {
    const index = words.findIndex((word) => tokenize(word[0]).some((token) => terms.has(processTerm(token) ?? '')));
    if (index >= 0) return index;
  }
  return 0;
}

// Retrocede hasta 40 palabras, pero sin que la coincidencia quede fuera del límite de caracteres
// (una fila de tabla sin espacios podría medir más que todo el extracto).
function firstWord(words: readonly RegExpExecArray[], match: number): number {
  const matchEnd = endOf(words[match]!);
  let first = Math.max(0, match - WORDS_BEFORE_MATCH);
  while (first < match && matchEnd - words[first]!.index > MAX_EXCERPT_CHARS / 2) first++;
  return first;
}

function endOf(word: RegExpExecArray): number {
  return word.index + word[0].length;
}

function cutAtWhitespace(value: string, maxChars: number): string {
  const cut = value.slice(0, maxChars);
  const lastSpace = cut.search(/\s\S*$/);
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
