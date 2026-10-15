import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { TestProject } from 'vitest/node';

import { readDocsCorpus, serveDocs } from './docs-server.js';
import { runBuildData } from './run-build-data.js';

export const packageDir = fileURLToPath(new URL('../', import.meta.url));
export const fixturePath = path.join(packageDir, 'test', 'fixtures', 'openapi-v4.json');

// Los datos de prueba van a un directorio temporal: npm test nunca pisa el data/ que se publica.
// La documentación sale del fixture servido en local, así que el build de prueba no usa la red.
export default async function setup(project: TestProject): Promise<() => void> {
  const workDir = mkdtempSync(path.join(tmpdir(), 'fiscalapi-mcp-'));
  const dataDir = path.join(workDir, 'data');
  const docs = await serveDocs(readDocsCorpus());
  let build: { code: number | null; stderr: string };
  try {
    build = await runBuildData([fixturePath, '--docs-origin', docs.origin, '--out', dataDir]);
  } finally {
    await docs.close();
  }
  if (build.code !== 0) {
    rmSync(workDir, { recursive: true, force: true });
    throw new Error(`build-data falló con el fixture:\n${build.stderr}`);
  }
  project.provide('dataDir', pathToFileURL(dataDir + path.sep).href);
  return () => rmSync(workDir, { recursive: true, force: true });
}

declare module 'vitest' {
  export interface ProvidedContext {
    dataDir: string;
  }
}
