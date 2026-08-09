import { err, ok, Result } from './result';

const TIMEOUT_MS = 10_000;

// Nominatim's usage policy rejects requests without a descriptive User-Agent.
const USER_AGENT = 'FloraAI/1.0 (university project; plant identifier)';

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return { 'User-Agent': USER_AGENT, Accept: 'application/json', ...extra };
}

async function run<T>(url: string, init: RequestInit): Promise<Result<T>> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (!response.ok) {
      return err(`HTTP_${response.status}`, `Request failed with status ${response.status}.`);
    }

    return ok((await response.json()) as T);
  } catch (cause) {
    const isTimeout = cause instanceof Error && cause.name === 'TimeoutError';
    return isTimeout
      ? err('TIMEOUT', 'The request took too long.')
      : err('NETWORK', 'Could not reach the service.');
  }
}

export function getJson<T>(
  url: string,
  opts?: { headers?: Record<string, string> },
): Promise<Result<T>> {
  return run<T>(url, { method: 'GET', headers: baseHeaders(opts?.headers) });
}

export function postForm<T>(url: string, body: Record<string, string>): Promise<Result<T>> {
  return run<T>(url, {
    method: 'POST',
    headers: baseHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: new URLSearchParams(body).toString(),
  });
}
