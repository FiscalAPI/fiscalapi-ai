import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DATA_FILES = {
  operations: 'operations.json',
  operationContracts: 'operations/',
  docsIndex: 'docs-index.json',
  source: 'source.json',
} as const;

export const FILE_SAFE_OPERATION_ID = /^[A-Za-z][A-Za-z0-9_]*$/;

export class DataFileError extends Error {}

export function readDataFile<T>(dataDir: URL, name: string, parse: (json: string) => T): T {
  const file = new URL(name, dataDir);
  try {
    return parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new DataFileError(`Cannot read ${fileURLToPath(file)}. Reinstall the package or regenerate the data with npm run build:data.`, {
      cause: error,
    });
  }
}
