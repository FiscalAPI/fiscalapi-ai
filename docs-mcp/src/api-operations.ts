import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import * as z from 'zod/v4';

import { DATA_FILES, DataFileError, FILE_SAFE_OPERATION_ID, readDataFile } from './data-files.ts';
import { suggestOperationIds } from './operation-suggestions.ts';

const apiOperationSchema = z.object({
  operationId: z.string().regex(FILE_SAFE_OPERATION_ID),
  method: z.string(),
  path: z.string(),
  summary: z.string(),
  tag: z.string(),
});

export type ApiOperation = z.infer<typeof apiOperationSchema>;

export interface OperationListing {
  readonly tags: readonly string[];
  list(tag?: string): readonly ApiOperation[];
}

export interface OperationContracts {
  readContract(operationId: string): Promise<string | undefined>;
  suggestSimilarIds(operationId: string): string[];
}

export class ApiOperations implements OperationListing, OperationContracts {
  readonly tags: readonly string[];
  readonly #operations: readonly ApiOperation[];
  readonly #byId: ReadonlyMap<string, ApiOperation>;
  readonly #contractsDir: URL;

  private constructor(operations: readonly ApiOperation[], contractsDir: URL) {
    this.#operations = operations;
    this.#byId = new Map(operations.map((operation) => [operation.operationId, operation]));
    this.#contractsDir = contractsDir;
    this.tags = [...new Set(operations.map((operation) => operation.tag))];
  }

  static load(dataDir: URL): ApiOperations {
    const operations = readDataFile(dataDir, DATA_FILES.operations, (json) => z.array(apiOperationSchema).parse(JSON.parse(json)));
    const apiOperations = new ApiOperations(operations, new URL(DATA_FILES.operationContracts, dataDir));
    apiOperations.#assertContractsExist();
    return apiOperations;
  }

  list(tag?: string): readonly ApiOperation[] {
    if (tag === undefined) return this.#operations;
    const wantedTag = tag.toLowerCase();
    return this.#operations.filter((operation) => operation.tag.toLowerCase() === wantedTag);
  }

  async readContract(operationId: string): Promise<string | undefined> {
    const operation = this.#byId.get(operationId);
    if (operation === undefined) return undefined;
    return readFile(this.#contractFile(operation), 'utf8');
  }

  suggestSimilarIds(operationId: string): string[] {
    return suggestOperationIds([...this.#byId.keys()], operationId);
  }

  #contractFile(operation: ApiOperation): URL {
    return new URL(`${operation.operationId}.json`, this.#contractsDir);
  }

  #assertContractsExist(): void {
    const missing = this.#operations.map((operation) => this.#contractFile(operation)).filter((file) => !existsSync(file));
    if (missing.length > 0) {
      throw new DataFileError(`Missing operation contracts: ${missing.map((file) => fileURLToPath(file)).join(', ')}.`);
    }
  }
}
