import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface CatalogEntry {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly summary: string;
  readonly tag: string;
}

const MAX_SUGGESTIONS = 5;

/**
 * Catálogo de operaciones generado por scripts/build-data.mjs. Solo lee archivos de data/ cuyo
 * nombre sale del propio catálogo, nunca de la entrada del usuario.
 */
export class OperationCatalog {
  readonly #entries: readonly CatalogEntry[];
  readonly #byId: ReadonlyMap<string, CatalogEntry>;
  readonly #operationsDir: URL;

  private constructor(entries: readonly CatalogEntry[], dataDir: URL) {
    this.#entries = entries;
    this.#byId = new Map(entries.map((entry) => [entry.id, entry]));
    this.#operationsDir = new URL('operations/', dataDir);
  }

  /** dataDir debe terminar en "/" para que las rutas relativas se resuelvan dentro de él. */
  static load(dataDir: URL): OperationCatalog {
    const catalogFile = new URL('catalog.json', dataDir);
    let entries: CatalogEntry[];
    try {
      entries = JSON.parse(readFileSync(catalogFile, 'utf8')) as CatalogEntry[];
    } catch (error) {
      throw new Error(`No se pudo leer el catálogo de operaciones (${fileURLToPath(catalogFile)}). Corre npm run build:data.`, {
        cause: error,
      });
    }
    return new OperationCatalog(entries, dataDir);
  }

  get tags(): string[] {
    return [...new Set(this.#entries.map((entry) => entry.tag))];
  }

  /** Las operaciones en el orden del catálogo (tag, operationId); con tag, solo las de ese tag sin distinguir mayúsculas. */
  list(tag?: string): CatalogEntry[] {
    if (tag === undefined) return [...this.#entries];
    const wanted = tag.toLowerCase();
    return this.#entries.filter((entry) => entry.tag.toLowerCase() === wanted);
  }

  /** El JSON de la operación, o undefined si el id no está en el catálogo. */
  async readOperation(operationId: string): Promise<string | undefined> {
    const entry = this.#byId.get(operationId);
    if (entry === undefined) return undefined;
    return readFile(new URL(`${entry.id}.json`, this.#operationsDir), 'utf8');
  }

  /**
   * Hasta 5 ids, sin distinguir mayúsculas: primero los que empiezan con la entrada y luego los que
   * la contienen. Si ninguno coincide (un error de dedo como "createInvoce"), los que comparten con
   * ella el prefijo más largo, de al menos 3 letras.
   */
  suggest(input: string): string[] {
    const needle = input.trim().toLowerCase();
    if (needle === '') return [];
    const ids = this.#entries.map((entry) => entry.id);
    const prefixed = ids.filter((id) => id.toLowerCase().startsWith(needle));
    const containing = ids.filter((id) => !id.toLowerCase().startsWith(needle) && id.toLowerCase().includes(needle));
    const matches = [...prefixed, ...containing];
    if (matches.length > 0) return matches.slice(0, MAX_SUGGESTIONS);
    return closestByCommonPrefix(ids, needle).slice(0, MAX_SUGGESTIONS);
  }
}

const MIN_COMMON_PREFIX = 3;

// Solo los ids con el prefijo común más largo; entre ellos, primero el de longitud más parecida a la entrada.
function closestByCommonPrefix(ids: readonly string[], needle: string): string[] {
  const candidates = ids.map((id) => ({
    id,
    common: commonPrefixLength(id.toLowerCase(), needle),
    lengthGap: Math.abs(id.length - needle.length),
  }));
  const longest = Math.max(0, ...candidates.map((candidate) => candidate.common));
  if (longest < MIN_COMMON_PREFIX) return [];
  return candidates
    .filter((candidate) => candidate.common === longest)
    .sort((a, b) => a.lengthGap - b.lengthGap)
    .map((candidate) => candidate.id);
}

function commonPrefixLength(a: string, b: string): number {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length++;
  return length;
}
