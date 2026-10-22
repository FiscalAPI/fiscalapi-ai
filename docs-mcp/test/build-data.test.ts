import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { DATA_FILES } from '../src/data-files.ts';
import { cleanSection, DocsError, parseLlms } from '../scripts/docs-sections.ts';
import {
  buildContract,
  extractOperations,
  listApiOperations,
  MAX_CONTRACT_CHARS,
  OpenApiError,
  parseOpenApi,
  serializeContract,
} from '../scripts/openapi-operations.ts';
import type { ExtractedOperation, OpenApiDocument } from '../scripts/openapi-operations.ts';
import { serveDocs, serveLocally } from './docs-server.ts';
import { openApiFixture } from './global-setup.ts';
import { dataDirUrl, jsonAt } from './helpers.ts';
import { runBuildData } from './run-build-data.ts';
import type { ScriptResult } from './run-build-data.ts';

const LONG_TEXT = 'Long test text that inflates the schema. '.repeat(8);
const SCRIPT_TIMEOUT_MS = 30_000;

function hugeDocument(): OpenApiDocument {
  const leafProperties = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [`field${i}`, { type: 'string', description: LONG_TEXT, example: LONG_TEXT }]),
  );
  const rootProperties = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`child${i}`, { $ref: '#/components/schemas/Child' }]));
  return {
    openapi: '3.1.1',
    paths: {
      '/api/v4/huge': {
        post: {
          operationId: 'createHuge',
          tags: ['Tests'],
          summary: 'Create something huge',
          description: 'Huge operation. Docs: [huge](https://docs.fiscalapi.com/huge).',
          requestBody: {
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Huge' } },
              'text/json': { schema: { $ref: '#/components/schemas/Huge' } },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
    },
    components: {
      schemas: {
        Huge: {
          type: 'object',
          description: 'Body root',
          required: ['child0'],
          properties: { ...rootProperties, state: { type: 'string', enum: ['A', 'B'], format: 'x-code' } },
        },
        Child: { type: ['null', 'object'], required: ['field0'], properties: leafProperties },
      },
    },
  };
}

function operationOf(document: OpenApiDocument, operationId: string): ExtractedOperation {
  const operation = extractOperations(document).find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`Missing ${operationId} in the test document.`);
  return operation;
}

function requestSchema(contract: unknown): unknown {
  return jsonAt(contract, 'requestBody', 'content', 'application/json', 'schema');
}

describe('buildContract', () => {
  it('trims a huge operation to the limit while keeping its structure and documentation', () => {
    const document = hugeDocument();

    const contract = buildContract(document, operationOf(document, 'createHuge'));
    const json = serializeContract(contract);

    expect(json.length).toBeLessThanOrEqual(MAX_CONTRACT_CHARS);
    expect(contract.description).toContain('https://docs.fiscalapi.com/huge');
    expect(contract.summary).toBe('Create something huge');
    expect(json).not.toContain('"example"');
    expect(json).not.toContain('"$ref"');
    expect(Object.keys(Object(jsonAt(contract, 'requestBody', 'content')))).toEqual(['application/json']);
    expect(jsonAt(requestSchema(contract), 'required')).toEqual(['child0']);
    expect(jsonAt(requestSchema(contract), 'properties', 'state')).toEqual({ type: 'string', enum: ['A', 'B'], format: 'x-code' });
    expect(Object.keys(Object(jsonAt(requestSchema(contract), 'properties')))).toHaveLength(41);
  });

  it('drops examples and nested descriptions before trimming subtrees', () => {
    const document = hugeDocument();
    const fullLength = serializeContract(buildContract(document, operationOf(document, 'createHuge'), Infinity)).length;

    const contract = buildContract(document, operationOf(document, 'createHuge'), fullLength / 3);
    const json = serializeContract(contract);

    expect(json).not.toContain('x-truncated');
    expect(json).not.toContain(LONG_TEXT);
    expect(jsonAt(requestSchema(contract), 'description')).toBe('Body root');
    expect(jsonAt(requestSchema(contract), 'properties', 'child0')).toMatchObject({ type: ['null', 'object'], required: ['field0'] });
    expect(jsonAt(requestSchema(contract), 'properties', 'child0', 'properties', 'field29')).toEqual({ type: 'string' });
  });

  it('replaces subtrees with their schema name as a last resort', () => {
    const document = hugeDocument();

    const contract = buildContract(document, operationOf(document, 'createHuge'), 4_000);

    expect(serializeContract(contract).length).toBeLessThanOrEqual(4_000);
    expect(jsonAt(requestSchema(contract), 'properties', 'child0')).toEqual({ type: 'object', 'x-truncated': 'Child' });
    expect(jsonAt(requestSchema(contract), 'properties', 'state')).toEqual({ type: 'string', enum: ['A', 'B'], format: 'x-code' });
  });

  it('fails when the operation does not fit even when trimmed', () => {
    const document = hugeDocument();

    expect(() => buildContract(document, operationOf(document, 'createHuge'), 100)).toThrow(OpenApiError);
  });

  it('cuts recursive schemas without looping', () => {
    const document: OpenApiDocument = {
      openapi: '3.1.1',
      paths: {
        '/api/v4/nodes': {
          get: {
            operationId: 'listNodes',
            responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } } } },
          },
        },
      },
      components: {
        schemas: { Node: { type: 'object', properties: { children: { type: 'array', items: { $ref: '#/components/schemas/Node' } } } } },
      },
    };

    const contract = buildContract(document, operationOf(document, 'listNodes'));

    const schema = jsonAt(contract, 'responses', '200', 'content', 'application/json', 'schema');
    expect(jsonAt(schema, 'properties', 'children', 'items')).toEqual({ type: 'object', 'x-recursive': 'Node' });
  });
});

describe('extractOperations and listApiOperations', () => {
  it('rejects an operationId that could escape the contracts folder', () => {
    const document: OpenApiDocument = { openapi: '3.1.1', paths: { '/x': { get: { operationId: '../x', responses: {} } } } };

    expect(() => extractOperations(document)).toThrow(/no valid operationId/);
  });

  it('sorts by tag and then by operationId', () => {
    const document: OpenApiDocument = {
      openapi: '3.1.1',
      paths: {
        '/b': { get: { operationId: 'zeta', tags: ['B'], summary: 'z' } },
        '/a': { get: { operationId: 'beta', tags: ['A'], summary: 'b' }, post: { operationId: 'alpha', tags: ['A'], summary: 'a' } },
      },
    };

    expect(listApiOperations(extractOperations(document)).map((operation) => operation.operationId)).toEqual(['alpha', 'beta', 'zeta']);
  });

  it('rejects JSON that is not OpenAPI 3', () => {
    expect(() => parseOpenApi('{"swagger":"2.0","paths":{}}')).toThrow(OpenApiError);
    expect(() => parseOpenApi('<html></html>')).toThrow(/not valid JSON/);
  });
});

describe('scripts/build-data.ts', { timeout: SCRIPT_TIMEOUT_MS }, () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'fiscalapi-docs-mcp-build-'));
  const outDir = path.join(workDir, 'data');
  afterAll(() => rmSync(workDir, { recursive: true, force: true }));

  function runBuild(openApiSource: string, ...args: readonly string[]): Promise<ScriptResult> {
    return runBuildData([openApiSource, ...args, '--out', outDir]);
  }

  function seedPreviousData(): string {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, DATA_FILES.source), '{}');
    const marker = path.join(outDir, 'previous.txt');
    writeFileSync(marker, 'previous data');
    return marker;
  }

  function leftovers(): string[] {
    return readdirSync(workDir).filter((name) => name.startsWith('data.'));
  }

  it('refuses to replace an existing directory that is not a data directory', async () => {
    const unrelatedDir = path.join(workDir, 'unrelated');
    mkdirSync(unrelatedDir, { recursive: true });
    writeFileSync(path.join(unrelatedDir, 'keep.txt'), 'keep');

    const { code, stderr } = await runBuildData([openApiFixture, '--out', unrelatedDir]);

    expect(code).toBe(1);
    expect(stderr).toContain(`refusing to replace ${unrelatedDir}`);
    expect(readdirSync(unrelatedDir)).toEqual(['keep.txt']);
  });

  it('exits with code 1 when the OpenAPI URL does not respond 200', async () => {
    const server = await serveLocally(() => ({ status: 401 }));
    try {
      const { code, stderr } = await runBuild(`${server.origin}/openapi.json`);

      expect(code).toBe(1);
      expect(stderr).toContain('responded HTTP 401; expected 200');
    } finally {
      await server.close();
    }
  });

  it('exits with code 1 when the file is not OpenAPI', async () => {
    const notOpenApi = path.join(workDir, 'not-openapi.json');
    writeFileSync(notOpenApi, '{"hello":"world"}');

    const { code, stderr } = await runBuild(notOpenApi);

    expect(code).toBe(1);
    expect(stderr).toContain('is not an OpenAPI 3 document');
  });

  it.each([
    ['responds 404', { '/page/section-a.md': '## Section A\n\nText.' }, 'page/section-b.md responded HTTP 404; expected 200'],
    [
      'returns HTML',
      { '/page/section-a.md': '## Section A\n\nText.', '/page/section-b.md': '<!DOCTYPE html><html></html>' },
      'page/section-b.md returned HTML instead of Markdown',
    ],
  ])('exits with code 1 and keeps the previous data when a .md section %s', async (_, files, message) => {
    const docs = await serveDocs({ llms: SMALL_LLMS, files });
    const marker = seedPreviousData();
    try {
      const { code, stderr } = await runBuild(openApiFixture, '--docs-url', docs.origin);

      expect(code).toBe(1);
      expect(stderr).toContain(`build-data: ${docs.origin}/${message}`);
      expect(readFileSync(marker, 'utf8')).toBe('previous data');
      expect(readdirSync(outDir).sort()).toEqual(['previous.txt', DATA_FILES.source].sort());
      expect(leftovers()).toEqual([]);
    } finally {
      await docs.close();
    }
  });

  it('retries a docs request rejected with HTTP 429 and completes the build', async () => {
    const routes = new Map([
      ['/llms.txt', SMALL_LLMS],
      ['/page/section-a.md', '## Section A\n\nText.'],
      ['/page/section-b.md', '## Section B\n\nText.'],
    ]);
    let rateLimitedRequests = 0;
    const docs = await serveLocally((pathname) => {
      if (pathname === '/page/section-a.md' && rateLimitedRequests === 0) {
        rateLimitedRequests++;
        return { status: 429 };
      }
      const body = routes.get(pathname);
      return body === undefined ? { status: 404 } : { status: 200, body };
    });
    try {
      const { code, stderr } = await runBuild(openApiFixture, '--docs-url', docs.origin);

      expect(stderr).toContain('2 docs sections');
      expect(code).toBe(0);
      expect(rateLimitedRequests).toBe(1);
      expect(existsSync(path.join(outDir, 'previous.txt'))).toBe(false);
      expect(leftovers()).toEqual([]);
    } finally {
      await docs.close();
    }
  });

  it('exits with code 1 when llms.txt does not exist', async () => {
    const docs = await serveDocs({ llms: SMALL_LLMS, files: {} });
    try {
      const { code, stderr } = await runBuild(openApiFixture, '--docs-url', `${docs.origin}/missing`);

      expect(code).toBe(1);
      expect(stderr).toContain(`${docs.origin}/missing/llms.txt responded HTTP 404`);
    } finally {
      await docs.close();
    }
  });

  it('records the OpenAPI and docs hashes and counts in the source manifest', () => {
    const manifest: unknown = JSON.parse(readFileSync(new URL(DATA_FILES.source, dataDirUrl()), 'utf8'));

    expect(jsonAt(manifest, 'openApi', 'operations')).toBe(100);
    expect(jsonAt(manifest, 'openApi', 'sha256')).toMatch(/^[0-9a-f]{64}$/);
    expect(jsonAt(manifest, 'docs', 'baseUrl')).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(jsonAt(manifest, 'docs', 'sections')).toBe(383);
    expect(jsonAt(manifest, 'docs', 'sha256')).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(new URL(DATA_FILES.docsIndex, dataDirUrl()))).toBe(true);
  });
});

const SMALL_LLMS = [
  '# FiscalAPI',
  '',
  '- Endpoints live under `/api/v4/`.',
  '- [Page](https://docs.fiscalapi.com/page.md): description.',
  '  - [Section A](https://docs.fiscalapi.com/page/section-a.md)',
  '  - [Section B](https://docs.fiscalapi.com/page/section-b.md)',
].join('\n');

describe('parseLlms', () => {
  it('indexes each section with its page and whole pages without sections, without repeating URLs', () => {
    const llms = [
      SMALL_LLMS,
      '',
      '## Reference',
      '',
      '- [Single](https://docs.fiscalapi.com/single.md): page without sections.',
      '- [Other](https://docs.fiscalapi.com/other.md): repeats a section.',
      '  - [Section A](https://docs.fiscalapi.com/page/section-a.md)',
      '  - [Own](https://docs.fiscalapi.com/other/own.md)',
      '- [Single](https://docs.fiscalapi.com/single.md): the same page again.',
      '- [External](https://example.com/external.md): another site.',
    ].join('\n');

    expect(parseLlms(llms)).toEqual([
      { url: 'https://docs.fiscalapi.com/page/section-a.md', page: 'Page' },
      { url: 'https://docs.fiscalapi.com/page/section-b.md', page: 'Page' },
      { url: 'https://docs.fiscalapi.com/single.md', page: 'Single' },
      { url: 'https://docs.fiscalapi.com/other/own.md', page: 'Other' },
    ]);
  });

  it('fails when llms.txt links no .md page of the site', () => {
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
    '# Not a heading',
    'curl -X DELETE https://test.fiscalapi.com/api/v4/invoices',
    '```',
    '',
    '| Código | Descripción |',
    '| --- | --- |',
    '| CFDI40147 | El campo DomicilioFiscalReceptor |',
  ].join('\n');

  it('splits the title and the endpoint annotation', () => {
    const { title, endpoint } = cleanSection(section);

    expect(title).toBe('Cancelar factura');
    expect(endpoint).toBe('DELETE /api/v4/invoices');
  });

  it('removes code, tags, URLs and indentation while keeping tag names and values, line breaks and tables', () => {
    expect(cleanSection(section).text).toBe(
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

  it('has no endpoint without an annotation', () => {
    expect(cleanSection('# Webhooks\n\nTexto.')).toEqual({ title: 'Webhooks', endpoint: '', text: 'Texto.' });
  });
});
