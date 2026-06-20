import { useAuthStore } from '@/lib/auth-store';
import type { ApiErrorResponse } from '@/types/api';

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
  }
}

export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('네트워크 연결 오류');
    this.name = 'NetworkError';
    if (cause) this.cause = cause;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(code = 'unauthorized') {
    super(code);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(code = 'access_denied') {
    super(code);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(code = 'not_found') {
    super(code);
    this.name = 'NotFoundError';
  }
}

export class ServerError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`서버 오류: ${status}`);
    this.name = 'ServerError';
    this.status = status;
  }
}

export class ClientError extends ApiError {
  constructor(code = 'unknown_error') {
    super(code);
    this.name = 'ClientError';
  }
}

async function readErrorCode(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({ error: fallback })) as ApiErrorResponse;
  return body.error ?? fallback;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers = new Headers();
  if (init.body !== undefined && init.body !== null) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.headers) {
    new Headers(init.headers as HeadersInit).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch (err) {
    throw new NetworkError(err);
  }

  if (res.status === 401) {
    useAuthStore.getState().clearAuth();
    const code = await readErrorCode(res, 'unauthorized');
    throw new UnauthorizedError(code);
  }

  if (res.status === 403) {
    const code = await readErrorCode(res, 'access_denied');
    throw new ForbiddenError(code);
  }

  if (res.status === 404) {
    const code = await readErrorCode(res, 'not_found');
    throw new NotFoundError(code);
  }

  if (res.status >= 500) {
    throw new ServerError(res.status);
  }

  if (!res.ok) {
    const code = await readErrorCode(res, 'unknown_error');
    throw new ClientError(code);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return undefined as T;
  return res.json() as Promise<T>;
}
