import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'node:zlib';

import * as z from 'zod/v4';

const docsCorpusSchema = z.object({
  llms: z.string(),
  files: z.record(z.string(), z.string()),
});

export type DocsCorpus = z.infer<typeof docsCorpusSchema>;

export interface LocalServer {
  readonly origin: string;
  close(): Promise<void>;
}

const LOOPBACK_HOST = '127.0.0.1';
const LOOPBACK_ORIGIN = `http://${LOOPBACK_HOST}`;
const corpusFile = new URL('fixtures/docs-corpus.json.gz', import.meta.url);

export function readDocsCorpus(): DocsCorpus {
  return docsCorpusSchema.parse(JSON.parse(gunzipSync(readFileSync(corpusFile)).toString('utf8')));
}

export interface LocalResponse {
  readonly status: number;
  readonly body?: string;
}

export function serveDocs(corpus: DocsCorpus): Promise<LocalServer> {
  const routes = new Map(Object.entries({ ...corpus.files, '/llms.txt': corpus.llms }));
  return serveLocally((pathname) => {
    const body = routes.get(pathname);
    return body === undefined ? { status: 404 } : { status: 200, body };
  });
}

export async function serveLocally(respond: (pathname: string) => LocalResponse): Promise<LocalServer> {
  const server = createServer((request, response) => {
    const { status, body } = respond(new URL(request.url ?? '/', LOOPBACK_ORIGIN).pathname);
    response.writeHead(status, { 'content-type': 'text/markdown; charset=utf-8' }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, LOOPBACK_HOST, resolve));
  return {
    origin: `http://${LOOPBACK_HOST}:${portOf(server.address())}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function portOf(address: AddressInfo | string | null): number {
  if (address === null || typeof address === 'string') throw new Error('Expected a TCP address.');
  return address.port;
}
