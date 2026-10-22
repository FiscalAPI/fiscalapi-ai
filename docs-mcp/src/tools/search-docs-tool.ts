import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import type { DocsSearch, DocsSearchResult } from '../docs-index.ts';
import type { McpTool } from './mcp-tool.ts';
import { MAX_IDENTIFIER_CHARS, PUBLIC_DOCS_NOTICE, READ_ONLY_ANNOTATIONS, TOOL_NAMES } from './tool-conventions.ts';
import { textResult } from './tool-results.ts';

export const SEARCH_LIMITS = {
  maxQueryChars: 200,
  maxEchoedQueryChars: MAX_IDENTIFIER_CHARS,
  maxResults: 10,
  defaultResults: 5,
} as const;

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(SEARCH_LIMITS.maxQueryChars)
    .describe('Qué buscar, en español o por código (por ejemplo "cancelar factura", "complemento de pago" o "CFDI40147").'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(SEARCH_LIMITS.maxResults)
    .optional()
    .describe(`Número máximo de resultados, de 1 a ${SEARCH_LIMITS.maxResults}. Por omisión, ${SEARCH_LIMITS.defaultResults}.`),
});

export class SearchDocsTool implements McpTool {
  readonly #docs: DocsSearch;

  constructor(docs: DocsSearch) {
    this.#docs = docs;
  }

  register(server: McpServer): void {
    server.registerTool(
      TOOL_NAMES.searchDocs,
      {
        title: 'Buscar en la documentación de FiscalAPI',
        description:
          'Busca en las secciones de docs.fiscalapi.com: guías, reglas fiscales del SAT, catálogos SAT, errores de validación y rechazos del PAC por código (por ejemplo CFDI40147) y la referencia de cada operación. ' +
          'Devuelve por resultado el título, la página, la URL .md de la sección y un extracto. ' +
          `Úsala para saber qué regla aplica, qué significa un error o qué valor de catálogo usar; para leer la sección completa, descarga su URL .md. ${PUBLIC_DOCS_NOTICE}`,
        inputSchema,
        annotations: READ_ONLY_ANNOTATIONS,
      },
      ({ query, limit }) => this.#searchDocs(query, limit ?? SEARCH_LIMITS.defaultResults),
    );
  }

  #searchDocs(query: string, limit: number): CallToolResult {
    const results = this.#docs.search(query, limit);
    const echoedQuery = echo(query);
    if (results.length === 0) {
      return textResult(
        `FiscalAPI docs: no hay resultados para "${echoedQuery}". Prueba con otras palabras o usa ${TOOL_NAMES.listOperations} para ver las operaciones de la API.`,
      );
    }
    const count = results.length === 1 ? '1 resultado' : `${results.length} resultados`;
    const blocks = results.map((result) => `## ${resultHeading(result)}\n${result.url}\n\n${result.excerpt}`);
    return textResult([`FiscalAPI docs: ${count} para "${echoedQuery}".`, ...blocks].join('\n\n'));
  }
}

function echo(query: string): string {
  return query.length > SEARCH_LIMITS.maxEchoedQueryChars ? `${query.slice(0, SEARCH_LIMITS.maxEchoedQueryChars)}…` : query;
}

function resultHeading({ title, page }: DocsSearchResult): string {
  return title === page ? title : `${title} (${page})`;
}
