import { afterEach, expect, it, vi } from 'vitest';

import { TOOL_NAMES } from '../src/tools/tool-conventions.ts';
import { callTool, connectClient, jsonAt, textOf } from './helpers.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('loads its data and answers every tool without calling fetch', async () => {
  const fetch = vi.fn(() => {
    throw new Error('The server must not use the network.');
  });
  vi.stubGlobal('fetch', fetch);

  const { client, close } = await connectClient();
  try {
    const { tools } = await client.listTools();
    const contract = await callTool(client, TOOL_NAMES.getOperation, { operationId: 'createInvoice' });
    const docs = await callTool(client, TOOL_NAMES.searchDocs, { query: 'cancelar factura' });

    expect(tools).toHaveLength(Object.keys(TOOL_NAMES).length);
    expect(jsonAt(JSON.parse(textOf(contract)), 'operationId')).toBe('createInvoice');
    expect(docs.isError).toBeFalsy();
    expect(textOf(docs)).toContain('https://docs.fiscalapi.com/');
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await close();
  }
});
