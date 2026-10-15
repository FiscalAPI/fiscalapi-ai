// Transformación pura del OpenAPI de FiscalAPI a los datos que sirve el MCP: sin red ni disco.

export const MAX_OPERATION_CHARS = 40_000;

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
// El operationId se vuelve nombre de archivo: solo se aceptan ids que no puedan salir de data/operations.
const SAFE_OPERATION_ID = /^[A-Za-z][A-Za-z0-9_]*$/;
const PREFERRED_MEDIA_TYPE = 'application/json';
const DEFAULT_TAG = 'General';

export class OpenApiError extends Error {}

export function parseOpenApi(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new OpenApiError('la fuente no es JSON válido.');
  }
  if (!isObject(doc) || typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.') || !isObject(doc.paths)) {
    throw new OpenApiError('la fuente no es un documento OpenAPI 3 (faltan "openapi" o "paths").');
  }
  return doc;
}

export function extractOperations(doc) {
  const operations = [];
  const seen = new Set();
  for (const [path, pathItem] of Object.entries(doc.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isObject(operation)) continue;
      const id = operation.operationId;
      if (typeof id !== 'string' || !SAFE_OPERATION_ID.test(id)) {
        throw new OpenApiError(`${method.toUpperCase()} ${path} no tiene un operationId válido (${JSON.stringify(id)}).`);
      }
      if (seen.has(id)) throw new OpenApiError(`el operationId "${id}" está repetido.`);
      seen.add(id);
      operations.push({ id, method: method.toUpperCase(), path, pathItem, operation });
    }
  }
  if (operations.length === 0) throw new OpenApiError('el documento no tiene operaciones.');
  return operations;
}

export function buildCatalog(operations) {
  return operations
    .map(({ id, method, path, operation }) => ({
      id,
      method,
      path,
      summary: operation.summary ?? '',
      tag: operation.tags?.[0] ?? DEFAULT_TAG,
    }))
    .sort((a, b) => compare(a.tag, b.tag) || compare(a.id, b.id));
}

/**
 * Resuelve los $ref de la operación y la recorta, en etapas deterministas, hasta que su JSON
 * mida como máximo maxChars. Lanza OpenApiError si ni el recorte más agresivo cabe.
 */
export function buildOperation(doc, entry, maxChars = MAX_OPERATION_CHARS) {
  const full = new OperationResolver(doc, {}).resolve(entry);
  if (fits(full.value, maxChars)) return full.value;

  const withoutExamples = { dropExamples: true };
  let candidate = new OperationResolver(doc, withoutExamples).resolve(entry).value;
  if (fits(candidate, maxChars)) return candidate;

  for (let depth = full.maxDepth; depth >= 1; depth--) {
    candidate = new OperationResolver(doc, { ...withoutExamples, descriptionDepth: depth }).resolve(entry).value;
    if (fits(candidate, maxChars)) return candidate;
  }

  for (let depth = full.maxDepth; depth >= 0; depth--) {
    const options = { ...withoutExamples, descriptionDepth: 1, refDepth: depth };
    candidate = new OperationResolver(doc, options).resolve(entry).value;
    if (fits(candidate, maxChars)) return candidate;
  }
  throw new OpenApiError(`la operación "${entry.id}" mide más de ${maxChars} caracteres aun recortada.`);
}

export function serializeOperation(operation) {
  return JSON.stringify(operation);
}

/**
 * Resuelve una operación con unas opciones de recorte fijas. Profundidad 0 es la raíz del esquema
 * de un parámetro, cuerpo o respuesta; cada nivel de properties, items o additionalProperties suma uno.
 */
class OperationResolver {
  #doc;
  #dropExamples;
  #descriptionDepth;
  #refDepth;
  #maxDepth = 0;

  constructor(doc, { dropExamples = false, descriptionDepth = Infinity, refDepth = Infinity }) {
    this.#doc = doc;
    this.#dropExamples = dropExamples;
    this.#descriptionDepth = descriptionDepth;
    this.#refDepth = refDepth;
  }

  resolve({ id, method, path, pathItem, operation }) {
    const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
    const value = {
      operationId: id,
      method,
      path,
      tag: operation.tags?.[0] ?? DEFAULT_TAG,
      summary: operation.summary ?? '',
      description: operation.description ?? '',
    };
    if (operation.deprecated === true) value.deprecated = true;
    if (parameters.length > 0) value.parameters = parameters.map((p) => this.#parameter(p));
    if (operation.requestBody) value.requestBody = this.#withContent(this.#deref(operation.requestBody));
    if (operation.responses) value.responses = this.#responses(operation.responses);
    const security = operation.security ?? this.#doc.security;
    if (security) {
      value.security = security;
      value.securitySchemes = this.#securitySchemes(security);
    }
    return { value, maxDepth: this.#maxDepth };
  }

  #parameter(parameter) {
    const { schema, ...rest } = this.#withoutExamples(this.#deref(parameter));
    return schema === undefined ? rest : { ...rest, schema: this.#schema(schema, 0, []) };
  }

  #responses(responses) {
    const result = {};
    for (const [code, response] of Object.entries(responses)) {
      const resolved = this.#withContent(this.#deref(response));
      if (isObject(resolved.headers)) {
        resolved.headers = mapValues(resolved.headers, (header) => this.#parameter(header));
      }
      result[code] = resolved;
    }
    return result;
  }

  #withContent(holder) {
    if (!isObject(holder.content)) return { ...holder };
    const content = {};
    for (const [mediaType, media] of Object.entries(collapseMediaTypes(holder.content))) {
      const { schema, ...rest } = this.#withoutExamples(media);
      content[mediaType] = schema === undefined ? rest : { ...rest, schema: this.#schema(schema, 0, []) };
    }
    return { ...holder, content };
  }

  #schema(schema, depth, stack) {
    if (!isObject(schema)) return schema;
    this.#maxDepth = Math.max(this.#maxDepth, depth);

    if (typeof schema.$ref === 'string') {
      const { $ref, ...siblings } = schema;
      const name = refName($ref);
      if (stack.includes($ref)) return { type: 'object', 'x-recursivo': name };
      if (depth > this.#refDepth) return { type: 'object', 'x-recortado': name };
      return this.#schema({ ...this.#pointer($ref), ...siblings }, depth, [...stack, $ref]);
    }

    const result = {};
    for (const [key, value] of Object.entries(schema)) {
      if (this.#dropExamples && (key === 'example' || key === 'examples')) continue;
      if (key === 'description' && depth >= this.#descriptionDepth) continue;
      result[key] = this.#schemaKeyword(key, value, depth, stack);
    }
    return result;
  }

  #schemaKeyword(key, value, depth, stack) {
    switch (key) {
      case 'properties':
      case 'patternProperties':
        return isObject(value) ? mapValues(value, (child) => this.#schema(child, depth + 1, stack)) : value;
      case 'items':
      case 'additionalProperties':
      case 'not':
        return this.#schema(value, depth + 1, stack);
      case 'allOf':
      case 'oneOf':
      case 'anyOf':
      case 'prefixItems':
        return Array.isArray(value) ? value.map((child) => this.#schema(child, depth, stack)) : value;
      default:
        return value;
    }
  }

  #securitySchemes(security) {
    const declared = this.#doc.components?.securitySchemes ?? {};
    const names = [...new Set(security.flatMap((requirement) => Object.keys(requirement)))];
    return Object.fromEntries(names.filter((name) => declared[name]).map((name) => [name, declared[name]]));
  }

  #withoutExamples(object) {
    if (!this.#dropExamples) return { ...object };
    const { example: _example, examples: _examples, ...rest } = object;
    return rest;
  }

  // Parámetros, cuerpos y respuestas también pueden venir por $ref a components.
  #deref(object, seen = new Set()) {
    if (!isObject(object) || typeof object.$ref !== 'string') return object;
    if (seen.has(object.$ref)) throw new OpenApiError(`$ref circular fuera de un esquema: ${object.$ref}.`);
    seen.add(object.$ref);
    return this.#deref(this.#pointer(object.$ref), seen);
  }

  #pointer(ref) {
    if (!ref.startsWith('#/')) throw new OpenApiError(`solo se admiten $ref locales: ${ref}.`);
    let target = this.#doc;
    for (const segment of ref.slice(2).split('/')) {
      const key = decodeURIComponent(segment).replaceAll('~1', '/').replaceAll('~0', '~');
      target = isObject(target) ? target[key] : undefined;
    }
    if (target === undefined) throw new OpenApiError(`$ref sin destino: ${ref}.`);
    return target;
  }
}

// ASP.NET publica el mismo esquema en application/json, text/json, text/plain y application/*+json.
// Se conserva application/json y solo los tipos cuyo contenido es distinto.
function collapseMediaTypes(content) {
  const preferred = content[PREFERRED_MEDIA_TYPE];
  if (preferred === undefined) return content;
  const preferredJson = JSON.stringify(preferred);
  return Object.fromEntries(
    Object.entries(content).filter(
      ([mediaType, media]) => mediaType === PREFERRED_MEDIA_TYPE || JSON.stringify(media) !== preferredJson,
    ),
  );
}

function fits(operation, maxChars) {
  return serializeOperation(operation).length <= maxChars;
}

function refName(ref) {
  return ref.slice(ref.lastIndexOf('/') + 1);
}

function mapValues(object, fn) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, fn(value)]));
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Orden por unidades de código: no depende del locale ni de la versión de ICU.
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
