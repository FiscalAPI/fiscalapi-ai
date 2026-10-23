import { McpServer } from '@modelcontextprotocol/server';

import type { OperationContracts, OperationListing } from './api-operations.ts';
import type { DocsSearch } from './docs-index.ts';
import { GetOperationTool } from './tools/get-operation-tool.ts';
import { ListOperationsTool } from './tools/list-operations-tool.ts';
import type { McpTool } from './tools/mcp-tool.ts';
import { SearchDocsTool } from './tools/search-docs-tool.ts';

export const SERVER_NAME = 'fiscalapi-docs';

export interface ServerDependencies {
  readonly operations: OperationListing & OperationContracts;
  readonly docs: DocsSearch;
  readonly version: string;
}

export function createServer({ operations, docs, version }: ServerDependencies): McpServer {
  return registerTools(new McpServer({ name: SERVER_NAME, version }), [
    new ListOperationsTool(operations),
    new GetOperationTool(operations),
    new SearchDocsTool(docs),
  ]);
}

function registerTools(server: McpServer, tools: readonly McpTool[]): McpServer {
  for (const tool of tools) tool.register(server);
  return server;
}
