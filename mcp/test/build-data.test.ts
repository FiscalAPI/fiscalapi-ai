import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import {
  buildCatalog,
  buildOperation,
  extractOperations,
  OpenApiError,
  parseOpenApi,
  serializeOperation,
} from '../scripts/openapi.mjs';

const packageDir = fileURLToPath(new URL('../', import.meta.url));
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

describe('scripts/build-data.mjs', () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'fiscalapi-mcp-build-'));
  afterAll(() => rmSync(workDir, { recursive: true, force: true }));

  function runBuild(source: string): Promise<{ code: number | null; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, ['scripts/build-data.mjs', source, '--out', path.join(workDir, 'data')], {
        cwd: packageDir,
      });
      let stderr = '';
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('close', (code) => resolve({ code, stderr }));
    });
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
});
