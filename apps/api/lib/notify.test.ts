import { describe, it, expect, vi } from 'vitest';
import { notificationPayload } from 'shared';
import { createBookingNotifier } from './notify.js';
import type { MailTransport } from './mailer.js';

function makeTransport(send = vi.fn<MailTransport['send']>(async () => {})) {
  const transport: MailTransport = { send };
  return { transport, send };
}

describe('createBookingNotifier', () => {
  it('sends over the injected transport using only whitelisted fields', async () => {
    const { transport, send } = makeTransport();
    const notify = createBookingNotifier(transport, { to: 'reception@example.com' });

    await notify(
      notificationPayload({
        reference: 'BR-ABC234',
        fullName: 'Jo Nguyen',
        serviceSlug: 'physiotherapy-initial',
        createdAt: '2026-07-21T00:00:00.000Z',
      }),
    );

    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0]?.[0];
    expect(call?.to).toBe('reception@example.com');
    expect(call?.subject).toContain('BR-ABC234');
    expect(call?.text).toContain('Jo Nguyen');
    expect(call?.text).toContain('physiotherapy-initial');
  });

  it('never includes the reason, even if it were present on the payload', async () => {
    const { transport, send } = makeTransport();
    const notify = createBookingNotifier(transport, { to: 'reception@example.com' });

    // Simulates a caller mistake: notify is only ever handed
    // notificationPayload(...) output in production, but the notifier's own
    // safety must not depend on the caller doing that correctly.
    await notify({
      reference: 'BR-ABC234',
      fullName: 'Jo Nguyen',
      serviceSlug: 'physiotherapy-initial',
      createdAt: '2026-07-21T00:00:00.000Z',
      reason: 'lower back pain since my spinal surgery in March',
    });

    const call = send.mock.calls[0]?.[0];
    expect(call?.subject).not.toContain('surgery');
    expect(call?.text).not.toContain('surgery');
    expect(call?.text).not.toContain('spinal');
  });

  it('rejects when the transport rejects', async () => {
    const { transport } = makeTransport(vi.fn(async () => { throw new Error('mail down'); }));
    const notify = createBookingNotifier(transport, { to: 'reception@example.com' });

    await expect(
      notify(
        notificationPayload({
          reference: 'BR-ABC234',
          fullName: 'Jo Nguyen',
          serviceSlug: 'physiotherapy-initial',
          createdAt: '2026-07-21T00:00:00.000Z',
        }),
      ),
    ).rejects.toThrow('mail down');
  });
});
