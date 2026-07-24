import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { apiError, apiErrorSchema, ERROR_CODES, fieldErrors } from './errors.js';

describe('apiError', () => {
  it('produces a payload matching the published error schema', () => {
    const result = apiError(ERROR_CODES.NOT_FOUND, 'Booking not found');
    expect(apiErrorSchema.safeParse(result).success).toBe(true);
  });

  it('carries field errors when validation failed', () => {
    const result = apiError(ERROR_CODES.VALIDATION_FAILED, 'Check the form', {
      fields: { email: 'Enter a valid email address' },
    });
    expect(result.error.fields).toEqual({ email: 'Enter a valid email address' });
  });
});

describe('fieldErrors', () => {
  const schema = z.object({
    email: z.string().email('Enter a valid email address'),
    age: z.number().min(18, 'Must be 18 or older'),
  });

  it('maps each failing path to its message', () => {
    const parsed = schema.safeParse({ email: 'nope', age: 12 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(fieldErrors(parsed.error.issues)).toEqual({
      email: 'Enter a valid email address',
      age: 'Must be 18 or older',
    });
  });

  it('keeps the first message when one field fails twice', () => {
    const issues: z.ZodIssue[] = [
      { code: 'custom', path: ['email'], message: 'first' },
      { code: 'custom', path: ['email'], message: 'second' },
    ];
    expect(fieldErrors(issues)).toEqual({ email: 'first' });
  });

  it('uses _ for a root-level issue with no path', () => {
    const issues: z.ZodIssue[] = [{ code: 'custom', path: [], message: 'bad' }];
    expect(fieldErrors(issues)).toEqual({ _: 'bad' });
  });
});
