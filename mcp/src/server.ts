import { McpServer } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import type { CatalogEntry, OperationCatalog } from './catalog.js';
import type { DocsIndex, DocsResult } from './docs.js';

export const SERVER_NAME = 'fiscalapi';

// Las herramientas solo leen archivos del paquete: no llaman a la API ni a ningún otro servicio.
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const MAX_ECHOED_INPUT = 100;
const MAX_QUERY_CHARS = 200;
const MAX_DOCS_RESULTS = 10;
const DEFAULT_DOCS_RESULTS = 5;

export function createServer(catalog: OperationCatalog, docs: DocsIndex, version: string): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version });

  server.registerTool(
    'listar_operaciones',
    {
      title: 'Listar operaciones de FiscalAPI',
      description:
        'Lista las operaciones de la API REST de FiscalAPI (facturas CFDI 4.0 y complementos, cancelación, descarga masiva del SAT, personas, productos, certificados, webhooks y más), agrupadas por tag: operationId, método, ruta y resumen. Úsala para encontrar el endpoint que necesitas; el siguiente paso es llamar a obtener_operacion con su operationId para ver parámetros, cuerpo y respuestas. No llama a la API ni pide llaves.',
      inputSchema: z.object({
        tag: z
          .string()
          .max(MAX_ECHOED_INPUT)
          .optional()
          .describe('Tag por el que filtrar, sin distinguir mayúsculas (por ejemplo Invoices, People o Products). Omítelo para ver todas.'),
      }),
      annotations: READ_ONLY,
    },
    async ({ tag }) => listOperations(catalog, tag),
  );

  server.registerTool(
    'obtener_operacion',
    {
      title: 'Obtener una operación de FiscalAPI',
      description:
        'Devuelve en JSON el detalle de una operación de la API de FiscalAPI: método, ruta, descripción con el enlace a su documentación, parámetros, cuerpo y respuestas con los esquemas resueltos. Usa el operationId exacto que da listar_operaciones. No llama a la API ni pide llaves.',
      inputSchema: z.object({
        operationId: z
          .string()
          .min(1)
          .max(MAX_ECHOED_INPUT)
          .describe('operationId exacto de la operación, tal como aparece en listar_operaciones (por ejemplo createInvoice).'),
      }),
      annotations: READ_ONLY,
    },
    async ({ operationId }) => getOperation(catalog, operationId),
  );

  server.registerTool(
    'buscar_docs',
    {
      title: 'Buscar en la documentación de FiscalAPI',
      description:
        'Busca en las secciones de docs.fiscalapi.com: guías, reglas fiscales del SAT, catálogos, errores del PAC por código (como CFDI40147) y la referencia de cada endpoint. Devuelve de cada resultado el título, la página, la URL .md de la sección y un extracto; para leer la sección completa, descarga esa URL. No llama a la API ni pide llaves.',
      inputSchema: z.object({
        consulta: z
          .string()
          .min(1)
          .max(MAX_QUERY_CHARS)
          .describe('Qué buscar, en español o por código (por ejemplo "cancelar factura", "complemento de pago" o "CFDI40147").'),
        limite: z
          .number()
          .int()
          .min(1)
          .max(MAX_DOCS_RESULTS)
          .optional()
          .describe(`Número máximo de resultados, de 1 a ${MAX_DOCS_RESULTS}. Por omisión ${DEFAULT_DOCS_RESULTS}.`),
      }),
      annotations: READ_ONLY,
    },
    async ({ consulta, limite }) => searchDocs(docs, consulta, limite ?? DEFAULT_DOCS_RESULTS),
  );

  return server;
}

function listOperations(catalog: OperationCatalog, tag: string | undefined): CallToolResult {
  const entries = catalog.list(tag);
  if (entries.length === 0) {
    return error(`No hay operaciones con el tag "${tag}". Tags disponibles: ${catalog.tags.join(', ')}.`);
  }
  const header =
    `FiscalAPI: ${entries.length} operaciones. Para ver parámetros, cuerpo y respuestas de una, ` +
    'llama a obtener_operacion con su operationId.';
  return text([header, ...groupByTag(entries)].join('\n'));
}

async function getOperation(catalog: OperationCatalog, operationId: string): Promise<CallToolResult> {
  const operation = await catalog.readOperation(operationId);
  if (operation !== undefined) return text(operation);

  const suggestions = catalog.suggest(operationId);
  const hint = suggestions.length > 0 ? `¿Quisiste decir ${suggestions.join(', ')}? ` : '';
  return error(`No existe la operación "${operationId}". ${hint}Usa listar_operaciones para ver los operationId disponibles.`);
}

function searchDocs(docs: DocsIndex, query: string, limit: number): CallToolResult {
  const results = docs.search(query, limit);
  const echoed = clip(query);
  // Sin resultados no es un error de la llamada: el agente debe reformular, no reintentar igual.
  if (results.length === 0) {
    return text(
      `FiscalAPI docs: no hay resultados para "${echoed}". Prueba con otras palabras, o usa listar_operaciones para ver los endpoints de la API.`,
    );
  }
  const count = results.length === 1 ? '1 resultado' : `${results.length} resultados`;
  const blocks = results.map((result) => `## ${heading(result)}\n${result.url}\n\n${result.excerpt}`);
  return text([`FiscalAPI docs: ${count} para "${echoed}".`, ...blocks].join('\n\n'));
}

// Una página sin secciones se indexa entera y su título es el de la página: no se repite.
function heading({ title, page }: DocsResult): string {
  return title === page ? title : `${title} (${page})`;
}

// La consulta admite más caracteres de los que vale la pena repetir en la respuesta.
function clip(value: string): string {
  return value.length > MAX_ECHOED_INPUT ? `${value.slice(0, MAX_ECHOED_INPUT)}…` : value;
}

function groupByTag(entries: readonly CatalogEntry[]): string[] {
  const lines: string[] = [];
  let currentTag: string | undefined;
  for (const entry of entries) {
    if (entry.tag !== currentTag) {
      currentTag = entry.tag;
      lines.push('', `## ${entry.tag}`);
    }
    lines.push(`${entry.id}  ${entry.method} ${entry.path}  ${entry.summary}`);
  }
  return lines;
}

function text(value: string): CallToolResult {
  return { content: [{ type: 'text', text: value }] };
}

function error(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
