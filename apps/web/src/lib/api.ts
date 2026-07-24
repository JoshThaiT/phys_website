import { apiErrorSchema, type ApiError } from 'shared';
import type { z } from 'zod';

/** Thrown for any non-2xx response, carrying the server's typed error shape. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly payload: ApiError,
  ) {
    super(payload.error.message);
    this.name = 'ApiRequestError';
  }
  get code(): string {
    return this.payload.error.code;
  }
  get fields(): Record<string, string> | undefined {
    return this.payload.error.fields;
  }
}

const BASE = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

/**
 * Every response is parsed with the same Zod schema the server validates
 * against, so a contract drift fails a test rather than a user.
 */
export async function apiFetch<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      res.status,
      parsed.success
        ? parsed.data
        : { error: { code: 'INTERNAL', message: 'Something went wrong.' } },
    );
  }

  return schema.parse(body);
}
