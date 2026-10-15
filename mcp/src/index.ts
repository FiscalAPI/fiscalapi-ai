#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { OperationCatalog } from './catalog.js';
import { createServer } from './server.js';

// stdout es el canal del protocolo: todo diagnóstico va a stderr.
const packageRoot = new URL('../', import.meta.url);

let catalog: OperationCatalog;
let version: string;
try {
  version = (JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8')) as { version: string }).version;
  catalog = OperationCatalog.load(new URL('data/', packageRoot));
} catch (error) {
  console.error(`fiscalapi-mcp: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const handle = serveStdio(() => createServer(catalog, version), {
  onerror: (error) => console.error(`fiscalapi-mcp: ${error.message}`),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void handle.close().finally(() => process.exit(0));
  });
}
