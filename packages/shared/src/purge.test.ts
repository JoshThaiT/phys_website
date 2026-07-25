import { describe, it, expect } from 'vitest';
import { ACTIONED_RETENTION_DAYS, purgeDecision, purgeRunResultSchema } from './purge.js';

const NOW = new Date('2026-07-25T02:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

describe('purgeDecision', () => {
  it('deletes a pending request past its purgeAfter', () => {
    const row = { status: 'pending', purgeAfter: daysAgo(1), statusUpdatedAt: null, contactedAt: null };
    expect(purgeDecision(row, NOW)).toBe('unactioned');
  });

  it('treats purgeAfter exactly at now as eligible', () => {
    const row = { status: 'pending', purgeAfter: NOW, statusUpdatedAt: null, contactedAt: null };
    expect(purgeDecision(row, NOW)).toBe('unactioned');
  });

  it('keeps a pending request whose purgeAfter is in the future', () => {
    const row = { status: 'pending', purgeAfter: daysFromNow(1), statusUpdatedAt: null, contactedAt: null };
    expect(purgeDecision(row, NOW)).toBe('keep');
  });

  it('deletes an actioned request more than 30 days after action even if purgeAfter is future', () => {
    const row = {
      status: 'contacted',
      purgeAfter: daysFromNow(60),
      statusUpdatedAt: daysAgo(ACTIONED_RETENTION_DAYS + 1),
      contactedAt: daysAgo(ACTIONED_RETENTION_DAYS + 1),
    };
    expect(purgeDecision(row, NOW)).toBe('actioned');
  });

  it('treats exactly 30 days since action as eligible', () => {
    const row = {
      status: 'declined',
      purgeAfter: daysFromNow(60),
      statusUpdatedAt: daysAgo(ACTIONED_RETENTION_DAYS),
      contactedAt: null,
    };
    expect(purgeDecision(row, NOW)).toBe('actioned');
  });

  it('keeps an actioned request actioned fewer than 30 days ago even if purgeAfter has passed', () => {
    const row = {
      status: 'scheduled',
      purgeAfter: daysAgo(1),
      statusUpdatedAt: daysAgo(ACTIONED_RETENTION_DAYS - 1),
      contactedAt: null,
    };
    expect(purgeDecision(row, NOW)).toBe('keep');
  });

  it('treats a non-pending row with a null action timestamp as keep', () => {
    const row = { status: 'declined', purgeAfter: daysAgo(30), statusUpdatedAt: null, contactedAt: null };
    expect(purgeDecision(row, NOW)).toBe('keep');
  });

  it('prefers statusUpdatedAt over contactedAt as the anchor when both are set', () => {
    const row = {
      status: 'scheduled',
      purgeAfter: daysFromNow(60),
      statusUpdatedAt: daysAgo(ACTIONED_RETENTION_DAYS + 1), // eligible
      contactedAt: daysAgo(1), // would not be eligible alone
    };
    expect(purgeDecision(row, NOW)).toBe('actioned');
  });

  it('falls back to contactedAt when a request is actioned but statusUpdatedAt is null', () => {
    // Edge case from the spec: "or a contact timestamp is recorded" — status
    // may still read pending if only contactedAt was ever stamped.
    const row = {
      status: 'pending',
      purgeAfter: daysFromNow(60),
      statusUpdatedAt: null,
      contactedAt: daysAgo(ACTIONED_RETENTION_DAYS + 1),
    };
    expect(purgeDecision(row, NOW)).toBe('actioned');
  });
});

describe('purgeRunResultSchema', () => {
  it('accepts a zero-count completed run', () => {
    const result = purgeRunResultSchema.parse({ deletedUnactioned: 0, deletedActioned: 0, completed: true });
    expect(result).toEqual({ deletedUnactioned: 0, deletedActioned: 0, completed: true });
  });

  it('rejects a negative count', () => {
    const result = purgeRunResultSchema.safeParse({ deletedUnactioned: -1, deletedActioned: 0, completed: true });
    expect(result.success).toBe(false);
  });
});
