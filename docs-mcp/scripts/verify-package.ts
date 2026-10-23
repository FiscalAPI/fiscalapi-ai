import { spawnSync } from 'node:child_process';

import * as z from 'zod/v4';

import { DATA_FILES } from '../src/data-files.ts';
import { createLogger, runScript, ScriptError } from './script-runner.ts';

const SCRIPT_NAME = 'verify-package';
const PACK_COMMAND = 'npm pack --dry-run --json --ignore-scripts';
const REQUIRED_FILES = [
  'package.json',
  'README.md',
  'LICENSE',
  'dist/index.js',
  'dist/server.js',
  `data/${DATA_FILES.operations}`,
  `data/${DATA_FILES.docsIndex}`,
  `data/${DATA_FILES.source}`,
] as const;

const packResultSchema = z.array(
  z.object({
    name: z.string(),
    version: z.string(),
    files: z.array(z.object({ path: z.string() })),
  }),
);

function packedFiles(): { readonly id: string; readonly paths: ReadonlySet<string> } {
  const pack = spawnSync(PACK_COMMAND, { encoding: 'utf8', shell: true });
  if (pack.status !== 0) throw new ScriptError(`npm pack failed: ${pack.stderr}`);
  const [result] = packResultSchema.parse(JSON.parse(pack.stdout));
  if (result === undefined) throw new ScriptError('npm pack returned no package.');
  return { id: `${result.name}@${result.version}`, paths: new Set(result.files.map((file) => file.path)) };
}

async function verifyPackage(): Promise<void> {
  const { id, paths } = packedFiles();
  const missing = REQUIRED_FILES.filter((file) => !paths.has(file));
  if (missing.length > 0) throw new ScriptError(`${id} is missing ${missing.join(', ')}. Run npm run build and npm run build:data.`);
  const contracts = [...paths].filter((file) => file.startsWith(`data/${DATA_FILES.operationContracts}`)).length;
  if (contracts === 0) throw new ScriptError(`${id} has no operation contracts.`);
  createLogger(SCRIPT_NAME)(`${id} contains ${paths.size} files, ${contracts} operation contracts included.`);
}

await runScript(SCRIPT_NAME, verifyPackage);
