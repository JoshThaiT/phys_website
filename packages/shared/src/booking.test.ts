import { describe, it, expect } from 'vitest';
import {
  REASON_MAX,
  bookingRequestSchema,
  makeReference,
  notificationPayload,
} from './booking.js';

const valid = {
  fullName: 'Jo Nguyen',
  phone: '0412 345 678',
  email: '',
  serviceSlug: 'physiotherapy-initial',
  preferred: [],
  consent: true as const,
};

describe('bookingRequestSchema', () => {
  it('accepts a minimal valid request', () => {
    expect(bookingRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a name', () => {
    expect(bookingRequestSchema.safeParse({ ...valid, fullName: ' ' }).success).toBe(false);
  });

  it('requires at least one contact method', () => {
    const r = bookingRequestSchema.safeParse({ ...valid, phone: '', email: '' });
    expect(r.success).toBe(false);
  });

  it('accepts email alone', () => {
    expect(
      bookingRequestSchema.safeParse({ ...valid, phone: '', email: 'jo@example.com' }).success,
    ).toBe(true);
  });

  it.each(['0412345678', '+61412 345 678', '02 9557 0000'])('accepts %s', (phone) => {
    expect(bookingRequestSchema.safeParse({ ...valid, phone }).success).toBe(true);
  });

  it.each(['12345', 'not a phone', '0912345678'])('rejects %s', (phone) => {
    expect(bookingRequestSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });

  it('rejects a request without consent', () => {
    expect(bookingRequestSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });

  it('treats the reason as optional', () => {
    expect(bookingRequestSchema.safeParse({ ...valid, reason: '' }).success).toBe(true);
  });

  it(`accepts a reason of exactly ${REASON_MAX} characters`, () => {
    const r = bookingRequestSchema.safeParse({ ...valid, reason: 'a'.repeat(REASON_MAX) });
    expect(r.success).toBe(true);
  });

  it(`rejects a reason of ${REASON_MAX + 1} characters`, () => {
    const r = bookingRequestSchema.safeParse({ ...valid, reason: 'a'.repeat(REASON_MAX + 1) });
    expect(r.success).toBe(false);
  });

  it('accepts a filled honeypot at the schema level, so the server can discard it silently', () => {
    // A validation error here would tell a bot which field to stop filling.
    expect(bookingRequestSchema.safeParse({ ...valid, company: 'Acme' }).success).toBe(true);
  });
});

describe('makeReference', () => {
  it('matches the published format', () => {
    expect(makeReference()).toMatch(/^BR-[A-Z0-9]{6}$/);
  });

  it('omits characters that are ambiguous when read aloud', () => {
    const many = Array.from({ length: 200 }, () => makeReference()).join('');
    expect(many).not.toMatch(/[IO01]/);
  });
});

describe('notificationPayload', () => {
  it('never includes health information', () => {
    const payload = notificationPayload({
      reference: 'BR-ABC234',
      fullName: 'Jo Nguyen',
      serviceSlug: 'physiotherapy-initial',
      createdAt: '2026-07-21',
      reason: 'lower back pain since surgery',
      phone: '0412 345 678',
    });
    expect(payload).not.toHaveProperty('reason');
    expect(JSON.stringify(payload)).not.toContain('surgery');
  });

  it('does not leak a newly added column', () => {
    const payload = notificationPayload({ reference: 'BR-ABC234', diagnosisCode: 'M54.5' });
    expect(payload).not.toHaveProperty('diagnosisCode');
  });
});
