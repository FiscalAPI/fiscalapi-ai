// Documentación de docs.fiscalapi.com para el índice de buscar_docs. parseLlms y cleanSection son
// transformaciones puras; fetchLlms y downloadMarkdown son la única parte que usa la red.

// El llms.txt siempre enlaza a este sitio; para descargar de otro origen se cambia solo el prefijo.
export const DOCS_SITE = 'https://docs.fiscalapi.com';
export const DOWNLOAD_CONCURRENCY = 8;
export const FETCH_TIMEOUT_MS = 60_000;

const SITE_URL = `${escapeRegExp(DOCS_SITE)}/\\S+?\\.md`;
// Una página: "- [Título](https://docs.fiscalapi.com/ruta.md): descripción".
const PAGE_LINE = new RegExp(`^- \\[([^\\]]+)\\]\\((${SITE_URL})\\)`);
// Una sección de la página anterior: "  - [Título](https://docs.fiscalapi.com/ruta/slug.md)".
const SECTION_LINE = new RegExp(`^ {2}- \\[([^\\]]+)\\]\\((${SITE_URL})\\)`);
const ANY_MD_LINK = new RegExp(`\\((${SITE_URL})\\)`, 'g');

const CODE_BLOCK = /```[\s\S]*?```/g;
const HEADING = /^#{1,2} (.+)$/m;
const ANNOTATION = /\{\{([\s\S]*?)\}\}/g;
const ANNOTATION_TAG = /\btag:\s*'([^']*)'/;
const ANNOTATION_LABEL = /\blabel:\s*'([^']*)'/;
const TAG_WITH_NAME = /<[A-Za-z][^>]*?\sname="([^"]*)"[^>]*>/g;
// <Item value='"01"'> o <Item value="0">: el valor, sin comillas.
const ITEM_VALUE = /<Item\s[^>]*?\bvalue=(?:'"?([^'"]*)"?'|"([^"]*)")[^>]*>/g;
const ANY_TAG = /<\/?[A-Za-z][^>]*>/g;
const LINK = /!?\[([^\]]*)\]\([^)]*\)/g;
const INLINE_CODE_MARK = /`/g;
const LINE_INDENT = /^[ \t]+|[ \t]+$/gm;
const REPEATED_BLANK_LINES = /\n{3,}/g;

export class DocsError extends Error {}

/**
 * Los documentos a indexar, sin repetir URL y en el orden del llms.txt: cada sección con el título
 * de su página, y cada página sin secciones entera. Una página con secciones no se indexa entera
 * porque es la suma de ellas y competiría con sus propias secciones.
 */
export function parseLlms(text) {
  const pages = new Map();
  let current;
  for (const line of text.split(/\r?\n/)) {
    const page = PAGE_LINE.exec(line);
    if (page) {
      const [, title, url] = page;
      current = pages.get(url) ?? { title, url, sections: [] };
      pages.set(url, current);
      continue;
    }
    const section = SECTION_LINE.exec(line);
    if (section && current) current.sections.push(section[2]);
  }

  const documents = new Map();
  for (const page of pages.values()) {
    const urls = page.sections.length > 0 ? page.sections : [page.url];
    for (const url of urls) if (!documents.has(url)) documents.set(url, { url, page: page.title });
  }
  if (documents.size === 0) throw new DocsError(`el llms.txt no enlaza ninguna página .md de ${DOCS_SITE}.`);
  return [...documents.values()];
}

/** Todas las URLs .md del llms.txt, páginas y secciones, sin repetir. */
export function listMarkdownUrls(text) {
  return [...new Set([...text.matchAll(ANY_MD_LINK)].map((match) => match[1]))];
}

/** La ruta de una URL del sitio, por ejemplo /invoices/cancelar-factura.md. */
export function sitePath(url) {
  return url.slice(DOCS_SITE.length);
}

/**
 * Convierte el MDX crudo de una sección en texto indexable y legible: título del primer encabezado,
 * endpoint de su anotación {{ tag, label }} y el cuerpo sin código, etiquetas ni URLs. Conserva los
 * saltos de línea y las tablas para que el extracto se lea.
 */
export function cleanSection(markdown) {
  const withoutCode = markdown.replace(CODE_BLOCK, '');
  const heading = HEADING.exec(withoutCode)?.[1] ?? '';
  const text = withoutCode
    .replace(HEADING, '')
    .replace(ANNOTATION, '')
    // El name de <Property> es el nombre del campo: se busca por él.
    .replace(TAG_WITH_NAME, '$1')
    // El value de un <Item> es la clave del catálogo (por ejemplo el motivo de cancelación "01").
    .replace(ITEM_VALUE, (_, quoted, plain) => `${quoted ?? plain} `)
    .replace(ANY_TAG, '')
    .replace(LINK, '$1')
    // El tokenizador no corta en el acento grave: `sat.blacklist.69b` indexaría "69b`" y no "69b".
    .replace(INLINE_CODE_MARK, '')
    .replace(LINE_INDENT, '')
    .replace(REPEATED_BLANK_LINES, '\n\n')
    .trim();
  return { title: heading.replace(ANNOTATION, '').trim(), endpoint: endpointOf(heading), text };
}

/** El documento del índice de una sección; si la sección no tiene encabezado, se titula como su página. */
export function toDocument({ url, page }, markdown) {
  const { title, endpoint, text } = cleanSection(markdown);
  return { id: url, url, page, title: title || page, endpoint, text };
}

export async function fetchLlms(origin) {
  return fetchMarkdown(`${origin}/llms.txt`);
}

/** Descarga las URLs del sitio desde origin, como mucho 8 a la vez; devuelve el Markdown en el mismo orden. */
export async function downloadMarkdown(origin, urls) {
  const markdown = new Array(urls.length);
  let next = 0;
  let failed = false;
  async function worker() {
    while (!failed && next < urls.length) {
      const index = next++;
      try {
        markdown[index] = await fetchMarkdown(`${origin}${sitePath(urls[index])}`);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, urls.length) }, worker));
  return markdown;
}

/** El origen sin "/" final; solo se aceptan URLs http(s). */
export function normalizeOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new DocsError(`el origen de la documentación no es una URL válida: ${origin}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new DocsError(`el origen de la documentación debe ser http(s): ${origin}`);
  }
  return origin.replace(/\/+$/, '');
}

// Un 200 con HTML es la página del sitio (por ejemplo un 404 servido como página) y no su Markdown.
async function fetchMarkdown(url) {
  let response;
  let body;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new DocsError(`${url} respondió HTTP ${response.status}; se esperaba 200.`);
    }
    body = await response.text();
  } catch (error) {
    if (error instanceof DocsError) throw error;
    throw new DocsError(`no se pudo descargar ${url}: ${error.message}`);
  }
  if (body.trimStart().startsWith('<')) throw new DocsError(`${url} devolvió HTML en lugar de Markdown.`);
  return body;
}

function endpointOf(heading) {
  const annotation = [...heading.matchAll(ANNOTATION)][0]?.[1];
  if (annotation === undefined) return '';
  const tag = ANNOTATION_TAG.exec(annotation)?.[1];
  const label = ANNOTATION_LABEL.exec(annotation)?.[1];
  return tag !== undefined && label !== undefined ? `${tag} ${label}` : '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
