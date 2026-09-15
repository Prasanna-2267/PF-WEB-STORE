import type { ApiErrorBody, AuthResult } from './contracts';
import {
  clearSessionCredentials,
  getSessionCredentials,
  setSessionCredentials,
} from './credentials';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const DEFAULT_TIMEOUT_MS = 30_000;

export const buildApiUrl = (path: string): string => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = 'REQUEST_FAILED',
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  academyId?: string | null;
  idempotencyKey?: string;
  timeoutMs?: number;
  retryAfterRefresh?: boolean;
}

let refreshPromise: Promise<AuthResult> | null = null;
let terminalAuthFailureHandler: (() => void) | null = null;

export function setTerminalAuthFailureHandler(handler: (() => void) | null): void {
  terminalAuthFailureHandler = handler;
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `pf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let payload: T | ApiErrorBody | undefined;
  try {
    payload = text ? JSON.parse(text) as T | ApiErrorBody : undefined;
  } catch {
    payload = undefined;
  }
  if (response.ok) return payload as T;

  const body = payload as ApiErrorBody | undefined;
  throw new ApiError(
    body?.error?.message || `Request failed with status ${response.status}.`,
    response.status,
    body?.error?.code,
    body?.error?.fieldErrors,
    body?.error?.requestId || response.headers.get('x-request-id') || undefined,
  );
}

async function rawRefresh(): Promise<AuthResult> {
  const current = getSessionCredentials();
  if (!current?.refreshToken) throw new ApiError('Your session has expired.', 401, 'SESSION_EXPIRED');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': requestId() },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
      signal: controller.signal,
    });
    const result = await parseResponse<AuthResult>(response);
    setSessionCredentials({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: Date.now() + result.expiresIn * 1000,
    });
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function refreshSession(): Promise<AuthResult> {
  refreshPromise ??= rawRefresh().finally(() => { refreshPromise = null; });
  try {
    return await refreshPromise;
  } catch (error) {
    clearSessionCredentials();
    terminalAuthFailureHandler?.();
    throw error;
  }
}

function combineSignals(signal: AbortSignal | null | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    },
  };
}

function terminateInvalidSession(): void {
  clearSessionCredentials();
  terminalAuthFailureHandler?.();
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    auth = true,
    academyId,
    idempotencyKey,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryAfterRefresh = true,
    headers: suppliedHeaders,
    body,
    signal: suppliedSignal,
    ...init
  } = options;

  // Do not send a token which is already known to be expired. Refreshing before
  // the mutation also prevents a protected action from failing merely because
  // its access token expired while the administrator had the page open.
  const credentials = auth ? getSessionCredentials() : null;
  if (
    auth &&
    retryAfterRefresh &&
    credentials?.refreshToken &&
    credentials.expiresAt <= Date.now()
  ) {
    await refreshSession();
    return apiRequest<T>(path, { ...options, retryAfterRefresh: false });
  }

  const headers = new Headers(suppliedHeaders);
  headers.set('accept', 'application/json');
  headers.set('x-request-id', requestId());
  if (body !== undefined && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (auth) {
    const token = getSessionCredentials()?.accessToken;
    if (token) headers.set('authorization', `Bearer ${token}`);
  }
  if (academyId) headers.set('x-academy-id', academyId);
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);

  const combined = combineSignals(suppliedSignal, timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: combined.signal,
      body: body === undefined || body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body) ? (body as BodyInit) : JSON.stringify(body),
    });
    if (response.status === 401 && auth) {
      if (retryAfterRefresh && getSessionCredentials()?.refreshToken) {
        await refreshSession();
        return apiRequest<T>(path, { ...options, retryAfterRefresh: false });
      }

      // A protected request was rejected after refresh (or no refresh session
      // exists). Keeping authenticated screens mounted here exposes stale data
      // and makes subsequent mutations fail with unexplained 401 responses.
      terminateInvalidSession();
    }
    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (combined.signal.aborted) throw new ApiError('The request timed out or was cancelled.', 0, 'REQUEST_ABORTED');
    throw new ApiError(error instanceof Error ? error.message : 'Network request failed.', 0, 'NETWORK_ERROR');
  } finally {
    combined.cleanup();
  }
}

export async function uploadToSignedUrl(url: string, file: Blob, headers?: HeadersInit, signal?: AbortSignal): Promise<void> {
  const response = await fetch(url, { method: 'PUT', body: file, headers, signal });
  if (!response.ok) throw new ApiError('Upload failed.', response.status, 'UPLOAD_FAILED');
}
