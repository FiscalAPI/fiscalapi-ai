import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchText, HttpError, RETRY_POLICY } from '../scripts/http.ts';

const requestedDelays = vi.hoisted((): number[] => []);

vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn(async (milliseconds: number) => {
    requestedDelays.push(milliseconds);
  }),
}));

const URL_UNDER_TEST = 'https://docs.example.test/page.md';

function respondWith(...responses: ReadonlyArray<Response | Error>) {
  const fetchMock = vi.fn(async () => {
    const next = responses[Math.min(fetchMock.mock.calls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  requestedDelays.length = 0;
});

describe('fetchText', () => {
  it('returns the body of a 200 response', async () => {
    respondWith(new Response('ok'));

    await expect(fetchText(URL_UNDER_TEST)).resolves.toBe('ok');
    expect(requestedDelays).toEqual([]);
  });

  it('retries rate limiting and network errors with exponential backoff', async () => {
    const fetchMock = respondWith(new Response(null, { status: 429 }), new TypeError('fetch failed'), new Response('ok'));

    await expect(fetchText(URL_UNDER_TEST)).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestedDelays).toEqual([RETRY_POLICY.initialBackoffMs, RETRY_POLICY.initialBackoffMs * 2]);
  });

  it('honors Retry-After up to the maximum backoff', async () => {
    respondWith(
      new Response(null, { status: 503, headers: { 'retry-after': '2' } }),
      new Response(null, { status: 503, headers: { 'retry-after': '3600' } }),
      new Response('ok'),
    );

    await expect(fetchText(URL_UNDER_TEST)).resolves.toBe('ok');
    expect(requestedDelays).toEqual([2_000, RETRY_POLICY.maxBackoffMs]);
  });

  it('does not retry a client error', async () => {
    const fetchMock = respondWith(new Response(null, { status: 404 }));

    await expect(fetchText(URL_UNDER_TEST)).rejects.toThrow(`${URL_UNDER_TEST} responded HTTP 404; expected 200.`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the maximum number of attempts', async () => {
    const fetchMock = respondWith(new Response(null, { status: 503 }));

    await expect(fetchText(URL_UNDER_TEST)).rejects.toThrow(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(RETRY_POLICY.maxAttempts);
    expect(requestedDelays).toHaveLength(RETRY_POLICY.maxAttempts - 1);
  });

  it('stops when its signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    const fetchMock = respondWith(new Response('ok'));

    await expect(fetchText(URL_UNDER_TEST, controller.signal)).rejects.toThrow('cancelled');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
