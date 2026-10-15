import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { TestProject } from 'vitest/node';

export const packageDir = fileURLToPath(new URL('../', import.meta.url));
export const fixturePath = path.join(packageDir, 'test', 'fixtures', 'openapi-v4.json');

// Los datos de prueba van a un directorio temporal: npm test nunca pisa el data/ que se publica.
export default function setup(project: TestProject): () => void {
  const workDir = mkdtempSync(path.join(tmpdir(), 'fiscalapi-mcp-'));
  const dataDir = path.join(workDir, 'data');
  const build = spawnSync(process.execPath, ['scripts/build-data.mjs', fixturePath, '--out', dataDir], {
    cwd: packageDir,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
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
