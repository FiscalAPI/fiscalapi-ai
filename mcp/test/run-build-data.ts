import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('../', import.meta.url));

/**
 * Corre scripts/build-data.mjs en otro proceso. Es asíncrono a propósito: el servidor de la
 * documentación de prueba vive en este proceso y con spawnSync no podría responder.
 */
export function runBuildData(args: readonly string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/build-data.mjs', ...args], { cwd: packageDir });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr }));
  });
}
