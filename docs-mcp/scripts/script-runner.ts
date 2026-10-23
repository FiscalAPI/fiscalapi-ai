import { parseArgs } from 'node:util';
import type { ParseArgsConfig } from 'node:util';

export class ScriptError extends Error {}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createLogger(scriptName: string): (message: string) => void {
  return (message) => console.error(`${scriptName}: ${message}`);
}

export function parseScriptArgs<T extends ParseArgsConfig>(usage: string, config: T): ReturnType<typeof parseArgs<T>> {
  try {
    return parseArgs(config);
  } catch (error) {
    throw new ScriptError(`${errorMessage(error)}\nusage: ${usage}`);
  }
}

export async function runScript(scriptName: string, main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    createLogger(scriptName)(failureMessage(error));
    process.exitCode = 1;
  }
}

function failureMessage(error: unknown): string {
  if (error instanceof ScriptError) return error.message;
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
