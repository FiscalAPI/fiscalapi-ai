// Genera mcp/data desde el OpenAPI público de FiscalAPI.
//
// Uso: node scripts/build-data.mjs [fuente] [--out <directorio>]
//   fuente: URL http(s) o ruta de archivo. Por omisión FISCALAPI_OPENAPI_SOURCE o el OpenAPI de live.
//   --out:  directorio de salida. Por omisión mcp/data.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { buildCatalog, buildOperation, extractOperations, OpenApiError, parseOpenApi, serializeOperation } from './openapi.mjs';

const DEFAULT_SOURCE = 'https://live.fiscalapi.com/api/openapi/v4.json';
const DEFAULT_OUT_DIR = fileURLToPath(new URL('../data', import.meta.url));
const FETCH_TIMEOUT_MS = 60_000;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' } },
  });
  const source = positionals[0] ?? process.env.FISCALAPI_OPENAPI_SOURCE ?? DEFAULT_SOURCE;
  const outDir = path.resolve(values.out ?? DEFAULT_OUT_DIR);

  const text = await readSource(source);
  const doc = parseOpenApi(text);
  const operations = extractOperations(doc);
  const catalog = buildCatalog(operations);

  const staging = `${outDir}.tmp-${process.pid}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(path.join(staging, 'operations'), { recursive: true });
  let largest = { id: '', chars: 0 };
  for (const entry of operations) {
    const json = serializeOperation(buildOperation(doc, entry));
    if (json.length > largest.chars) largest = { id: entry.id, chars: json.length };
    await writeFile(path.join(staging, 'operations', `${entry.id}.json`), json);
  }
  await writeFile(path.join(staging, 'catalog.json'), JSON.stringify(catalog));
  const sha256 = createHash('sha256').update(text).digest('hex');
  await writeFile(path.join(staging, 'source.json'), JSON.stringify({ source, sha256, operations: catalog.length }, null, 2));

  // Se reemplaza de golpe para que un build fallido nunca deje data/ a medias.
  await rm(outDir, { recursive: true, force: true });
  await rename(staging, outDir);

  console.error(`build-data: ${catalog.length} operaciones en ${outDir}`);
  console.error(`build-data: la más grande es ${largest.id} con ${largest.chars} caracteres`);
  console.error(`build-data: sha256 ${sha256}`);
}

async function readSource(source) {
  if (!/^https?:\/\//i.test(source)) {
    try {
      return await readFile(source, 'utf8');
    } catch (error) {
      throw new OpenApiError(`no se pudo leer ${source}: ${error.message}`);
    }
  }
  let response;
  try {
    response = await fetch(source, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    throw new OpenApiError(`no se pudo descargar ${source}: ${error.message}`);
  }
  if (response.status !== 200) {
    throw new OpenApiError(`${source} respondió HTTP ${response.status}; se esperaba 200.`);
  }
  return response.text();
}

try {
  await main();
} catch (error) {
  const message = error instanceof OpenApiError ? error.message : (error?.stack ?? String(error));
  console.error(`build-data: ${message}`);
  process.exitCode = 1;
}
