import type { z } from 'zod';
import {
  ERROR_CODES,
  apiError,
  fieldErrors,
  type ApiError,
} from 'shared';

/** The minimal request/response surface we depend on, so handlers stay testable
 *  without importing Vercel's runtime types into unit tests. */
export interface Req {
  method?: string | undefined;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}
export interface Res {
  status(code: number): Res;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

export type Handler = (req: Req, res: Res) => Promise<void> | void;

/** Thrown by handler code to produce a typed error response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly payload: ApiError,
  ) {
    super(payload.error.message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError(400, apiError(ERROR_CODES.VALIDATION_FAILED, message, fields ? { fields } : undefined));
export const unauthenticated = (message = 'Sign in to continue.') =>
  new HttpError(401, apiError(ERROR_CODES.UNAUTHENTICATED, message));
export const forbidden = (message = 'You do not have access to this.') =>
  new HttpError(403, apiError(ERROR_CODES.FORBIDDEN, message));
export const notFound = (message = 'Not found.') =>
  new HttpError(404, apiError(ERROR_CODES.NOT_FOUND, message));
export const conflict = (message: string) =>
  new HttpError(409, apiError(ERROR_CODES.CONFLICT, message));

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/**
 * Wraps a handler so that every route enforces the same order:
 * method check, then the handler's own auth/validation, then a single place
 * where errors become responses. Internal failures never leak their detail to
 * the client; they are logged against a request id the client can quote.
 */
export function route(
  methods: readonly string[],
  handler: Handler,
): Handler {
  return async (req, res) => {
    if (!req.method || !methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      res.status(405).json(
        apiError(ERROR_CODES.METHOD_NOT_ALLOWED, `Use ${methods.join(' or ')}.`),
      );
      return;
    }
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json(err.payload);
        return;
      }
      const id = requestId();
      console.error(JSON.stringify({ level: 'error', requestId: id, err: String(err) }));
      res.status(500).json(
        apiError(ERROR_CODES.INTERNAL, 'Something went wrong on our end.', { requestId: id }),
      );
    }
  };
}

/** Parses input with a Zod schema, converting failure into a 400 with fields. */
export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest('Check the highlighted fields.', fieldErrors(result.error.issues));
  }
  return result.data;
}
