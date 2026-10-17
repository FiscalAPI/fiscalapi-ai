import type { Client } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { callTool, connectClient, textOf } from './helpers.js';

// Límite duro de RNF-05: unos 10k tokens por respuesta, aun con 10 resultados largos.
const MAX_RESPONSE_CHARS = 40_000;
// Cada resultado lleva en su propia línea la URL .md de su sección.
const RESULT_URL = /^https:\/\/docs\.fiscalapi\.com\/\S+\.md$/gm;

let client: Client;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ client, close } = await connectClient());
});

afterAll(async () => {
  await close();
});

describe('buscar_docs', () => {
  it('aparece en tools/list como herramienta de solo lectura', async () => {
    const { tools } = await client.listTools();

    const tool = tools.find((candidate) => candidate.name === 'buscar_docs');
    expect(tool?.title).toBe('Buscar en la documentación de FiscalAPI');
    expect(tool?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    expect(tool?.inputSchema.required).toEqual(['consulta']);
  });

  it('con un código de error del PAC trae el extracto de la fila de ese código', async () => {
    const result = await callTool(client, 'buscar_docs', { consulta: 'CFDI40147' });
    const text = textOf(result);

    expect(result.isError).toBeFalsy();
    expect(text).toMatch(/^FiscalAPI docs: \d+ resultados para "CFDI40147"\./);
    expect(text).toContain('https://docs.fiscalapi.com/errors/cfdi-40/errores-cfdi-4-0.md');
    expect(text).toContain('| CFDI40147 |');
  });

  it('respeta limite', async () => {
    const text = textOf(await callTool(client, 'buscar_docs', { consulta: 'factura', limite: 2 }));

    expect(text.match(RESULT_URL)).toHaveLength(2);
  });

  it('sin limite devuelve 5 resultados', async () => {
    const text = textOf(await callTool(client, 'buscar_docs', { consulta: 'factura' }));

    expect(text.match(RESULT_URL)).toHaveLength(5);
  });

  it('titula una sección con su página entre paréntesis', async () => {
    const text = textOf(await callTool(client, 'buscar_docs', { consulta: 'cancelar una factura', limite: 1 }));

    expect(text).toMatch(/^FiscalAPI docs: 1 resultado para "cancelar una factura"\./);
    expect(text).toMatch(/^## Cancelar factura \(.+\)$/m);
  });

  it('no repite la página cuando el resultado es la página entera', async () => {
    const text = textOf(await callTool(client, 'buscar_docs', { consulta: 'catálogos sat', limite: 1 }));

    expect(text).toContain('## Catálogos SAT\nhttps://docs.fiscalapi.com/catalogs-info.md\n');
  });

  it.each(['factura', 'CFDI40147', 'modelo factura', 'catálogo'])(
    'con limite 10, "%s" cabe en el límite de tamaño',
    async (consulta) => {
      const text = textOf(await callTool(client, 'buscar_docs', { consulta, limite: 10 }));

      expect(text.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    },
  );

  it('sin coincidencias responde sin error y sugiere reformular', async () => {
    const result = await callTool(client, 'buscar_docs', { consulta: 'zzzqqq' });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('no hay resultados para "zzzqqq"');
    expect(textOf(result)).toContain('listar_operaciones');
  });

  it('recorta la consulta que repite en la respuesta', async () => {
    const consulta = `${'a'.repeat(150)} zzzqqq`;

    const text = textOf(await callTool(client, 'buscar_docs', { consulta }));

    expect(text).toContain(`"${'a'.repeat(100)}…"`);
    expect(text).not.toContain('a'.repeat(101));
  });

  it.each([
    ['limite 0', { consulta: 'factura', limite: 0 }],
    ['limite 11', { consulta: 'factura', limite: 11 }],
    ['limite no entero', { consulta: 'factura', limite: 2.5 }],
    ['consulta vacía', { consulta: '' }],
    ['consulta de más de 200 caracteres', { consulta: 'a'.repeat(201) }],
    ['sin consulta', {}],
  ])('rechaza %s', async (_, args) => {
    const result = await callTool(client, 'buscar_docs', args);

    expect(result.isError).toBe(true);
    expect(textOf(result)).not.toContain('FiscalAPI docs:');
  });
});
