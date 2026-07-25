import { z } from 'zod';
import { pageQuerySchema, pageResponseSchema } from './pagination.js';

/**
 * Admin (reception) booking-request view — contract shared by
 * `apps/api/routes/admin-auth.ts`, `apps/api/routes/admin-requests.ts` and
 * the `apps/web/src/routes/Admin*` pages.
 *
 * PRIVACY — read before adding a field.
 *
 * `reason` is health information (see packages/shared/src/booking.ts). It has
 * exactly one exit: `adminRevealResponseSchema`, returned only by the
 * dedicated reveal action. No other schema in this file may name it — that
 * omission, not review discipline, is what stops a list or detail response
 * from ever carrying it.
 */

export const MAGIC_LINK_TTL_MINUTES = 15;
export const SESSION_IDLE_MINUTES = 30;
export const SESSION_ABSOLUTE_HOURS = 12;
export const NOTE_MAX = 500;

export const adminBookingStatusSchema = z.enum(['pending', 'contacted', 'scheduled', 'declined']);
export type AdminBookingStatus = z.infer<typeof adminBookingStatusSchema>;

/** Statuses reception can move a request to. `pending` is the initial state
 *  only — it is never set from this view. */
export const adminSettableStatusSchema = z.enum(['contacted', 'scheduled', 'declined']);
export type AdminSettableStatus = z.infer<typeof adminSettableStatusSchema>;

/** The acting reception user. Enough to attribute a change to a named
 *  person; no password, no role. */
export const adminActorSchema = z.object({
  email: z.string().email(),
  name: z.string().nullable(),
});
export type AdminActor = z.infer<typeof adminActorSchema>;

/** One row of the queue. Deliberately has no `reason` field. */
export const adminRequestListItemSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  status: adminBookingStatusSchema,
  serviceSlug: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.string(),
  statusUpdatedAt: z.string().nullable(),
  lastActionedBy: adminActorSchema.nullable(),
});
export type AdminRequestListItem = z.infer<typeof adminRequestListItemSchema>;

export const adminAuditEntrySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['status_change', 'delete']),
  fromStatus: adminBookingStatusSchema.nullable(),
  toStatus: adminBookingStatusSchema.nullable(),
  actor: adminActorSchema,
  at: z.string(),
});
export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;

/** Full detail. Still no `reason` — see `adminRevealResponseSchema`. */
export const adminRequestDetailSchema = adminRequestListItemSchema.extend({
  practitioner: z.string().nullable(),
  preferred: z.array(z.string()),
  internalNote: z.string().nullable(),
  contactedAt: z.string().nullable(),
  version: z.number().int(),
  history: z.array(adminAuditEntrySchema),
});
export type AdminRequestDetail = z.infer<typeof adminRequestDetailSchema>;

/** List query/response reuse the repo's keyset-pagination convention
 *  unchanged: cursor optional, limit defaults to 20 with a ceiling of 100. */
export const adminRequestListQuerySchema = pageQuerySchema;
export const adminRequestListResponseSchema = pageResponseSchema(adminRequestListItemSchema);
export type AdminRequestListResponse = z.infer<typeof adminRequestListResponseSchema>;

export const adminRevealRequestSchema = z.object({
  action: z.literal('reveal'),
  id: z.string().uuid(),
});
export type AdminRevealRequest = z.infer<typeof adminRevealRequestSchema>;

/** The single exit for health information in this view. */
export const adminRevealResponseSchema = z.object({
  reason: z.string().nullable(),
});
export type AdminRevealResponse = z.infer<typeof adminRevealResponseSchema>;

export const adminStatusUpdateSchema = z
  .object({
    status: adminSettableStatusSchema.optional(),
    note: z.string().trim().max(NOTE_MAX, `Keep the note under ${NOTE_MAX} characters`).optional(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, {
    message: 'Provide a status or a note to update.',
    path: ['status'],
  });
export type AdminStatusUpdate = z.infer<typeof adminStatusUpdateSchema>;

/** Body of the 409 response to a stale `expectedVersion`. The client's
 *  generic `apiFetch` helper only surfaces the `error` half of this; the
 *  admin API client re-fetches the record to obtain `current` (see
 *  apps/web/src/lib/adminApi.ts). */
export const adminConflictBodySchema = z.object({
  error: z.object({ code: z.literal('CONFLICT'), message: z.string() }),
  current: adminRequestDetailSchema,
});
export type AdminConflictBody = z.infer<typeof adminConflictBodySchema>;

export const adminSignInRequestSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});
export type AdminSignInRequest = z.infer<typeof adminSignInRequestSchema>;

/** Always `{ ok: true }`, whether or not the address is allowlisted — the
 *  response must not be a signal an attacker can use to enumerate reception
 *  staff (AC2). */
export const adminSignInResponseSchema = z.object({ ok: z.literal(true) });
export type AdminSignInResponse = z.infer<typeof adminSignInResponseSchema>;

export const adminVerifyRequestSchema = z.object({
  token: z.string().min(1, 'A sign-in token is required'),
});
export type AdminVerifyRequest = z.infer<typeof adminVerifyRequestSchema>;

export const adminSessionSchema = adminActorSchema;
export type AdminSession = z.infer<typeof adminSessionSchema>;
