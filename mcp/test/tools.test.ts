import { readFileSync } from 'node:fs';

import type { Client } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { callTool, connectClient, dataDirUrl, textOf } from './helpers.js';

// Límites duros de RNF-05: unos 3k tokens para el catálogo y unos 10k para una operación.
const MAX_CATALOG_CHARS = 12_000;
const MAX_OPERATION_CHARS = 40_000;
const OPERATION_LINE = /^\w+ {2}(GET|POST|PUT|PATCH|DELETE) \/\S* {2}.+$/;

interface CatalogEntry {
  id: string;
  tag: string;
}

const catalog = JSON.parse(readFileSync(new URL('catalog.json', dataDirUrl()), 'utf8')) as CatalogEntry[];

let client: Client;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ client, close } = await connectClient());
});

afterAll(async () => {
  await close();
});

function operationLines(text: string): string[] {
  return text.split('\n').filter((line) => OPERATION_LINE.test(line));
}

describe('tools/list', () => {
  it('expone exactamente buscar_docs, listar_operaciones y obtener_operacion con descripciones en español', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(['buscar_docs', 'listar_operaciones', 'obtener_operacion']);
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    expect(byName.listar_operaciones?.description).toContain('el siguiente paso es llamar a obtener_operacion');
    expect(byName.obtener_operacion?.description).toContain('Usa el operationId exacto que da listar_operaciones');
    expect(byName.obtener_operacion?.inputSchema.required).toEqual(['operationId']);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.description).not.toMatch(/—/);
    }
  });
});

describe('listar_operaciones', () => {
  it('sin tag lista las 100 operaciones agrupadas por tag dentro del límite de tamaño', async () => {
    const result = await callTool(client, 'listar_operaciones');
    const text = textOf(result);

    expect(result.isError).toBeFalsy();
    expect(operationLines(text)).toHaveLength(100);
    expect(text).toContain('createInvoice  POST /api/v4/invoices  Emitir (timbrar) una factura CFDI 4.0');
    expect(text).toContain('## Invoices');
    expect(text.length).toBeLessThanOrEqual(MAX_CATALOG_CHARS);
  });

  it('con tag filtra sin distinguir mayúsculas', async () => {
    const invoices = catalog.filter((entry) => entry.tag === 'Invoices').map((entry) => entry.id);

    const text = textOf(await callTool(client, 'listar_operaciones', { tag: 'invoices' }));

    const ids = operationLines(text).map((line) => line.split(' ')[0]);
    expect(ids).toEqual(invoices);
    expect(text).not.toContain('## People');
  });

  it('con un tag inexistente devuelve error con los tags disponibles', async () => {
    const result = await callTool(client, 'listar_operaciones', { tag: 'Facturas' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No hay operaciones con el tag "Facturas"');
    expect(textOf(result)).toContain('Invoices');
  });
});

describe('obtener_operacion', () => {
  it('devuelve createInvoice con su cuerpo resuelto y dentro del límite de tamaño', async () => {
    const result = await callTool(client, 'obtener_operacion', { operationId: 'createInvoice' });
    const text = textOf(result);
    const operation = JSON.parse(text);

    expect(result.isError).toBeFalsy();
    expect(operation).toMatchObject({ operationId: 'createInvoice', method: 'POST', path: '/api/v4/invoices' });
    expect(operation.description).toContain('https://docs.fiscalapi.com/');
    const body = operation.requestBody.content['application/json'].schema;
    expect(body.properties.items.items.properties).toHaveProperty('itemCode');
    expect(text).not.toContain('"$ref"');
    expect(text.length).toBeLessThanOrEqual(MAX_OPERATION_CHARS);
  });

  it.each(catalog.map((entry) => entry.id))('%s cabe en el límite y no deja $ref sin resolver', async (operationId) => {
    const result = await callTool(client, 'obtener_operacion', { operationId });
    const text = textOf(result);

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text).operationId).toBe(operationId);
    expect(text).not.toContain('"$ref"');
    expect(text.length).toBeLessThanOrEqual(MAX_OPERATION_CHARS);
  });

  it('con un id mal escrito devuelve error y sugiere el correcto', async () => {
    const result = await callTool(client, 'obtener_operacion', { operationId: 'createInvoce' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No existe la operación "createInvoce"');
    expect(textOf(result)).toContain('¿Quisiste decir createInvoice?');
  });

  it('sin parecido suficiente no sugiere nada y remite a listar_operaciones', async () => {
    const result = await callTool(client, 'obtener_operacion', { operationId: 'xyz' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('No existe la operación "xyz". Usa listar_operaciones para ver los operationId disponibles.');
  });

  it('sugiere primero los ids que empiezan con lo enviado y luego los que lo contienen', async () => {
    const result = await callTool(client, 'obtener_operacion', { operationId: 'getinvoice' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('¿Quisiste decir getInvoice, getInvoicePdf, getInvoiceStatus, getInvoiceXml?');
  });

  it.each(['../package', '../catalog', '..\\catalog', '/etc/passwd'])('rechaza %s sin leer archivos fuera de data/operations', async (operationId) => {
    const result = await callTool(client, 'obtener_operacion', { operationId });
    const text = textOf(result);

    expect(result.isError).toBe(true);
    expect(text).toContain('No existe la operación');
    expect(text).not.toContain('"summary"');
    expect(text).not.toContain('@fiscalapi/mcp');
  });
});
