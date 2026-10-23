import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const DOCS_SITE = 'https://docs.fiscalapi.com';
const DEFAULT_OPENAPI_SOURCE = 'https://live.fiscalapi.com/api/openapi/v4.json';
const DEFAULT_ROOTS = ['skills', 'commands'];
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
const DOCS_URL = /https:\/\/docs\.fiscalapi\.com[^\s)<>"'`\]]*/g;
const TRAILING_PUNCTUATION = /[.,;:]+$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const FRONTMATTER_FIELD = /^([A-Za-z-]+):\s*(.*)$/;
const QUOTED_VALUE = /^(['"])([\s\S]*)\1$/;
const HTML_ANCHOR = /\s(?:id|name)="([^"]+)"/g;
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_SKILL_LINES = 500;
const REQUEST_TIMEOUT_MS = 30_000;

interface CheckOptions {
  readonly roots: readonly string[];
  readonly docsOrigin: string;
  readonly openApiSource: string;
}

type LinkSources = Map<string, string[]>;

function readOptions(): CheckOptions {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { 'docs-origin': { type: 'string' }, openapi: { type: 'string' } },
  });
  return {
    roots: positionals.length > 0 ? positionals : DEFAULT_ROOTS,
    docsOrigin: (values['docs-origin'] ?? DOCS_SITE).replace(/\/+$/, ''),
    openApiSource: values.openapi ?? DEFAULT_OPENAPI_SOURCE,
  };
}

async function exists(target: string): Promise<boolean> {
  return stat(target).then(
    () => true,
    () => false,
  );
}

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return markdownFiles(fullPath);
      return Promise.resolve(entry.name.endsWith('.md') ? [fullPath] : []);
    }),
  );
  return nested.flat();
}

function frontmatterFields(source: string): Map<string, string> | undefined {
  const block = FRONTMATTER.exec(source.replace(/\r\n/g, '\n'))?.[1];
  if (block === undefined) return undefined;
  const fields = new Map<string, string>();
  for (const line of block.split('\n')) {
    const [, key, value] = FRONTMATTER_FIELD.exec(line) ?? [];
    if (key !== undefined && value !== undefined) fields.set(key, value.trim().replace(QUOTED_VALUE, '$2'));
  }
  return fields;
}

function skillProblems(file: string, source: string): string[] {
  const fields = frontmatterFields(source);
  if (fields === undefined) return [`${file}: missing frontmatter (--- ... ---) at the top`];
  const lineCount = source.split('\n').length;
  return [
    ...nameProblems(file, fields.get('name')),
    ...descriptionProblems(file, fields.get('description')),
    ...(lineCount >= MAX_SKILL_LINES ? [`${file}: has ${lineCount} lines (must be under ${MAX_SKILL_LINES})`] : []),
  ];
}

function nameProblems(file: string, name: string | undefined): string[] {
  if (name === undefined) return [`${file}: missing 'name'`];
  const folder = path.basename(path.dirname(file));
  const problems: string[] = [];
  if (name !== folder) problems.push(`${file}: 'name' (${name}) differs from its folder (${folder})`);
  if (!SKILL_NAME.test(name) || name.length > MAX_NAME_LENGTH) {
    problems.push(`${file}: 'name' must use lowercase letters, digits and hyphens, up to ${MAX_NAME_LENGTH} characters`);
  }
  return problems;
}

function descriptionProblems(file: string, description: string | undefined): string[] {
  if (description === undefined) return [`${file}: missing 'description'`];
  if (/^[>|]/.test(description)) return [`${file}: 'description' must be a single line (YAML blocks > or | are not supported)`];
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return [`${file}: 'description' has ${description.length} characters (max ${MAX_DESCRIPTION_LENGTH})`];
  }
  return [];
}

function collectDocsUrls(text: string, location: string, sources: LinkSources): void {
  for (const [url] of text.matchAll(DOCS_URL)) {
    const cleanUrl = url.replace(TRAILING_PUNCTUATION, '');
    sources.set(cleanUrl, [...(sources.get(cleanUrl) ?? []), location]);
  }
}

async function readOpenApi(source: string): Promise<unknown> {
  if (!/^https?:\/\//.test(source)) return JSON.parse(await readFile(source, 'utf8'));
  const response = await fetch(source, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${source} responded HTTP ${response.status}`);
  return response.json();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function anchorsIn(html: string): ReadonlySet<string> {
  return new Set([...html.matchAll(HTML_ANCHOR)].flatMap(([, id]) => (id === undefined ? [] : [id])));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function openApiDocsUrls(source: string): Promise<LinkSources> {
  const document = await readOpenApi(source);
  const sources: LinkSources = new Map();
  if (!isRecord(document)) return sources;
  const info = document['info'];
  collectDocsUrls(stringOrEmpty(isRecord(info) ? info['description'] : undefined), 'OpenAPI info.description', sources);
  const paths = document['paths'];
  for (const [route, pathItem] of Object.entries(isRecord(paths) ? paths : {})) {
    if (!isRecord(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isRecord(operation)) continue;
      const operationLabel = stringOrEmpty(operation['operationId']) || `${method} ${route}`;
      collectDocsUrls(stringOrEmpty(operation['description']), `OpenAPI ${operationLabel}`, sources);
    }
  }
  return sources;
}

class LinkChecker {
  readonly #docsOrigin: string;
  readonly #anchorsByPage = new Map<string, Promise<ReadonlySet<string> | undefined>>();

  constructor(docsOrigin: string) {
    this.#docsOrigin = docsOrigin;
  }

  async problems(url: string): Promise<string[]> {
    const [publishedUrl = url, anchor] = url.split('#');
    const address = publishedUrl.replace(DOCS_SITE, this.#docsOrigin);
    let response: Response;
    try {
      response = await fetch(address, { redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      return [`${url}: cannot be fetched (${errorMessage(error)})`];
    }
    await response.body?.cancel();
    if (response.status !== 200) return [`${url}: responded HTTP ${response.status}`];
    if (anchor === undefined || anchor === '') return [];

    const anchors = await this.#pageAnchors(address.replace(/\.md$/, ''));
    if (anchors === undefined) return [`${url}: the HTML page of its anchor does not respond`];
    return anchors.has(anchor) ? [] : [`${url}: anchor #${anchor} does not exist`];
  }

  #pageAnchors(pageUrl: string): Promise<ReadonlySet<string> | undefined> {
    let anchors = this.#anchorsByPage.get(pageUrl);
    if (anchors === undefined) {
      anchors = fetch(pageUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).then(
        async (response) => (response.ok ? anchorsIn(await response.text()) : undefined),
        () => undefined,
      );
      this.#anchorsByPage.set(pageUrl, anchors);
    }
    return anchors;
  }
}

async function checkSkills({ roots, docsOrigin, openApiSource }: CheckOptions): Promise<number> {
  const files: string[] = [];
  for (const root of roots) if (await exists(root)) files.push(...(await markdownFiles(root)));

  const problems: string[] = [];
  const sources: LinkSources = new Map();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (path.basename(file) === 'SKILL.md') problems.push(...skillProblems(file, source));
    collectDocsUrls(source, file, sources);
  }
  const skillLinkCount = sources.size;

  let openApiLinkCount = 0;
  try {
    const openApiSources = await openApiDocsUrls(openApiSource);
    openApiLinkCount = openApiSources.size;
    for (const [url, locations] of openApiSources) sources.set(url, [...(sources.get(url) ?? []), ...locations]);
  } catch (error) {
    problems.push(`${openApiSource}: cannot read the OpenAPI (${errorMessage(error)})`);
  }

  const linkChecker = new LinkChecker(docsOrigin);
  for (const [url, locations] of sources) {
    for (const problem of await linkChecker.problems(url)) problems.push(`${locations.join(', ')}: ${problem}`);
  }

  console.log(
    `${files.length} files with ${skillLinkCount} links and the OpenAPI with ${openApiLinkCount}: ` +
      `${sources.size} links to ${DOCS_SITE} checked against ${docsOrigin}, ${problems.length} problems`,
  );
  for (const problem of problems) console.log(`- ${problem}`);
  return problems.length;
}

process.exitCode = (await checkSkills(readOptions())) > 0 ? 1 : 0;
