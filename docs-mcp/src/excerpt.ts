import { processTerm, tokenize } from './docs-index-options.ts';

export const MAX_EXCERPT_CHARS = 3_000;
const MAX_EXCERPT_WORDS = 300;
const WORDS_BEFORE_MATCH = 40;
const MAX_CONTEXT_CHARS = MAX_EXCERPT_CHARS / 2;
const ELLIPSIS = '…';
const BODY_BUDGET = MAX_EXCERPT_CHARS - 2 * ELLIPSIS.length;
const MIN_WORD_BOUNDARY_CUT = BODY_BUDGET / 2;
const WORD = /\S+/g;

interface Word {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

type Words = readonly [Word, ...Word[]];

export function excerpt(text: string, matchedTerms: readonly string[], queryTerms: readonly string[]): string {
  const words = splitWords(text);
  if (!hasWords(words)) return '';
  const firstIndex = contextStart(words, firstMatchPreferringExactTerms(words, matchedTerms, queryTerms));
  const window = words.slice(firstIndex, firstIndex + MAX_EXCERPT_WORDS);
  if (!hasWords(window)) return '';

  const body = text.slice(window[0].start, lastWord(window).end);
  const fits = body.length <= BODY_BUDGET;
  const cutAtStart = firstIndex > 0;
  const cutAtEnd = !fits || firstIndex + window.length < words.length;
  return `${cutAtStart ? ELLIPSIS : ''}${fits ? body : truncate(body, BODY_BUDGET)}${cutAtEnd ? ELLIPSIS : ''}`;
}

function splitWords(text: string): Word[] {
  return [...text.matchAll(WORD)].map((match) => ({ text: match[0], start: match.index, end: match.index + match[0].length }));
}

function hasWords(words: readonly Word[]): words is Words {
  return words.length > 0;
}

function lastWord(words: Words): Word {
  return words.reduce((_, word) => word, words[0]);
}

function firstMatchPreferringExactTerms(words: Words, matchedTerms: readonly string[], queryTerms: readonly string[]): Word {
  const exactTerms = new Set(matchedTerms.filter((term) => queryTerms.includes(term)));
  const anyTerms = new Set(matchedTerms);
  return words.find((word) => containsTerm(word, exactTerms)) ?? words.find((word) => containsTerm(word, anyTerms)) ?? words[0];
}

function containsTerm(word: Word, terms: ReadonlySet<string>): boolean {
  return tokenize(word.text).some((token) => {
    const term = processTerm(token);
    return term !== null && terms.has(term);
  });
}

function contextStart(words: Words, match: Word): number {
  const matchIndex = words.indexOf(match);
  const earliest = Math.max(0, matchIndex - WORDS_BEFORE_MATCH);
  const start = words.findIndex((word, index) => index >= earliest && match.end - word.start <= MAX_CONTEXT_CHARS);
  return start === -1 || start > matchIndex ? matchIndex : start;
}

function truncate(value: string, maxChars: number): string {
  const cut = value.slice(0, maxChars);
  const lastSpace = cut.search(/\s\S*$/);
  return (lastSpace >= MIN_WORD_BOUNDARY_CUT ? cut.slice(0, lastSpace) : cut).trimEnd();
}
