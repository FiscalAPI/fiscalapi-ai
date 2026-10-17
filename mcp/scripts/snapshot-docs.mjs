// Guarda una copia de la documentación para las pruebas: llms.txt y todas las .md que enlaza.
//
// Uso: node scripts/snapshot-docs.mjs <origen> <salida.json.gz>
//   origen: de dónde descargar, por ejemplo http://localhost:3999 o https://docs.fiscalapi.com.
//   salida: { "llms": "<texto>", "files": { "/<ruta>.md": "<markdown>" } } comprimido con gzip.
import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

import { DocsError, downloadMarkdown, fetchLlms, listMarkdownUrls, normalizeOrigin, sitePath } from './docs.mjs';

async function main() {
  const [originArg, outFile] = process.argv.slice(2);
  if (originArg === undefined || outFile === undefined) {
    throw new DocsError('uso: node scripts/snapshot-docs.mjs <origen> <salida.json.gz>');
  }
  const origin = normalizeOrigin(originArg);
  const llms = await fetchLlms(origin);
  const urls = listMarkdownUrls(llms);
  const markdown = await downloadMarkdown(origin, urls);
  const files = Object.fromEntries(urls.map((url, i) => [sitePath(url), markdown[i]]));
  await writeFile(outFile, gzipSync(JSON.stringify({ llms, files })));
  console.error(`snapshot-docs: ${urls.length} archivos .md de ${origin} en ${outFile}`);
}

try {
  await main();
} catch (error) {
  console.error(`snapshot-docs: ${error instanceof DocsError ? error.message : (error?.stack ?? String(error))}`);
  process.exitCode = 1;
}
