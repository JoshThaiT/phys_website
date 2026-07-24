import { Link, useParams } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { clinic } from '@/content/clinic';
import { servicesBySlug } from '@/content/services';
import { NotFound } from './NotFound';

const REBATE_COPY: Record<string, string> = {
  'private-health-extras': 'Claimable on private health extras cover. HICAPS on site — you pay the gap only.',
  'private-health-extras-if-member':
    'Claimable on extras cover where your fund recognises remedial massage and your therapist is a recognised provider. Check with your fund.',
  none: 'No rebate applies to this appointment.',
};

export function ServiceDetail() {
  const { slug } = useParams();
  const service = slug ? servicesBySlug.get(slug) : undefined;

  if (!service) return <NotFound />;

  const isPhysio = service.discipline === 'physiotherapy';

  return (
    <>
      <Seo
        title={service.name}
        description={service.summary}
      />
      <article className="mx-auto max-w-shell px-gutter py-section">
        <Link to="/#services" className="text-sm text-ink-muted underline underline-offset-4">
          ← All services
        </Link>

        <p
          className={`mt-8 text-micro font-semibold uppercase tracking-[0.14em] ${
            isPhysio ? 'text-clinic' : 'text-balm'
          }`}
        >
          {isPhysio ? 'Physiotherapy — AHPRA registered' : 'Remedial massage — self-regulated'}
        </p>
        <h1 className="mt-3 text-title">{service.name}</h1>
        <p className="mt-4 max-w-measure text-lg text-ink-muted">{service.summary}</p>

        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-line py-5 font-mono">
          <div>
            <dt className="text-micro uppercase tracking-[0.14em] text-ink-muted">Duration</dt>
            <dd className="mt-1 text-lg">{service.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt className="text-micro uppercase tracking-[0.14em] text-ink-muted">Fee</dt>
            <dd className="mt-1 text-lg">${service.feeAud}</dd>
          </div>
          <div>
            <dt className="text-micro uppercase tracking-[0.14em] text-ink-muted">Referral</dt>
            <dd className="mt-1 text-lg">{service.referralRequired ? 'Required' : 'Not required'}</dd>
          </div>
        </dl>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <section>
            <h2 className="text-xl">Used for</h2>
            <ul className="mt-4 space-y-2">
              {service.treats.map((t) => (
                <li key={t} className="border-b border-line pb-2 text-ink-muted">{t}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl">What the appointment involves</h2>
            <ol className="mt-4 space-y-4">
              {service.firstVisit.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="font-mono text-sm text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-ink-muted">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="mt-12 rounded-card border border-line bg-paper-raised p-6">
          <h2 className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Health fund rebate
          </h2>
          <p className="mt-2 max-w-measure">{REBATE_COPY[service.rebate]}</p>
        </aside>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to={`/book?service=${service.slug}`}
            className="rounded-card bg-clinic px-5 py-3 font-medium text-ink-inverse transition-colors hover:bg-clinic-deep"
          >
            Request this appointment
          </Link>
          <a
            href={`tel:${clinic.phone.replace(/\s|\(|\)/g, '')}`}
            className="rounded-card border border-line-strong px-5 py-3 font-medium transition-colors hover:border-ink"
          >
            Or phone {clinic.phone}
          </a>
        </div>
      </article>
    </>
  );
}
