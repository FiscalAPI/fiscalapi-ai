import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'node:zlib';

/** El formato que escribe scripts/snapshot-docs.mjs: llms.txt y cada .md por su ruta. */
export interface DocsCorpus {
  readonly llms: string;
  readonly files: Readonly<Record<string, string>>;
}

export interface DocsServer {
  readonly origin: string;
  close(): Promise<void>;
}

const corpusFile = new URL('fixtures/docs-corpus.json.gz', import.meta.url);

export function readDocsCorpus(): DocsCorpus {
  return JSON.parse(gunzipSync(readFileSync(corpusFile)).toString('utf8')) as DocsCorpus;
}

/** Sirve el corpus en 127.0.0.1 como lo haría docs.fiscalapi.com: /llms.txt, cada ruta .md y 404 para lo demás. */
export async function serveDocs(corpus: DocsCorpus): Promise<DocsServer> {
  const routes = new Map(Object.entries({ ...corpus.files, '/llms.txt': corpus.llms }));
  const server = createServer((request, response) => {
    const body = routes.get(new URL(request.url ?? '/', 'http://localhost').pathname);
    if (body === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
