export const TOOL_NAMES = {
  listOperations: 'fiscalapi_list_operations',
  getOperation: 'fiscalapi_get_operation',
  searchDocs: 'fiscalapi_search_docs',
} as const;

export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const API_SPECIFICATION_NOTICE =
  'Solo consulta la especificación pública de la API (OpenAPI): no llama a la API y no requiere API key.';

export const PUBLIC_DOCS_NOTICE = 'Solo consulta la documentación pública de FiscalAPI: no llama a la API y no requiere API key.';

export const MAX_IDENTIFIER_CHARS = 100;
