import { afterEach, expect, it, vi } from 'vitest';

import { callTool, connectClient, textOf } from './helpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('arranca y responde sin red: nunca llama a fetch', async () => {
  const fetch = vi.fn(() => {
    throw new Error('Sin red: el MCP no debe descargar nada');
  });
  vi.stubGlobal('fetch', fetch);

  const { client, close } = await connectClient();
  try {
    const { tools } = await client.listTools();
    const operation = await callTool(client, 'obtener_operacion', { operationId: 'createInvoice' });

    expect(tools).toHaveLength(2);
    expect(JSON.parse(textOf(operation)).operationId).toBe('createInvoice');
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await close();
  }
});
