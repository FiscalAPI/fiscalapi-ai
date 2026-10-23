import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import type { ApiOperation, OperationListing } from '../api-operations.ts';
import type { McpTool } from './mcp-tool.ts';
import { API_SPECIFICATION_NOTICE, MAX_IDENTIFIER_CHARS, READ_ONLY_ANNOTATIONS, TOOL_NAMES } from './tool-conventions.ts';
import { errorResult, textResult } from './tool-results.ts';

export class ListOperationsTool implements McpTool {
  readonly #operations: OperationListing;

  constructor(operations: OperationListing) {
    this.#operations = operations;
  }

  register(server: McpServer): void {
    server.registerTool(
      TOOL_NAMES.listOperations,
      {
        title: 'Listar las operaciones de la API de FiscalAPI',
        description:
          'Devuelve las operaciones de la API REST de FiscalAPI (CFDI/Factura 4.0 y complementos, cancelación, descarga masiva del SAT, personas, productos, certificados, webhooks y más), agrupadas por tag, con operationId, método HTTP, ruta y resumen. ' +
          `Úsala para encontrar la operación que necesitas; después llama a ${TOOL_NAMES.getOperation} con su operationId. ${API_SPECIFICATION_NOTICE}`,
        inputSchema: z.object({
          tag: z
            .string()
            .max(MAX_IDENTIFIER_CHARS)
            .optional()
            .describe(`Tag por el que filtrar, sin distinguir mayúsculas. Valores: ${this.#operations.tags.join(', ')}. Omítelo para listar todas.`),
        }),
        annotations: READ_ONLY_ANNOTATIONS,
      },
      ({ tag }) => this.#listOperations(tag),
    );
  }

  #listOperations(tag: string | undefined): CallToolResult {
    const operations = this.#operations.list(tag);
    if (operations.length === 0) {
      return errorResult(`No hay operaciones con el tag "${tag ?? ''}". Tags disponibles: ${this.#operations.tags.join(', ')}.`);
    }
    const header = `FiscalAPI: ${operations.length} operaciones. Para ver el contrato de una, llama a ${TOOL_NAMES.getOperation} con su operationId.`;
    return textResult([header, ...linesGroupedByTag(operations)].join('\n'));
  }
}

function linesGroupedByTag(operations: readonly ApiOperation[]): string[] {
  const groups = Map.groupBy(operations, (operation) => operation.tag);
  return [...groups].flatMap(([tag, taggedOperations]) => [
    '',
    `## ${tag}`,
    ...taggedOperations.map(({ operationId, method, path, summary }) => `${operationId}  ${method} ${path}  ${summary}`),
  ]);
}
