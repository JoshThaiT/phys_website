import { clinic } from '@/content/clinic';

export function Footer() {
  return (
    <footer id="visit" className="mt-section border-t border-line bg-paper-sunk">
      <div className="mx-auto grid max-w-shell gap-10 px-gutter py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-muted">Clinic</h2>
          <address className="mt-3 not-italic leading-relaxed">
            {clinic.name}
            <br />
            {clinic.street}
            <br />
            {clinic.suburb} {clinic.state} {clinic.postcode}
          </address>
        </div>

        <div>
          <h2 className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-muted">Contact</h2>
          <ul className="mt-3 space-y-1">
            <li>
              <a className="underline decoration-line-strong underline-offset-4 hover:decoration-clinic"
                 href={`tel:${clinic.phone.replace(/\s|\(|\)/g, '')}`}>
                {clinic.phone}
              </a>
            </li>
            <li>
              <a className="break-words underline decoration-line-strong underline-offset-4 hover:decoration-clinic"
                 href={`mailto:${clinic.email}`}>
                {clinic.email}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-muted">Hours</h2>
          <dl className="mt-3 space-y-1">
            {clinic.hours.map((h) => (
              <div key={h.days} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{h.days}</dt>
                <dd className="font-mono text-sm">{h.closes ? `${h.opens}–${h.closes}` : h.opens}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h2 className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-muted">Getting here</h2>
          <ul className="mt-3 space-y-1 text-ink-muted">
            {clinic.transport.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <p className="mt-2 text-sm text-ink-muted">{clinic.parking}</p>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-shell px-gutter py-5 text-sm text-ink-muted">
          Physiotherapy is a registered health profession regulated by the Australian Health
          Practitioner Regulation Agency. Remedial massage is self-regulated through professional
          association membership. This site provides general information only and is not a
          substitute for individual clinical assessment.
        </p>
      </div>
    </footer>
  );
}
