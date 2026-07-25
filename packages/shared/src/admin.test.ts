import { describe, it, expect } from 'vitest';
import {
  NOTE_MAX,
  adminRequestDetailSchema,
  adminRequestListItemSchema,
  adminRevealResponseSchema,
  adminStatusUpdateSchema,
} from './admin.js';

describe('adminRequestListItemSchema', () => {
  it('has no reason field in its shape', () => {
    expect(Object.keys(adminRequestListItemSchema.shape)).not.toContain('reason');
  });
});

describe('adminRequestDetailSchema', () => {
  it('has no reason field in its shape', () => {
    expect(Object.keys(adminRequestDetailSchema.shape)).not.toContain('reason');
  });

  it('strips an extraneous reason key rather than passing it through', () => {
    const base = {
      id: '11111111-1111-1111-1111-111111111111',
      reference: 'BR-ABC234',
      status: 'pending',
      serviceSlug: 'physiotherapy-initial',
      fullName: 'Jo Nguyen',
      phone: null,
      email: null,
      createdAt: new Date().toISOString(),
      statusUpdatedAt: null,
      lastActionedBy: null,
      practitioner: null,
      preferred: [],
      internalNote: null,
      contactedAt: null,
      version: 0,
      history: [],
      reason: 'lower back pain since my spinal surgery in March',
    };
    const parsed = adminRequestDetailSchema.parse(base);
    expect(parsed).not.toHaveProperty('reason');
    expect(JSON.stringify(parsed)).not.toContain('surgery');
  });
});

describe('adminRevealResponseSchema', () => {
  it('accepts a reason string', () => {
    expect(adminRevealResponseSchema.parse({ reason: 'wants a review' })).toEqual({
      reason: 'wants a review',
    });
  });

  it('accepts a null reason for the edge case where none was given', () => {
    expect(adminRevealResponseSchema.parse({ reason: null })).toEqual({ reason: null });
  });
});

describe('adminStatusUpdateSchema', () => {
  it('caps the internal note length', () => {
    const tooLong = 'a'.repeat(NOTE_MAX + 1);
    const result = adminStatusUpdateSchema.safeParse({ note: tooLong, expectedVersion: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts a note exactly at the cap', () => {
    const atCap = 'a'.repeat(NOTE_MAX);
    const result = adminStatusUpdateSchema.safeParse({ note: atCap, expectedVersion: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects a body with neither status nor note', () => {
    const result = adminStatusUpdateSchema.safeParse({ expectedVersion: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts a status-only update', () => {
    const result = adminStatusUpdateSchema.safeParse({ status: 'contacted', expectedVersion: 3 });
    expect(result.success).toBe(true);
  });

  it('rejects setting status back to pending', () => {
    const result = adminStatusUpdateSchema.safeParse({ status: 'pending', expectedVersion: 0 });
    expect(result.success).toBe(false);
  });
});
