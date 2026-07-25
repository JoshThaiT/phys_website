import type { MailTransport } from './mailer.js';

/**
 * Reception notification for a new booking request. The file plan 002
 * intended but never created (spec 006).
 *
 * PRIVACY: reads ONLY `reference`, `fullName`, `serviceSlug`, `createdAt`
 * from the payload — the same `NOTIFIABLE_FIELDS` whitelist that
 * `shared`'s `notificationPayload(...)` produces. The handler only ever
 * calls this with that whitelisted output, so `reason`, patient phone and
 * patient email are structurally incapable of appearing here: this
 * function does not even know their key names.
 *
 * Awaits `transport.send` and propagates its rejection — a failed send is
 * NOT swallowed here. Deciding whether a notify failure should still be a
 * successful booking response is a handler-level concern (spec 005); this
 * seam stays a faithful "send or throw" primitive so that decision remains
 * testable at the handler.
 */
export function createBookingNotifier(transport: MailTransport, { to }: { to: string }) {
  return async (payload: Record<string, unknown>): Promise<void> => {
    const reference = String(payload['reference'] ?? '');
    const fullName = String(payload['fullName'] ?? '');
    const serviceSlug = String(payload['serviceSlug'] ?? '');
    const createdAt = String(payload['createdAt'] ?? '');

    await transport.send({
      to,
      subject: `New booking request ${reference}`,
      text:
        `A new booking request has come in.\n\n` +
        `Reference: ${reference}\n` +
        `Name: ${fullName}\n` +
        `Service: ${serviceSlug}\n` +
        `Submitted: ${createdAt}\n\n` +
        'Sign in to the booking request list to see and action this request.',
    });
  };
}
