import { setTimeout as delay } from 'node:timers/promises';

import { errorMessage, ScriptError } from './script-runner.ts';

export const RETRY_POLICY = {
  maxAttempts: 6,
  initialBackoffMs: 500,
  maxBackoffMs: 30_000,
  requestTimeoutMs: 60_000,
} as const;

const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

export class HttpError extends ScriptError {}

type Attempt = { readonly kind: 'response'; readonly response: Response } | { readonly kind: 'networkError'; readonly error: unknown };

export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  for (let attemptNumber = 1; ; attemptNumber++) {
    signal?.throwIfAborted();
    const attempt = await request(url, signal);
    if (attempt.kind === 'response' && attempt.response.status === 200) return attempt.response.text();
    if (attempt.kind === 'response') await attempt.response.body?.cancel();
    if (!isRetryable(attempt) || attemptNumber === RETRY_POLICY.maxAttempts) throw failure(url, attempt);
    await delay(backoffMs(attempt, attemptNumber), undefined, { signal });
  }
}

async function request(url: string, signal: AbortSignal | undefined): Promise<Attempt> {
  const timeout = AbortSignal.timeout(RETRY_POLICY.requestTimeoutMs);
  try {
    const response = await fetch(url, { signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]) });
    return { kind: 'response', response };
  } catch (error) {
    signal?.throwIfAborted();
    return { kind: 'networkError', error };
  }
}

function isRetryable(attempt: Attempt): boolean {
  return attempt.kind === 'networkError' || RETRYABLE_STATUSES.has(attempt.response.status);
}

function failure(url: string, attempt: Attempt): HttpError {
  if (attempt.kind === 'networkError') return new HttpError(`cannot download ${url}: ${errorMessage(attempt.error)}`);
  return new HttpError(`${url} responded HTTP ${attempt.response.status}; expected 200.`);
}

function backoffMs(attempt: Attempt, attemptNumber: number): number {
  const exponentialMs = RETRY_POLICY.initialBackoffMs * 2 ** (attemptNumber - 1) * (1 + Math.random());
  const requestedMs = attempt.kind === 'response' ? retryAfterMs(attempt.response) : undefined;
  return Math.min(requestedMs ?? exponentialMs, RETRY_POLICY.maxBackoffMs);
}

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('retry-after');
  if (header === null) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
