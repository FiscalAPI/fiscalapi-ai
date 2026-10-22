import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import MiniSearch from 'minisearch';

import type { ApiOperation } from '../src/api-operations.ts';
import { DATA_FILES } from '../src/data-files.ts';
import { DOCS_INDEX_OPTIONS } from '../src/docs-index-options.ts';
import type { DocsSection } from '../src/docs-index-options.ts';
import { DOCS_SITE, downloadMarkdown, fetchLlms, normalizeDocsBaseUrl, parseLlms, toDocsSection } from './docs-sections.ts';
import { fetchText } from './http.ts';
import { buildContract, extractOperations, listApiOperations, OpenApiError, parseOpenApi, serializeContract } from './openapi-operations.ts';
import type { ExtractedOperation, OpenApiDocument } from './openapi-operations.ts';
import { createLogger, errorMessage, parseScriptArgs, runScript, ScriptError } from './script-runner.ts';

const SCRIPT_NAME = 'build-data';
const USAGE = 'node scripts/build-data.ts [openapi-url-or-file] [--docs-url <url>] [--out <directory>]';
const DEFAULT_OPENAPI_SOURCE = 'https://live.fiscalapi.com/api/openapi/v4.json';
const DEFAULT_OUT_DIR = fileURLToPath(new URL('../data', import.meta.url));
const log = createLogger(SCRIPT_NAME);

interface BuildOptions {
  readonly openApiSource: string;
  readonly docsBaseUrl: string;
  readonly outDir: string;
}

interface OpenApiBuild {
  readonly source: string;
  readonly sha256: string;
  readonly document: OpenApiDocument;
  readonly operations: readonly ExtractedOperation[];
  readonly apiOperations: readonly ApiOperation[];
}

interface DocsBuild {
  readonly baseUrl: string;
  readonly sha256: string;
  readonly sections: number;
  readonly indexJson: string;
}

interface SourceManifest {
  readonly openApi: { readonly source: string; readonly sha256: string; readonly operations: number };
  readonly docs: { readonly baseUrl: string; readonly sha256: string; readonly sections: number };
}

function readOptions(): BuildOptions {
  const { positionals, values } = parseScriptArgs(USAGE, {
    allowPositionals: true,
    options: { out: { type: 'string' }, 'docs-url': { type: 'string' } },
  });
  return {
    openApiSource: positionals[0] ?? DEFAULT_OPENAPI_SOURCE,
    docsBaseUrl: normalizeDocsBaseUrl(values['docs-url'] ?? DOCS_SITE),
    outDir: path.resolve(values.out ?? DEFAULT_OUT_DIR),
  };
}

async function build({ openApiSource, docsBaseUrl, outDir }: BuildOptions): Promise<void> {
  assertReplaceableDataDir(outDir);
  const openApi = await buildOpenApi(openApiSource);
  const docs = await buildDocsIndex(docsBaseUrl);
  const stagingDir = `${outDir}.staging`;
  await rm(stagingDir, { recursive: true, force: true });
  try {
    await writeDataDir(stagingDir, openApi, docs);
    await replaceDirectory(outDir, stagingDir);
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
  log(`${openApi.apiOperations.length} operations and ${docs.sections} docs sections in ${outDir}`);
  log(`OpenAPI sha256 ${openApi.sha256}; docs sha256 ${docs.sha256}`);
}

function assertReplaceableDataDir(outDir: string): void {
  if (existsSync(outDir) && !existsSync(path.join(outDir, DATA_FILES.source))) {
    throw new ScriptError(`refusing to replace ${outDir}: it exists and has no ${DATA_FILES.source}.`);
  }
}

async function buildOpenApi(source: string): Promise<OpenApiBuild> {
  const text = await readOpenApiSource(source);
  const document = parseOpenApi(text);
  const operations = extractOperations(document);
  return { source, sha256: sha256(text), document, operations, apiOperations: listApiOperations(operations) };
}

async function buildDocsIndex(baseUrl: string): Promise<DocsBuild> {
  const llms = await fetchLlms(baseUrl);
  const downloads = await downloadMarkdown(baseUrl, parseLlms(llms));
  const index = new MiniSearch<DocsSection>(DOCS_INDEX_OPTIONS);
  index.addAll(downloads.map(({ item, markdown }) => toDocsSection(item, markdown)));
  return {
    baseUrl,
    sha256: sha256(llms, ...downloads.map(({ markdown }) => markdown)),
    sections: downloads.length,
    indexJson: JSON.stringify(index),
  };
}

async function writeDataDir(dataDir: string, openApi: OpenApiBuild, docs: DocsBuild): Promise<void> {
  const contractsDir = path.join(dataDir, DATA_FILES.operationContracts);
  await mkdir(contractsDir, { recursive: true });
  for (const operation of openApi.operations) {
    await writeFile(path.join(contractsDir, `${operation.operationId}.json`), serializeContract(buildContract(openApi.document, operation)));
  }
  await writeFile(path.join(dataDir, DATA_FILES.operations), JSON.stringify(openApi.apiOperations));
  await writeFile(path.join(dataDir, DATA_FILES.docsIndex), docs.indexJson);
  await writeFile(path.join(dataDir, DATA_FILES.source), JSON.stringify(sourceManifest(openApi, docs), null, 2));
}

function sourceManifest(openApi: OpenApiBuild, docs: DocsBuild): SourceManifest {
  return {
    openApi: { source: openApi.source, sha256: openApi.sha256, operations: openApi.apiOperations.length },
    docs: { baseUrl: docs.baseUrl, sha256: docs.sha256, sections: docs.sections },
  };
}

async function replaceDirectory(target: string, replacement: string): Promise<void> {
  const backup = `${target}.previous`;
  await rm(backup, { recursive: true, force: true });
  const hadPrevious = existsSync(target);
  if (hadPrevious) await rename(target, backup);
  try {
    await rename(replacement, target);
  } catch (error) {
    if (hadPrevious) await rename(backup, target);
    throw error;
  }
  await rm(backup, { recursive: true, force: true });
}

async function readOpenApiSource(source: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) return fetchText(source);
  try {
    return await readFile(source, 'utf8');
  } catch (error) {
    throw new OpenApiError(`cannot read ${source}: ${errorMessage(error)}`);
  }
}

function sha256(...parts: readonly string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex');
}

await runScript(SCRIPT_NAME, () => build(readOptions()));
