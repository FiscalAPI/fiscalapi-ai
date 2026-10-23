import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

import { downloadMarkdown, fetchLlms, listMarkdownUrls, normalizeDocsBaseUrl, sitePath } from './docs-sections.ts';
import { createLogger, parseScriptArgs, runScript, ScriptError } from './script-runner.ts';

const SCRIPT_NAME = 'snapshot-docs';
const USAGE = 'node scripts/snapshot-docs.ts <docs-url> <output.json.gz>';

async function snapshotDocs(): Promise<void> {
  const { positionals } = parseScriptArgs(USAGE, { allowPositionals: true, options: {} });
  const [docsUrlArgument, outFile] = positionals;
  if (docsUrlArgument === undefined || outFile === undefined) throw new ScriptError(`usage: ${USAGE}`);

  const docsBaseUrl = normalizeDocsBaseUrl(docsUrlArgument);
  const llms = await fetchLlms(docsBaseUrl);
  const downloads = await downloadMarkdown(docsBaseUrl, listMarkdownUrls(llms).map((url) => ({ url })));
  const files = Object.fromEntries(downloads.map(({ item, markdown }) => [sitePath(item.url), markdown]));
  await writeFile(outFile, gzipSync(JSON.stringify({ llms, files })));
  createLogger(SCRIPT_NAME)(`${downloads.length} .md files from ${docsBaseUrl} written to ${outFile}`);
}

await runScript(SCRIPT_NAME, snapshotDocs);
