import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { cleanSection, DocsError, parseLlms } from '../scripts/docs.mjs';
import {
  buildCatalog,
  buildOperation,
  extractOperations,
  OpenApiError,
  parseOpenApi,
  serializeOperation,
} from '../scripts/openapi.mjs';
import { serveDocs } from './docs-server.js';
import { dataDirUrl } from './helpers.js';
import { runBuildData } from './run-build-data.js';

const packageDir = fileURLToPath(new URL('../', import.meta.url));
const openApiFixture = path.join(packageDir, 'test', 'fixtures', 'openapi-v4.json');
// Límite de RNF-05 escrito aquí a propósito: si alguien sube el del build, la prueba lo detecta.
const SPEC_MAX_OPERATION_CHARS = 40_000;
const LONG_TEXT ='Texto largo de prueba para inflar el esquema. '.repeat(8);

// Un cuerpo que resuelto mide cientos de miles de caracteres: obliga a recortar.
function hugeDoc(): Record<string, unknown> {
  const leafProperties = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [`campo${i}`, { type: 'string', description: LONG_TEXT, example: LONG_TEXT }]),
  );
  const rootProperties = Object.fromEntries(
    Array.from({ length: 40 }, (_, i) => [`hijo${i}`, { $ref: '#/components/schemas/Hijo' }]),
  );
  return {
    openapi: '3.1.1',
    paths: {
      '/api/v4/grande': {
        post: {
          operationId: 'createGrande',
          tags: ['Pruebas'],
          summary: 'Crear algo grande',
          description: 'Operación enorme. Docs: [grande](https://docs.fiscalapi.com/grande).',
          requestBody: {
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Grande' } },
              'text/json': { schema: { $ref: '#/components/schemas/Grande' } },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
    },
    components: {
      schemas: {
        Grande: {
          type: 'object',
          description: 'Raíz del cuerpo',
          required: ['hijo0'],
          properties: { ...rootProperties, estado: { type: 'string', enum: ['A', 'B'], format: 'x-codigo' } },
        },
        Hijo: { type: ['null', 'object'], required: ['campo0'], properties: leafProperties },
      },
    },
  };
}

function entryOf(doc: Record<string, unknown>, id: string) {
  const entry = extractOperations(doc).find((candidate: { id: string }) => candidate.id === id);
  if (!entry) throw new Error(`Falta ${id} en el documento de prueba.`);
  return entry;
}

describe('buildOperation', () => {
  it('recorta una operación enorme hasta el límite y conserva la estructura y la documentación', () => {
    const doc = hugeDoc();

    const operation = buildOperation(doc, entryOf(doc, 'createGrande'));
    const json = serializeOperation(operation);

    expect(json.length).toBeLessThanOrEqual(SPEC_MAX_OPERATION_CHARS);
    expect(operation.description).toContain('https://docs.fiscalapi.com/grande');
    expect(operation.summary).toBe('Crear algo grande');
    expect(json).not.toContain('"example"');
    expect(json).not.toContain('"$ref"');
    const body = operation.requestBody.content['application/json'].schema;
    expect(Object.keys(operation.requestBody.content)).toEqual(['application/json']);
    expect(body.required).toEqual(['hijo0']);
    expect(body.properties.estado).toEqual({ type: 'string', enum: ['A', 'B'], format: 'x-codigo' });
    expect(Object.keys(body.properties)).toHaveLength(41);
  });

  it('quita primero ejemplos y descripciones anidadas antes de recortar subárboles', () => {
    const doc = hugeDoc();
    const full = serializeOperation(buildOperation(doc, entryOf(doc, 'createGrande'), Infinity));

    // Cabe sin ejemplos ni descripciones, pero no sin ejemplos solamente.
    const operation = buildOperation(doc, entryOf(doc, 'createGrande'), full.length / 3);
    const json = serializeOperation(operation);

    expect(json).not.toContain('x-recortado');
    expect(json).not.toContain(LONG_TEXT);
    const body = operation.requestBody.content['application/json'].schema;
    expect(body.description).toBe('Raíz del cuerpo');
    expect(body.properties.hijo0).toMatchObject({ type: ['null', 'object'], required: ['campo0'] });
    expect(body.properties.hijo0.properties.campo29).toEqual({ type: 'string' });
  });

  it('como último recurso reemplaza los subárboles por su nombre de esquema', () => {
    const doc = hugeDoc();

    const operation = buildOperation(doc, entryOf(doc, 'createGrande'), 4_000);

    const body = operation.requestBody.content['application/json'].schema;
    expect(serializeOperation(operation).length).toBeLessThanOrEqual(4_000);
    expect(body.properties.hijo0).toEqual({ type: 'object', 'x-recortado': 'Hijo' });
    expect(body.properties.estado).toEqual({ type: 'string', enum: ['A', 'B'], format: 'x-codigo' });
  });

  it('falla si la operación no cabe ni recortada', () => {
    const doc = hugeDoc();

    expect(() => buildOperation(doc, entryOf(doc, 'createGrande'), 100)).toThrow(OpenApiError);
  });

  it('corta los esquemas recursivos sin ciclar', () => {
    const doc = {
      openapi: '3.1.1',
      paths: {
        '/api/v4/nodos': {
          get: {
            operationId: 'listNodos',
            responses: {
              '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Nodo' } } } },
            },
          },
        },
      },
      components: {
        schemas: { Nodo: { type: 'object', properties: { hijos: { type: 'array', items: { $ref: '#/components/schemas/Nodo' } } } } },
      },
    };

    const operation = buildOperation(doc, entryOf(doc, 'listNodos'));

    const schema = operation.responses['200'].content['application/json'].schema;
    expect(schema.properties.hijos.items).toEqual({ type: 'object', 'x-recursivo': 'Nodo' });
  });
});

describe('extractOperations y buildCatalog', () => {
  it('rechaza un operationId que podría salir de data/operations', () => {
    const doc = { openapi: '3.1.1', paths: { '/x': { get: { operationId: '../x', responses: {} } } } };

    expect(() => extractOperations(doc)).toThrow(/operationId válido/);
  });

  it('ordena el catálogo por tag y luego por operationId', () => {
    const doc = {
      openapi: '3.1.1',
      paths: {
        '/b': { get: { operationId: 'zeta', tags: ['B'], summary: 'z' } },
        '/a': { get: { operationId: 'beta', tags: ['A'], summary: 'b' }, post: { operationId: 'alfa', tags: ['A'], summary: 'a' } },
      },
    };

    expect(buildCatalog(extractOperations(doc)).map((entry: { id: string }) => entry.id)).toEqual(['alfa', 'beta', 'zeta']);
  });

  it('rechaza JSON que no es OpenAPI 3', () => {
    expect(() => parseOpenApi('{"swagger":"2.0","paths":{}}')).toThrow(OpenApiError);
    expect(() => parseOpenApi('<html></html>')).toThrow(/no es JSON/);
  });
});

// Cada prueba arranca un proceso de Node: en Windows, con los otros archivos de prueba corriendo en
// paralelo, el primero llegó a tardar más que los 5 s por omisión.
describe('scripts/build-data.mjs', { timeout: 30_000 }, () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'fiscalapi-mcp-build-'));
  afterAll(() => rmSync(workDir, { recursive: true, force: true }));

  const outDir = path.join(workDir, 'data');

  function runBuild(source: string, ...args: string[]): Promise<{ code: number | null; stderr: string }> {
    return runBuildData([source, ...args, '--out', outDir]);
  }

  it('sale con código 1 si la URL no responde 200', async () => {
    const server = createServer((_, response) => response.writeHead(401).end());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const { code, stderr } = await runBuild(`http://127.0.0.1:${port}/api/openapi/v4.json`);

      expect(code).toBe(1);
      expect(stderr).toContain('respondió HTTP 401; se esperaba 200');
    } finally {
      server.close();
    }
  });

  it('sale con código 1 si el archivo no es un OpenAPI', async () => {
    const notOpenApi = path.join(workDir, 'no-openapi.json');
    writeFileSync(notOpenApi, '{"hola":"mundo"}');

    const { code, stderr } = await runBuild(notOpenApi);

    expect(code).toBe(1);
    expect(stderr).toContain('no es un documento OpenAPI 3');
  });

  // Un data/ previo con una marca: si el build fallido lo tocara, la marca desaparecería.
  function seedPreviousData(): string {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    const marker = path.join(outDir, 'previo.txt');
    writeFileSync(marker, 'data/ anterior');
    return marker;
  }

  function leftovers(): string[] {
    return readdirSync(workDir).filter((name) => name.startsWith('data.tmp-'));
  }

  it.each([
    ['responde 404', { '/pagina/seccion-b.md': undefined }, 'pagina/seccion-b.md respondió HTTP 404; se esperaba 200'],
    ['devuelve HTML', { '/pagina/seccion-b.md': '<!DOCTYPE html><html></html>' }, 'pagina/seccion-b.md devolvió HTML en lugar de Markdown'],
  ])('sale con código 1 y no toca data/ si una sección .md %s', async (_, override, message) => {
    const files: Record<string, string | undefined> = {
      '/pagina/seccion-a.md': '## Sección A\n\nTexto.',
      '/pagina/seccion-b.md': '## Sección B\n\nTexto.',
      ...override,
    };
    const docs = await serveDocs({
      llms: SMALL_LLMS,
      files: Object.fromEntries(Object.entries(files).filter((entry): entry is [string, string] => entry[1] !== undefined)),
    });
    const marker = seedPreviousData();
    try {
      const { code, stderr } = await runBuild(openApiFixture, '--docs-origin', docs.origin);

      expect(code).toBe(1);
      expect(stderr).toContain(`build-data: ${docs.origin}/${message}`);
      expect(readFileSync(marker, 'utf8')).toBe('data/ anterior');
      expect(readdirSync(outDir)).toEqual(['previo.txt']);
      expect(leftovers()).toEqual([]);
    } finally {
      await docs.close();
    }
  });

  it('sale con código 1 si llms.txt no existe', async () => {
    const docs = await serveDocs({ llms: SMALL_LLMS, files: {} });
    try {
      const { code, stderr } = await runBuild(openApiFixture, '--docs-origin', `${docs.origin}/no-existe`);

      expect(code).toBe(1);
      expect(stderr).toContain(`${docs.origin}/no-existe/llms.txt respondió HTTP 404`);
    } finally {
      await docs.close();
    }
  });

  it('guarda en source.json el origen, el hash y el número de documentos de la documentación', () => {
    const source = JSON.parse(readFileSync(new URL('source.json', dataDirUrl()), 'utf8'));

    expect(source.operations).toBe(100);
    expect(source.docs).toMatchObject({ origin: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/), documents: 383 });
    expect(source.docs.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(new URL('docs-index.json', dataDirUrl()))).toBe(true);
  });
});

const SMALL_LLMS = [
  '# FiscalAPI',
  '',
  '- Los endpoints están bajo `/api/v4/`.',
  '- [Página](https://docs.fiscalapi.com/pagina.md): descripción.',
  '  - [Sección A](https://docs.fiscalapi.com/pagina/seccion-a.md)',
  '  - [Sección B](https://docs.fiscalapi.com/pagina/seccion-b.md)',
].join('\n');

describe('parseLlms', () => {
  it('indexa cada sección con su página y las páginas sin secciones enteras, sin repetir URL', () => {
    const llms = [
      SMALL_LLMS,
      '',
      '## Referencia',
      '',
      '- [Sola](https://docs.fiscalapi.com/sola.md): página sin secciones.',
      '- [Otra](https://docs.fiscalapi.com/otra.md): repite una sección.',
      '  - [Sección A](https://docs.fiscalapi.com/pagina/seccion-a.md)',
      '  - [Propia](https://docs.fiscalapi.com/otra/propia.md)',
      '- [Sola](https://docs.fiscalapi.com/sola.md): la misma página otra vez.',
      '- [Externa](https://example.com/externa.md): de otro sitio.',
    ].join('\n');

    expect(parseLlms(llms)).toEqual([
      { url: 'https://docs.fiscalapi.com/pagina/seccion-a.md', page: 'Página' },
      { url: 'https://docs.fiscalapi.com/pagina/seccion-b.md', page: 'Página' },
      { url: 'https://docs.fiscalapi.com/sola.md', page: 'Sola' },
      { url: 'https://docs.fiscalapi.com/otra/propia.md', page: 'Otra' },
    ]);
  });

  it('falla si el llms.txt no enlaza ninguna .md del sitio', () => {
    expect(() => parseLlms('<!DOCTYPE html><html></html>')).toThrow(DocsError);
  });
});

describe('cleanSection', () => {
  const section = [
    "## Cancelar factura {{ tag: 'DELETE', label: '/api/v4/invoices' }}",
    '',
    '    Este endpoint cancela una factura. Revisa los [valores](/modes-of-operation) y `sat.blacklist.69b`.',
    '     <Properties>',
    '      <Property name="invoiceUuid" type="string" required="true">',
    '        Folio fiscal (UUID) de la factura.',
    '      </Property>',
    '',
    '',
    '',
    `      <Enum><Item value='"01"'>Comprobante emitido con errores **con** relación</Item>`,
    '      <Item value="0">Certificado CSD</Item></Enum>',
    '     </Properties>',
    '',
    '```bash',
    '# Esto no es un encabezado',
    'curl -X DELETE https://test.fiscalapi.com/api/v4/invoices',
    '```',
    '',
    '| Código | Descripción |',
    '| --- | --- |',
    '| CFDI40147 | El campo DomicilioFiscalReceptor |',
  ].join('\n');

  it('separa título y endpoint de la anotación', () => {
    const { title, endpoint } = cleanSection(section);

    expect(title).toBe('Cancelar factura');
    expect(endpoint).toBe('DELETE /api/v4/invoices');
  });

  it('quita código, etiquetas, URLs y sangría; conserva el name y el value de las etiquetas, los saltos de línea y las tablas', () => {
    const { text } = cleanSection(section);

    expect(text).toBe(
      [
        'Este endpoint cancela una factura. Revisa los valores y sat.blacklist.69b.',
        '',
        'invoiceUuid',
        'Folio fiscal (UUID) de la factura.',
        '',
        '01 Comprobante emitido con errores **con** relación',
        '0 Certificado CSD',
        '',
        '| Código | Descripción |',
        '| --- | --- |',
        '| CFDI40147 | El campo DomicilioFiscalReceptor |',
      ].join('\n'),
    );
  });

  it('una sección sin anotación no tiene endpoint', () => {
    expect(cleanSection('# Webhooks\n\nTexto.')).toEqual({ title: 'Webhooks', endpoint: '', text: 'Texto.' });
  });
});
