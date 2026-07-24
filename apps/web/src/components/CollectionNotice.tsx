import { clinic } from '@/content/clinic';
import { RETENTION_DAYS } from 'shared';

/**
 * Australian Privacy Principle 5 requires notification at the point of
 * collection — not buried in a linked policy. This sits inside the form.
 */
export function CollectionNotice() {
  return (
    <section
      aria-labelledby="collection-notice"
      className="rounded-card border border-line bg-paper-sunk p-5 text-sm leading-relaxed"
    >
      <h2 id="collection-notice" className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-muted">
        How we handle what you tell us
      </h2>
      <ul className="mt-3 space-y-2 text-ink-muted">
        <li>
          <strong className="font-medium text-ink">Who collects it:</strong> {clinic.name},
          {' '}{clinic.street}, {clinic.suburb} {clinic.state} {clinic.postcode}.
        </li>
        <li>
          <strong className="font-medium text-ink">Why:</strong> to contact you and arrange an
          appointment. Nothing else. We do not send marketing and we do not share your details
          with anyone outside the clinic.
        </li>
        <li>
          <strong className="font-medium text-ink">What is optional:</strong> the reason for your
          visit. You can book without it — reception will ask what they need when they call.
        </li>
        <li>
          <strong className="font-medium text-ink">How long we keep it:</strong> requests we do
          not end up booking are deleted after {RETENTION_DAYS} days. If you become a patient,
          your record moves into our clinical system and is kept as the law requires.
        </li>
        <li>
          <strong className="font-medium text-ink">Access and correction:</strong> email{' '}
          <a className="underline underline-offset-4" href={`mailto:${clinic.email}`}>
            {clinic.email}
          </a>{' '}
          to see what we hold about you, correct it, or ask us to delete it.
        </li>
      </ul>
    </section>
  );
}
