import { describe, expect, it } from 'vitest';

import { processTerm } from '../src/docs-index-options.ts';
import { excerpt, MAX_EXCERPT_CHARS } from '../src/excerpt.ts';

function termsOf(word: string): string[] {
  const term = processTerm(word);
  return term === null ? [] : [term];
}

describe('excerpt', () => {
  it('returns short text unchanged when it matches at the start', () => {
    expect(excerpt('Cancelar factura ante el SAT.', termsOf('Cancelar'), termsOf('Cancelar'))).toBe('Cancelar factura ante el SAT.');
  });

  it('starts near the first exact match and marks both cuts with an ellipsis', () => {
    const filler = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(' ');
    const text = `${filler} CFDI40147 ${filler}`;

    const result = excerpt(text, termsOf('CFDI40147'), termsOf('CFDI40147'));

    expect(result.startsWith('…')).toBe(true);
    expect(result.endsWith('…')).toBe(true);
    expect(result).toContain('CFDI40147');
    expect(result.length).toBeLessThanOrEqual(MAX_EXCERPT_CHARS);
  });

  it('prefers an exact match over an earlier fuzzy match', () => {
    const filler = Array.from({ length: 200 }, (_, i) => `relleno${i}`).join(' ');
    const text = `CFDI40101 ${filler} CFDI40147 final`;

    const result = excerpt(text, [...termsOf('CFDI40101'), ...termsOf('CFDI40147')], termsOf('CFDI40147'));

    expect(result).toContain('CFDI40147');
    expect(result).not.toContain('CFDI40101');
  });

  it('cuts inside a single token longer than the limit instead of dropping it', () => {
    const longToken = 'x'.repeat(MAX_EXCERPT_CHARS * 2);

    const result = excerpt(`intro ${longToken} fin`, termsOf('intro'), termsOf('intro'));

    expect(result.length).toBeLessThanOrEqual(MAX_EXCERPT_CHARS);
    expect(result.length).toBeGreaterThan(MAX_EXCERPT_CHARS / 2);
  });

  it('returns an empty string for empty text', () => {
    expect(excerpt('   ', [], [])).toBe('');
  });
});
