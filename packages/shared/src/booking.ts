import { z } from 'zod';

/**
 * Booking request contract, shared by the form and the handler.
 *
 * PRIVACY: `reason` holds health information under the Privacy Act 1988.
 * It is optional, capped, and must never be logged, echoed in a response, or
 * included in a notification. See docs/specs/002-booking-requests.md.
 */

export const REASON_MAX = 500;
export const RATE_LIMIT = { max: 5, windowMinutes: 10 } as const;
export const RETENTION_DAYS = 90;

export const preferredWindowSchema = z.enum([
  'weekday-morning',
  'weekday-midday',
  'weekday-evening',
  'saturday-morning',
]);
export type PreferredWindow = z.infer<typeof preferredWindowSchema>;

export const PREFERRED_WINDOW_LABELS: Record<PreferredWindow, string> = {
  'weekday-morning': 'Weekday mornings',
  'weekday-midday': 'Weekday middle of the day',
  'weekday-evening': 'Weekday evenings',
  'saturday-morning': 'Saturday mornings',
};

/** Australian mobile or landline, with or without spaces and country code. */
const phoneRegex = /^(\+?61|0)[2-478](?:[ -]?\d){8}$/;

export const bookingRequestSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your name').max(100),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Enter an Australian phone number')
      .optional()
      .or(z.literal('')),
    email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
    serviceSlug: z.string().min(1, 'Choose an appointment type'),
    practitioner: z.string().max(100).optional().or(z.literal('')),
    preferred: z.array(preferredWindowSchema).max(4).default([]),
    /**
     * HEALTH INFORMATION. Optional by design — a person can book without
     * disclosing anything clinical.
     */
    reason: z.string().trim().max(REASON_MAX, `Keep this under ${REASON_MAX} characters`).optional().or(z.literal('')),
    /** APP 3: sensitive information requires consent. Must be true. */
    consent: z.literal(true, {
      errorMap: () => ({ message: 'We need your consent before we can take your request' }),
    }),
    /**
     * Anti-spam honeypot. Visually hidden, so a real person never fills it.
     * Deliberately NOT rejected here: the schema accepts it and the handler
     * discards the submission silently. Returning a validation error would
     * tell the bot exactly which field to leave alone next time.
     */
    company: z.string().max(200).optional().or(z.literal('')),
  })
  .refine((v) => Boolean(v.phone) || Boolean(v.email), {
    message: 'Give us either a phone number or an email address',
    path: ['phone'],
  });

export type BookingRequest = z.infer<typeof bookingRequestSchema>;
/** Pre-parse shape. `.default()` makes some fields optional on input but not
 *  on output, so the form is typed on the input side and the handler on the
 *  output side. */
export type BookingRequestInput = z.input<typeof bookingRequestSchema>;

export const bookingResponseSchema = z.object({
  reference: z.string().regex(/^BR-[A-Z0-9]{6}$/),
  message: z.string(),
});
export type BookingResponse = z.infer<typeof bookingResponseSchema>;

/** Human-quotable reference. Avoids I/O/0/1 so it survives being read aloud. */
export function makeReference(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(random() * alphabet.length)];
  }
  return `BR-${out}`;
}

/**
 * The exact fields allowed to leave the system in a notification.
 * A whitelist, so adding a column can never silently start leaking it.
 */
export const NOTIFIABLE_FIELDS = ['reference', 'fullName', 'serviceSlug', 'createdAt'] as const;

export function notificationPayload(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of NOTIFIABLE_FIELDS) {
    if (key in record) out[key] = record[key];
  }
  return out;
}
