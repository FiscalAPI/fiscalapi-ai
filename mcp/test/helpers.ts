import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { inject } from 'vitest';

import { OperationCatalog } from '../src/catalog.js';
import { DocsIndex } from '../src/docs.js';
import { createServer } from '../src/server.js';

export function dataDirUrl(): URL {
  return new URL(inject('dataDir'));
}

/** Cliente MCP en proceso conectado al servidor por el transporte en memoria del SDK. */
export async function connectClient(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer(OperationCatalog.load(dataDirUrl()), DocsIndex.load(dataDirUrl()), '0.0.0-test');
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'fiscalapi-mcp-test', version: '1.0.0' });
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

export async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

export function textOf(result: CallToolResult): string {
  const [block] = result.content;
  if (block?.type !== 'text') throw new Error('Se esperaba un bloque de texto.');
  return block.text;
}
