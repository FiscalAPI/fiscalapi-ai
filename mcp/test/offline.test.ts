import { afterEach, expect, it, vi } from 'vitest';

import { callTool, connectClient, textOf } from './helpers.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

// El cliente se conecta después de cortar la red: así cargar el catálogo y el índice de la
// documentación también queda cubierto, no solo las llamadas a las herramientas.
it('arranca y responde sin red: nunca llama a fetch', async () => {
  const fetch = vi.fn(() => {
    throw new Error('Sin red: el MCP no debe descargar nada');
  });
  vi.stubGlobal('fetch', fetch);

  const { client, close } = await connectClient();
  try {
    const { tools } = await client.listTools();
    const operation = await callTool(client, 'obtener_operacion', { operationId: 'createInvoice' });
    const docs = await callTool(client, 'buscar_docs', { consulta: 'cancelar factura' });

    expect(tools).toHaveLength(3);
    expect(JSON.parse(textOf(operation)).operationId).toBe('createInvoice');
    expect(docs.isError).toBeFalsy();
    expect(textOf(docs)).toContain('https://docs.fiscalapi.com/');
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await close();
  }
});
