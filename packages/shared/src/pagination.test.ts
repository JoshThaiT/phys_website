import { describe, it, expect } from 'vitest';
import { pageQuerySchema } from './pagination.js';

describe('pageQuerySchema', () => {
  it('defaults limit to 20 when absent', () => {
    expect(pageQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it('coerces a string limit from the query string', () => {
    expect(pageQuerySchema.parse({ limit: '50' }).limit).toBe(50);
  });

  it('rejects a limit above the maximum', () => {
    expect(pageQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('rejects a limit below one', () => {
    expect(pageQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });
});
