import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { inject } from 'vitest';

import { ApiOperations } from '../src/api-operations.ts';
import { DocsIndex } from '../src/docs-index.ts';
import { createServer } from '../src/server.ts';

export interface ConnectedClient {
  readonly client: Client;
  close(): Promise<void>;
}

export function dataDirUrl(): URL {
  return new URL(inject('dataDir'));
}

export async function connectClient(): Promise<ConnectedClient> {
  const server = createServer({
    operations: ApiOperations.load(dataDirUrl()),
    docs: DocsIndex.load(dataDirUrl()),
    version: '0.0.0-test',
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'fiscalapi-docs-mcp-test', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

export function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  return client.callTool({ name, arguments: args });
}

export function textOf(result: CallToolResult): string {
  const [block] = result.content;
  if (block?.type !== 'text') throw new Error('Expected a text content block.');
  return block.text;
}

export function jsonAt(value: unknown, ...path: readonly string[]): unknown {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
