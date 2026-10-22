import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MAX_EXCERPT_CHARS } from '../src/excerpt.ts';
import { SEARCH_LIMITS } from '../src/tools/search-docs-tool.ts';
import { TOOL_NAMES } from '../src/tools/tool-conventions.ts';
import { callTool, connectClient, textOf } from './helpers.ts';
import type { ConnectedClient } from './helpers.ts';

const MAX_RESULT_OVERHEAD_CHARS = 400;
const MAX_RESPONSE_CHARS = SEARCH_LIMITS.maxResults * (MAX_EXCERPT_CHARS + MAX_RESULT_OVERHEAD_CHARS);
const RESULT_URL = /^https:\/\/docs\.fiscalapi\.com\/\S+\.md$/gm;

let connection: ConnectedClient;

beforeAll(async () => {
  connection = await connectClient();
});

afterAll(async () => {
  await connection.close();
});

function searchDocs(args: Record<string, unknown>) {
  return callTool(connection.client, TOOL_NAMES.searchDocs, args);
}

describe(TOOL_NAMES.searchDocs, () => {
  it('is listed as a read-only tool that requires a query', async () => {
    const { tools } = await connection.client.listTools();

    const tool = tools.find((candidate) => candidate.name === TOOL_NAMES.searchDocs);
    expect(tool?.title).toBe('Buscar en la documentación de FiscalAPI');
    expect(tool?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    expect(tool?.inputSchema.required).toEqual(['query']);
  });

  it('returns the table row of a PAC error code', async () => {
    const result = await searchDocs({ query: 'CFDI40147' });
    const text = textOf(result);

    expect(result.isError).toBeFalsy();
    expect(text).toMatch(/^FiscalAPI docs: \d+ resultados para "CFDI40147"\./);
    expect(text).toContain('https://docs.fiscalapi.com/errors/cfdi-40/errores-cfdi-4-0.md');
    expect(text).toContain('| CFDI40147 |');
  });

  it('honors limit', async () => {
    const text = textOf(await searchDocs({ query: 'factura', limit: 2 }));

    expect(text.match(RESULT_URL)).toHaveLength(2);
  });

  it(`returns ${SEARCH_LIMITS.defaultResults} results by default`, async () => {
    const text = textOf(await searchDocs({ query: 'factura' }));

    expect(text.match(RESULT_URL)).toHaveLength(SEARCH_LIMITS.defaultResults);
  });

  it('titles a section with its page in parentheses', async () => {
    const text = textOf(await searchDocs({ query: 'cancelar una factura', limit: 1 }));

    expect(text).toMatch(/^FiscalAPI docs: 1 resultado para "cancelar una factura"\./);
    expect(text).toMatch(/^## Cancelar factura \(.+\)$/m);
  });

  it('does not repeat the page title when the result is a whole page', async () => {
    const text = textOf(await searchDocs({ query: 'catálogos sat', limit: 1 }));

    expect(text).toContain('## Catálogos SAT\nhttps://docs.fiscalapi.com/catalogs-info.md\n');
  });

  it.each(['factura', 'CFDI40147', 'modelo factura', 'catálogo'])('with the maximum limit, "%s" fits the size limit', async (query) => {
    const text = textOf(await searchDocs({ query, limit: SEARCH_LIMITS.maxResults }));

    expect(text.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
  });

  it('answers without error and suggests rephrasing when nothing matches', async () => {
    const result = await searchDocs({ query: 'zzzqqq' });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('no hay resultados para "zzzqqq"');
    expect(textOf(result)).toContain(TOOL_NAMES.listOperations);
  });

  it('truncates the echoed query', async () => {
    const echoed = SEARCH_LIMITS.maxEchoedQueryChars;
    const text = textOf(await searchDocs({ query: `${'a'.repeat(echoed + 50)} zzzqqq` }));

    expect(text).toContain(`"${'a'.repeat(echoed)}…"`);
    expect(text).not.toContain('a'.repeat(echoed + 1));
  });

  it.each([
    ['limit 0', { query: 'factura', limit: 0 }],
    ['a limit above the maximum', { query: 'factura', limit: SEARCH_LIMITS.maxResults + 1 }],
    ['a non-integer limit', { query: 'factura', limit: 2.5 }],
    ['an empty query', { query: '' }],
    ['a query above the maximum length', { query: 'a'.repeat(SEARCH_LIMITS.maxQueryChars + 1) }],
    ['a missing query', {}],
  ])('rejects %s', async (_, args) => {
    const result = await searchDocs(args);

    expect(result.isError).toBe(true);
    expect(textOf(result)).not.toContain('FiscalAPI docs:');
  });
});
