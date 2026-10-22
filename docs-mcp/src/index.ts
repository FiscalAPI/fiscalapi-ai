#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

import { ApiOperations } from './api-operations.ts';
import { DocsIndex } from './docs-index.ts';
import { createServer, SERVER_NAME } from './server.ts';

const packageRoot = new URL('../', import.meta.url);
const dataDir = new URL('data/', packageRoot);

function readPackageVersion(): string {
  const packageJson: unknown = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'));
  return z.object({ version: z.string() }).parse(packageJson).version;
}

function logError(error: unknown): void {
  console.error(`${SERVER_NAME}: ${inspect(error, { depth: 4 })}`);
}

try {
  const dependencies = { operations: ApiOperations.load(dataDir), docs: DocsIndex.load(dataDir), version: readPackageVersion() };
  serveStdio(() => createServer(dependencies), { onerror: logError });
} catch (error) {
  logError(error);
  process.exitCode = 1;
}
