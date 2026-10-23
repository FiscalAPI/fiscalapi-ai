import type { DocsSection } from '../src/docs-index-options.ts';
import { fetchText } from './http.ts';
import { ScriptError } from './script-runner.ts';

export interface LlmsEntry {
  readonly url: string;
  readonly page: string;
}

export interface CleanSection {
  readonly title: string;
  readonly endpoint: string;
  readonly text: string;
}

export const DOCS_SITE = 'https://docs.fiscalapi.com';
const DOWNLOAD_CONCURRENCY = 4;

const SITE_MARKDOWN_URL = `${escapeRegExp(DOCS_SITE)}/\\S+?\\.md`;
const PAGE_LINE = new RegExp(`^- \\[([^\\]]+)\\]\\((${SITE_MARKDOWN_URL})\\)`);
const SECTION_LINE = new RegExp(`^ {2}- \\[([^\\]]+)\\]\\((${SITE_MARKDOWN_URL})\\)`);
const ANY_MARKDOWN_LINK = new RegExp(`\\((${SITE_MARKDOWN_URL})\\)`, 'g');

const CODE_BLOCK = /```[\s\S]*?```/g;
const HEADING = /^#{1,2} (.+)$/m;
const ANNOTATION = /\{\{([\s\S]*?)\}\}/g;
const FIRST_ANNOTATION = new RegExp(ANNOTATION.source);
const ANNOTATION_TAG = /\btag:\s*'([^']*)'/;
const ANNOTATION_LABEL = /\blabel:\s*'([^']*)'/;
const TAG_WITH_NAME_ATTRIBUTE = /<[A-Za-z][^>]*?\sname="([^"]*)"[^>]*>/g;
const ITEM_WITH_VALUE_ATTRIBUTE = /<Item\s[^>]*?\bvalue=(?:'"?([^'"]*)"?'|"([^"]*)")[^>]*>/g;
const ANY_TAG = /<\/?[A-Za-z][^>]*>/g;
const LINK = /!?\[([^\]]*)\]\([^)]*\)/g;
const BACKTICK = /`/g;
const LINE_INDENT = /^[ \t]+|[ \t]+$/gm;
const REPEATED_BLANK_LINES = /\n{3,}/g;
const HTML_DOCUMENT = /^\s*<(!doctype|html)\b/i;

export class DocsError extends ScriptError {}

interface LlmsPage {
  readonly title: string;
  readonly url: string;
  readonly sections: string[];
}

export function parseLlms(text: string): LlmsEntry[] {
  const pages = new Map<string, LlmsPage>();
  let currentPage: LlmsPage | undefined;
  for (const line of text.split(/\r?\n/)) {
    const [, pageTitle, pageUrl] = PAGE_LINE.exec(line) ?? [];
    if (pageTitle !== undefined && pageUrl !== undefined) {
      currentPage = pages.get(pageUrl) ?? { title: pageTitle, url: pageUrl, sections: [] };
      pages.set(pageUrl, currentPage);
      continue;
    }
    const [, , sectionUrl] = SECTION_LINE.exec(line) ?? [];
    if (sectionUrl !== undefined) currentPage?.sections.push(sectionUrl);
  }

  const entries = new Map<string, LlmsEntry>();
  for (const page of pages.values()) {
    const urls = page.sections.length > 0 ? page.sections : [page.url];
    for (const url of urls) if (!entries.has(url)) entries.set(url, { url, page: page.title });
  }
  if (entries.size === 0) throw new DocsError(`llms.txt links no .md page of ${DOCS_SITE}.`);
  return [...entries.values()];
}

export function listMarkdownUrls(llms: string): string[] {
  return [...new Set([...llms.matchAll(ANY_MARKDOWN_LINK)].flatMap(([, url]) => (url === undefined ? [] : [url])))];
}

export function sitePath(url: string): string {
  return url.slice(DOCS_SITE.length);
}

export function cleanSection(markdown: string): CleanSection {
  const withoutCode = markdown.replace(CODE_BLOCK, '');
  const heading = HEADING.exec(withoutCode)?.[1] ?? '';
  const text = withoutCode
    .replace(HEADING, '')
    .replace(ANNOTATION, '')
    .replace(TAG_WITH_NAME_ATTRIBUTE, '$1')
    .replace(ITEM_WITH_VALUE_ATTRIBUTE, (_, quoted: string | undefined, plain: string | undefined) => `${quoted ?? plain ?? ''} `)
    .replace(ANY_TAG, '')
    .replace(LINK, '$1')
    .replace(BACKTICK, '')
    .replace(LINE_INDENT, '')
    .replace(REPEATED_BLANK_LINES, '\n\n')
    .trim();
  return { title: heading.replace(ANNOTATION, '').trim(), endpoint: endpointOf(heading), text };
}

export function toDocsSection({ url, page }: LlmsEntry, markdown: string): DocsSection {
  const { title, endpoint, text } = cleanSection(markdown);
  return { id: url, url, page, title: title || page, endpoint, text };
}

export function fetchLlms(docsBaseUrl: string): Promise<string> {
  return fetchMarkdown(`${docsBaseUrl}/llms.txt`);
}

export interface DownloadedMarkdown<T> {
  readonly item: T;
  readonly markdown: string;
}

export async function downloadMarkdown<T extends { readonly url: string }>(
  docsBaseUrl: string,
  items: readonly T[],
): Promise<DownloadedMarkdown<T>[]> {
  const downloads: DownloadedMarkdown<T>[] = [];
  const pending = items.entries();
  const cancellation = new AbortController();
  async function downloadNext(): Promise<void> {
    for (const [index, item] of pending) {
      try {
        downloads[index] = { item, markdown: await fetchMarkdown(`${docsBaseUrl}${sitePath(item.url)}`, cancellation.signal) };
      } catch (error) {
        cancellation.abort(error);
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, items.length) }, downloadNext));
  return downloads;
}

export function normalizeDocsBaseUrl(docsBaseUrl: string): string {
  if (!URL.canParse(docsBaseUrl)) throw new DocsError(`the docs base URL is not valid: ${docsBaseUrl}`);
  const { protocol } = new URL(docsBaseUrl);
  if (protocol !== 'http:' && protocol !== 'https:') throw new DocsError(`the docs base URL must be http(s): ${docsBaseUrl}`);
  return docsBaseUrl.replace(/\/+$/, '');
}

async function fetchMarkdown(url: string, signal?: AbortSignal): Promise<string> {
  const body = await fetchText(url, signal);
  if (HTML_DOCUMENT.test(body)) throw new DocsError(`${url} returned HTML instead of Markdown.`);
  return body;
}

function endpointOf(heading: string): string {
  const annotation = FIRST_ANNOTATION.exec(heading)?.[1];
  if (annotation === undefined) return '';
  const method = ANNOTATION_TAG.exec(annotation)?.[1];
  const path = ANNOTATION_LABEL.exec(annotation)?.[1];
  return method !== undefined && path !== undefined ? `${method} ${path}` : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
