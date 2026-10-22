import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { TestProject } from 'vitest/node';

import { readDocsCorpus, serveDocs } from './docs-server.ts';
import { runBuildData } from './run-build-data.ts';

export const openApiFixture = fileURLToPath(new URL('fixtures/openapi-v4.json', import.meta.url));

export default async function setup(project: TestProject): Promise<() => void> {
  const workDir = mkdtempSync(path.join(tmpdir(), 'fiscalapi-docs-mcp-'));
  const dataDir = path.join(workDir, 'data');
  const docs = await serveDocs(readDocsCorpus());
  const build = await runBuildData([openApiFixture, '--docs-url', docs.origin, '--out', dataDir]).finally(() => docs.close());
  if (build.code !== 0) {
    rmSync(workDir, { recursive: true, force: true });
    throw new Error(`build-data failed with the fixtures:\n${build.stderr}`);
  }
  project.provide('dataDir', pathToFileURL(dataDir + path.sep).href);
  return () => rmSync(workDir, { recursive: true, force: true });
}

declare module 'vitest' {
  export interface ProvidedContext {
    dataDir: string;
  }
}
