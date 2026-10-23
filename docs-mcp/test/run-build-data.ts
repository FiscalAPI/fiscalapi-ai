import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export interface ScriptResult {
  readonly code: number | null;
  readonly stderr: string;
}

const packageDir = fileURLToPath(new URL('../', import.meta.url));

export function runBuildData(args: readonly string[]): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/build-data.ts', ...args], { cwd: packageDir });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr }));
  });
}
