import { z } from 'zod';

/**
 * The single error shape every endpoint returns. `code` is stable and
 * machine-readable so the frontend can branch on it; `message` is safe to show
 * a user. Nothing internal ever crosses this boundary.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string()).optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const ERROR_CODES = {
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function apiError(
  code: ErrorCode,
  message: string,
  extra?: { fields?: Record<string, string>; requestId?: string },
): ApiError {
  return { error: { code, message, ...extra } };
}

/** Flattens a ZodError into the `fields` map the error shape expects. */
export function fieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
