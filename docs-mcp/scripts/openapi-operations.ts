import type { ApiOperation } from '../src/api-operations.ts';
import { FILE_SAFE_OPERATION_ID } from '../src/data-files.ts';
import { ScriptError } from './script-runner.ts';

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface OpenApiDocument extends JsonObject {
  openapi: string;
  paths: JsonObject;
}

export interface ExtractedOperation {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly pathItem: JsonObject;
  readonly operation: JsonObject;
}

export interface OperationContract extends JsonObject {
  operationId: string;
  method: string;
  path: string;
  tag: string;
  summary: string;
  description: string;
}

interface TrimOptions {
  readonly dropExamples: boolean;
  readonly descriptionDepth: number;
  readonly refDepth: number;
}

export const MAX_CONTRACT_CHARS = 40_000;

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
const PREFERRED_MEDIA_TYPE = 'application/json';
const DEFAULT_TAG = 'General';
const FULL: TrimOptions = { dropExamples: false, descriptionDepth: Infinity, refDepth: Infinity };

export class OpenApiError extends ScriptError {}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseOpenApi(text: string): OpenApiDocument {
  let document: JsonValue;
  try {
    document = JSON.parse(text);
  } catch {
    throw new OpenApiError('the source is not valid JSON.');
  }
  if (!isOpenApiDocument(document)) {
    throw new OpenApiError('the source is not an OpenAPI 3 document (missing "openapi" or "paths").');
  }
  return document;
}

export function extractOperations(document: OpenApiDocument): ExtractedOperation[] {
  const operations: ExtractedOperation[] = [];
  const seen = new Set<string>();
  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (!isJsonObject(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isJsonObject(operation)) continue;
      const operationId = operation['operationId'];
      if (typeof operationId !== 'string' || !FILE_SAFE_OPERATION_ID.test(operationId)) {
        throw new OpenApiError(`${method.toUpperCase()} ${path} has no valid operationId (${JSON.stringify(operationId)}).`);
      }
      const caseInsensitiveId = operationId.toLowerCase();
      if (seen.has(caseInsensitiveId)) throw new OpenApiError(`duplicate operationId "${operationId}" (ignoring case).`);
      seen.add(caseInsensitiveId);
      operations.push({ operationId, method: method.toUpperCase(), path, pathItem, operation });
    }
  }
  if (operations.length === 0) throw new OpenApiError('the document has no operations.');
  return operations;
}

export function listApiOperations(operations: readonly ExtractedOperation[]): ApiOperation[] {
  return operations
    .map(({ operationId, method, path, operation }) => ({
      operationId,
      method,
      path,
      summary: stringField(operation, 'summary'),
      tag: firstTag(operation),
    }))
    .sort((a, b) => compareCodeUnits(a.tag, b.tag) || compareCodeUnits(a.operationId, b.operationId));
}

export function buildContract(
  document: OpenApiDocument,
  operation: ExtractedOperation,
  maxChars: number = MAX_CONTRACT_CHARS,
): OperationContract {
  const full = new ContractResolver(document, FULL);
  const fullContract = full.resolve(operation);
  if (fits(fullContract, maxChars)) return fullContract;

  for (const options of trimStages(full.maxDepth)) {
    const contract = new ContractResolver(document, options).resolve(operation);
    if (fits(contract, maxChars)) return contract;
  }
  throw new OpenApiError(`operation "${operation.operationId}" exceeds ${maxChars} characters even when trimmed.`);
}

export function serializeContract(contract: OperationContract): string {
  return JSON.stringify(contract);
}

function* trimStages(maxDepth: number): Generator<TrimOptions> {
  yield { dropExamples: true, descriptionDepth: Infinity, refDepth: Infinity };
  for (let depth = maxDepth; depth >= 1; depth--) yield { dropExamples: true, descriptionDepth: depth, refDepth: Infinity };
  for (let depth = maxDepth; depth >= 0; depth--) yield { dropExamples: true, descriptionDepth: 1, refDepth: depth };
}

class ContractResolver {
  readonly #document: OpenApiDocument;
  readonly #options: TrimOptions;
  #maxDepth = 0;

  constructor(document: OpenApiDocument, options: TrimOptions) {
    this.#document = document;
    this.#options = options;
  }

  get maxDepth(): number {
    return this.#maxDepth;
  }

  resolve({ operationId, method, path, pathItem, operation }: ExtractedOperation): OperationContract {
    const contract: OperationContract = {
      operationId,
      method,
      path,
      tag: firstTag(operation),
      summary: stringField(operation, 'summary'),
      description: stringField(operation, 'description'),
    };
    if (operation['deprecated'] === true) contract['deprecated'] = true;

    const parameters = [...arrayField(pathItem, 'parameters'), ...arrayField(operation, 'parameters')];
    if (parameters.length > 0) contract['parameters'] = parameters.map((parameter) => this.#parameter(parameter));

    const requestBody = operation['requestBody'];
    if (requestBody !== undefined) contract['requestBody'] = this.#withContent(this.#deref(requestBody));

    const responses = operation['responses'];
    if (isJsonObject(responses)) contract['responses'] = this.#responses(responses);

    const security = operation['security'] ?? this.#document['security'];
    if (Array.isArray(security)) {
      contract['security'] = security;
      contract['securitySchemes'] = this.#securitySchemes(security);
    }
    return contract;
  }

  #parameter(parameter: JsonValue): JsonValue {
    const resolved = this.#deref(parameter);
    if (!isJsonObject(resolved)) return resolved;
    const { schema, ...rest } = this.#withoutExamples(resolved);
    return schema === undefined ? rest : { ...rest, schema: this.#schema(schema, 0, []) };
  }

  #responses(responses: JsonObject): JsonObject {
    return mapValues(responses, (response) => {
      const resolved = this.#withContent(this.#deref(response));
      if (!isJsonObject(resolved) || !isJsonObject(resolved['headers'])) return resolved;
      return { ...resolved, headers: mapValues(resolved['headers'], (header) => this.#parameter(header)) };
    });
  }

  #withContent(holder: JsonValue): JsonValue {
    if (!isJsonObject(holder) || !isJsonObject(holder['content'])) return holder;
    const content = mapValues(distinctMediaTypes(holder['content']), (media) => {
      if (!isJsonObject(media)) return media;
      const { schema, ...rest } = this.#withoutExamples(media);
      return schema === undefined ? rest : { ...rest, schema: this.#schema(schema, 0, []) };
    });
    return { ...holder, content };
  }

  #schema(schema: JsonValue, depth: number, refStack: readonly string[]): JsonValue {
    if (!isJsonObject(schema)) return schema;
    this.#maxDepth = Math.max(this.#maxDepth, depth);

    const { $ref, ...siblings } = schema;
    if (typeof $ref === 'string') {
      const name = $ref.slice($ref.lastIndexOf('/') + 1);
      if (refStack.includes($ref)) return { type: 'object', 'x-recursive': name };
      if (depth > this.#options.refDepth) return { type: 'object', 'x-truncated': name };
      const target = this.#pointer($ref);
      return this.#schema(isJsonObject(target) ? { ...target, ...siblings } : target, depth, [...refStack, $ref]);
    }

    const result: JsonObject = {};
    for (const [key, value] of Object.entries(schema)) {
      if (this.#options.dropExamples && (key === 'example' || key === 'examples')) continue;
      if (key === 'description' && depth >= this.#options.descriptionDepth) continue;
      result[key] = this.#schemaKeyword(key, value, depth, refStack);
    }
    return result;
  }

  #schemaKeyword(key: string, value: JsonValue, depth: number, refStack: readonly string[]): JsonValue {
    switch (key) {
      case 'properties':
      case 'patternProperties':
        return isJsonObject(value) ? mapValues(value, (child) => this.#schema(child, depth + 1, refStack)) : value;
      case 'items':
      case 'additionalProperties':
      case 'not':
        return this.#schema(value, depth + 1, refStack);
      case 'allOf':
      case 'oneOf':
      case 'anyOf':
      case 'prefixItems':
        return Array.isArray(value) ? value.map((child) => this.#schema(child, depth, refStack)) : value;
      default:
        return value;
    }
  }

  #securitySchemes(security: readonly JsonValue[]): JsonObject {
    const components = this.#document['components'];
    const declared = isJsonObject(components) && isJsonObject(components['securitySchemes']) ? components['securitySchemes'] : {};
    const names = new Set(security.flatMap((requirement) => (isJsonObject(requirement) ? Object.keys(requirement) : [])));
    return Object.fromEntries(Object.entries(declared).filter(([name]) => names.has(name)));
  }

  #withoutExamples(object: JsonObject): JsonObject {
    if (!this.#options.dropExamples) return { ...object };
    const { example: _example, examples: _examples, ...rest } = object;
    return rest;
  }

  #deref(value: JsonValue, seen: ReadonlySet<string> = new Set()): JsonValue {
    if (!isJsonObject(value)) return value;
    const ref = value['$ref'];
    if (typeof ref !== 'string') return value;
    if (seen.has(ref)) throw new OpenApiError(`circular $ref outside a schema: ${ref}.`);
    return this.#deref(this.#pointer(ref), new Set([...seen, ref]));
  }

  #pointer(ref: string): JsonValue {
    if (!ref.startsWith('#/')) throw new OpenApiError(`only local $ref values are supported: ${ref}.`);
    let target: JsonValue | undefined = this.#document;
    for (const segment of ref.slice(2).split('/')) {
      const key = decodeURIComponent(segment).replaceAll('~1', '/').replaceAll('~0', '~');
      target = isJsonObject(target) ? target[key] : undefined;
    }
    if (target === undefined) throw new OpenApiError(`unresolved $ref: ${ref}.`);
    return target;
  }
}

function isOpenApiDocument(value: JsonValue): value is OpenApiDocument {
  return isJsonObject(value) && typeof value['openapi'] === 'string' && value['openapi'].startsWith('3.') && isJsonObject(value['paths']);
}

function distinctMediaTypes(content: JsonObject): JsonObject {
  const preferred = content[PREFERRED_MEDIA_TYPE];
  if (preferred === undefined) return content;
  const preferredJson = JSON.stringify(preferred);
  return Object.fromEntries(
    Object.entries(content).filter(([mediaType, media]) => mediaType === PREFERRED_MEDIA_TYPE || JSON.stringify(media) !== preferredJson),
  );
}

function stringField(object: JsonObject, key: string): string {
  const value = object[key];
  return typeof value === 'string' ? value : '';
}

function arrayField(object: JsonObject, key: string): JsonValue[] {
  const value = object[key];
  return Array.isArray(value) ? value : [];
}

function firstTag(operation: JsonObject): string {
  const [tag] = arrayField(operation, 'tags');
  return typeof tag === 'string' ? tag : DEFAULT_TAG;
}

function fits(contract: OperationContract, maxChars: number): boolean {
  return serializeContract(contract).length <= maxChars;
}

function mapValues(object: JsonObject, transform: (value: JsonValue) => JsonValue): JsonObject {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value)]));
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
