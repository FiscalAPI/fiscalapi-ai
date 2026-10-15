// Configuración única del índice de la documentación. La importan scripts/build-data.mjs, que arma
// el índice, y src/docs.ts, que lo carga: si divergieran, las búsquedas no coincidirían con lo indexado.
import { stemmer } from '@orama/stemmers/spanish';
import { stopwords } from '@orama/stopwords/spanish';
import type { Options, SearchOptions } from 'minisearch';

/** Un documento del índice: una sección de docs.fiscalapi.com, o una página entera si no tiene secciones. */
export interface DocsDocument {
  readonly id: string;
  readonly url: string;
  readonly page: string;
  readonly title: string;
  readonly endpoint: string;
  readonly text: string;
}

const MIN_FUZZY_TERM_LENGTH = 5;
const FUZZINESS = 0.2;
// Las marcas diacríticas que NFD separa de su letra: "á" queda como "a" más el acento.
const COMBINING_MARKS = /\p{Mn}/gu;

const STOPWORDS: ReadonlySet<string> = new Set(stopwords.map(withoutAccents));

/** Minúsculas y sin acentos; descarta las palabras vacías del español y reduce el resto a su raíz. */
export function processTerm(term: string): string | null {
  const folded = withoutAccents(term.toLowerCase());
  return STOPWORDS.has(folded) ? null : stemmer(folded);
}

// Sin prefijo: con él, "sat" coincidía con cada SatXxx de las tablas de catálogos y la sección de
// catálogos de Carta Porte encabezaba consultas que no eran de catálogos. El stemmer ya cubre las
// flexiones. El fuzzy solo aplica a términos de 5 o más letras porque "sat" coincidía con "gat".
const searchOptions: SearchOptions = {
  boost: { title: 3, page: 1.5, endpoint: 2 },
  prefix: false,
  fuzzy: (term) => (term.length >= MIN_FUZZY_TERM_LENGTH ? FUZZINESS : false),
};

export const DOCS_INDEX_OPTIONS: Options<DocsDocument> = {
  fields: ['title', 'page', 'endpoint', 'text'],
  storeFields: ['title', 'page', 'url', 'text'],
  processTerm,
  searchOptions,
};

function withoutAccents(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '');
}
