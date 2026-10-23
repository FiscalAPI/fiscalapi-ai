import type { McpServer } from '@modelcontextprotocol/server';

export interface McpTool {
  register(server: McpServer): void;
}
