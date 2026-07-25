/**
 * Provider-agnostic mail seam for the admin sign-in link.
 *
 * See docs/specs/003-admin-booking-list.md, "Prerequisite — email delivery
 * does not yet exist in this repo": no concrete provider is wired here.
 * `createFetchTransport` calls whatever HTTP API `MAIL_API_URL` points at,
 * so the provider (Resend, Postmark, SES, ...) is chosen by environment
 * configuration, not by adding an SDK dependency. Selecting and configuring
 * a real provider is an ops prerequisite tracked in the spec, not something
 * this file resolves.
 *
 * The magic-link email carries only the sign-in token and no request data of
 * any kind — the 002 rule that health information never enters an email
 * applies here too.
 */

export interface MailTransport {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
}

export interface Mailer {
  sendMagicLink(to: string, link: string): Promise<void>;
}

/** Minimal fetch signature, so tests can inject a fake without touching the
 *  network and without adding a provider SDK dependency. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>;

/**
 * Calls a single generic HTTP endpoint configured entirely by environment
 * variables. Swapping providers is a configuration change, not a code
 * change.
 */
export function createFetchTransport(fetchImpl: FetchLike = fetch): MailTransport {
  return {
    async send({ to, subject, text }) {
      const endpoint = process.env['MAIL_API_URL'];
      const apiKey = process.env['MAIL_API_KEY'];
      const from = process.env['MAIL_FROM'];
      if (!endpoint || !apiKey || !from) {
        throw new Error(
          'Mail transport is not configured. Set MAIL_API_URL, MAIL_API_KEY and MAIL_FROM.',
        );
      }
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to, subject, text }),
      });
      if (!res.ok) {
        throw new Error(`Mail transport responded with status ${res.status}`);
      }
    },
  };
}

export function createMailer(transport: MailTransport): Mailer {
  return {
    async sendMagicLink(to, link) {
      await transport.send({
        to,
        subject: 'Your reception sign-in link',
        text:
          `Use this link to sign in to the booking request list: ${link}\n\n` +
          'This link can be used once and expires shortly. If you did not request it, ignore this email.',
      });
    },
  };
}
