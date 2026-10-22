import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import type { OperationContracts } from '../api-operations.ts';
import type { McpTool } from './mcp-tool.ts';
import { API_SPECIFICATION_NOTICE, MAX_IDENTIFIER_CHARS, READ_ONLY_ANNOTATIONS, TOOL_NAMES } from './tool-conventions.ts';
import { errorResult, textResult } from './tool-results.ts';

const inputSchema = z.object({
  operationId: z
    .string()
    .min(1)
    .max(MAX_IDENTIFIER_CHARS)
    .describe(`operationId exacto, tal como lo devuelve ${TOOL_NAMES.listOperations} (por ejemplo createInvoice).`),
});

export class GetOperationTool implements McpTool {
  readonly #contracts: OperationContracts;

  constructor(contracts: OperationContracts) {
    this.#contracts = contracts;
  }

  register(server: McpServer): void {
    server.registerTool(
      TOOL_NAMES.getOperation,
      {
        title: 'Obtener el contrato de una operación de FiscalAPI',
        description:
          'Devuelve en JSON el contrato de una operación de la API de FiscalAPI: método HTTP, ruta, descripción con el enlace a su documentación, parámetros, cuerpo de la petición y respuestas, con los esquemas resueltos. ' +
          `Un esquema que no cabe se resume como x-truncated y uno recursivo como x-recursive, con el nombre del esquema; para conocer sus campos, búscalo por ese nombre con ${TOOL_NAMES.searchDocs}. ` +
          `Úsala antes de escribir el código que llama a la operación. Requiere el operationId exacto que devuelve ${TOOL_NAMES.listOperations}. ${API_SPECIFICATION_NOTICE}`,
        inputSchema,
        annotations: READ_ONLY_ANNOTATIONS,
      },
      ({ operationId }) => this.#getOperation(operationId),
    );
  }

  async #getOperation(operationId: string): Promise<CallToolResult> {
    const contract = await this.#contracts.readContract(operationId);
    if (contract !== undefined) return textResult(contract);

    const suggestions = this.#contracts.suggestSimilarIds(operationId);
    const hint = suggestions.length > 0 ? `¿Quisiste decir ${suggestions.join(', ')}? ` : '';
    return errorResult(`No existe la operación "${operationId}". ${hint}Usa ${TOOL_NAMES.listOperations} para ver los operationId disponibles.`);
  }
}
