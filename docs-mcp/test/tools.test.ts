import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MAX_CONTRACT_CHARS } from '../scripts/openapi-operations.ts';
import { ApiOperations } from '../src/api-operations.ts';
import { TOOL_NAMES } from '../src/tools/tool-conventions.ts';
import { callTool, connectClient, dataDirUrl, jsonAt, textOf } from './helpers.ts';
import type { ConnectedClient } from './helpers.ts';

const MAX_OPERATION_LIST_CHARS = 12_000;
const OPERATION_LINE = /^\w+ {2}(GET|POST|PUT|PATCH|DELETE) \/\S* {2}.+$/;

const operations = ApiOperations.load(dataDirUrl()).list();

let connection: ConnectedClient;

beforeAll(async () => {
  connection = await connectClient();
});

afterAll(async () => {
  await connection.close();
});

function operationLines(text: string): string[] {
  return text.split('\n').filter((line) => OPERATION_LINE.test(line));
}

describe('tools/list', () => {
  it('exposes exactly the three read-only tools with Spanish descriptions that point to the next tool', async () => {
    const { tools } = await connection.client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.values(TOOL_NAMES).sort());
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    expect(byName.get(TOOL_NAMES.listOperations)?.description).toContain(`después llama a ${TOOL_NAMES.getOperation}`);
    expect(byName.get(TOOL_NAMES.getOperation)?.description).toContain(`operationId exacto que devuelve ${TOOL_NAMES.listOperations}`);
    expect(byName.get(TOOL_NAMES.getOperation)?.inputSchema.required).toEqual(['operationId']);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.description).toContain('no llama a la API y no requiere API key');
      expect(tool.description).not.toMatch(/[—→✓]/);
    }
  });
});

describe(TOOL_NAMES.listOperations, () => {
  it('lists the 100 operations grouped by tag within the size limit', async () => {
    const result = await callTool(connection.client, TOOL_NAMES.listOperations);
    const text = textOf(result);

    expect(result.isError).toBeFalsy();
    expect(operationLines(text)).toHaveLength(100);
    expect(text).toContain('createInvoice  POST /api/v4/invoices  Emitir (timbrar) una factura CFDI 4.0');
    expect(text).toContain('## Invoices');
    expect(text.length).toBeLessThanOrEqual(MAX_OPERATION_LIST_CHARS);
  });

  it('filters by tag ignoring case', async () => {
    const invoiceIds = operations.filter((operation) => operation.tag === 'Invoices').map((operation) => operation.operationId);

    const text = textOf(await callTool(connection.client, TOOL_NAMES.listOperations, { tag: 'invoices' }));

    expect(operationLines(text).map((line) => line.split(' ')[0])).toEqual(invoiceIds);
    expect(text).not.toContain('## People');
  });

  it('returns an error with the available tags when the tag does not exist', async () => {
    const result = await callTool(connection.client, TOOL_NAMES.listOperations, { tag: 'Facturas' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No hay operaciones con el tag "Facturas"');
    expect(textOf(result)).toContain('Invoices');
  });
});

describe(TOOL_NAMES.getOperation, () => {
  it('returns createInvoice with its resolved request body within the size limit', async () => {
    const result = await callTool(connection.client, TOOL_NAMES.getOperation, { operationId: 'createInvoice' });
    const text = textOf(result);
    const contract: unknown = JSON.parse(text);

    expect(result.isError).toBeFalsy();
    expect(contract).toMatchObject({ operationId: 'createInvoice', method: 'POST', path: '/api/v4/invoices' });
    expect(jsonAt(contract, 'description')).toContain('https://docs.fiscalapi.com/');
    const itemProperties = jsonAt(contract, 'requestBody', 'content', 'application/json', 'schema', 'properties', 'items', 'items', 'properties');
    expect(itemProperties).toHaveProperty('itemCode');
    expect(text).not.toContain('"$ref"');
    expect(text.length).toBeLessThanOrEqual(MAX_CONTRACT_CHARS);
  });

  it.each(operations.map((operation) => operation.operationId))('%s fits the size limit and has no unresolved $ref', async (operationId) => {
    const result = await callTool(connection.client, TOOL_NAMES.getOperation, { operationId });
    const text = textOf(result);

    expect(result.isError).toBeFalsy();
    expect(jsonAt(JSON.parse(text), 'operationId')).toBe(operationId);
    expect(text).not.toContain('"$ref"');
    expect(text.length).toBeLessThanOrEqual(MAX_CONTRACT_CHARS);
  });

  it('suggests the right id for a typo', async () => {
    const result = await callTool(connection.client, TOOL_NAMES.getOperation, { operationId: 'createInvoce' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No existe la operación "createInvoce"');
    expect(textOf(result)).toContain('¿Quisiste decir createInvoice?');
  });

  it('suggests nothing without enough similarity and points to the list tool', async () => {
    const result = await callTool(connection.client, TOOL_NAMES.getOperation, { operationId: 'xyz' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(`No existe la operación "xyz". Usa ${TOOL_NAMES.listOperations} para ver los operationId disponibles.`);
  });

  it('suggests ids starting with the input before ids containing it', async () => {
    const result = await callTool(connection.client, TOOL_NAMES.getOperation, { operationId: 'getinvoice' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('¿Quisiste decir getInvoice, getInvoicePdf, getInvoiceStatus, getInvoiceXml?');
  });

  it.each(['../package', '../operations', '..\\operations', '/etc/passwd'])('rejects %s without reading files outside the contracts folder', async (operationId) => {
    const result = await callTool(connection.client, TOOL_NAMES.getOperation, { operationId });
    const text = textOf(result);

    expect(result.isError).toBe(true);
    expect(text).toContain('No existe la operación');
    expect(text).not.toContain('"summary"');
    expect(text).not.toContain('@fiscalapi/docs-mcp');
  });
});
