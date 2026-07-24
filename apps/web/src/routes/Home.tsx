import { Link } from 'react-router-dom';
import { Arc } from '@/components/Arc';
import { Seo } from '@/components/Seo';
import { ServiceCard } from '@/components/ServiceCard';
import { practitioners } from '@/content/practitioners';
import { massageServices, physiotherapyServices } from '@/content/services';

/** The stages of care genuinely are a sequence, so the arc marks them. */
const stages = [
  {
    degrees: 30,
    title: 'Assessment',
    body: 'History, physical examination and the measurements we will compare against later.',
  },
  {
    degrees: 90,
    title: 'Treatment',
    body: 'Hands-on work and a program built for the load you actually need to handle.',
  },
  {
    degrees: 150,
    title: 'Review',
    body: 'The same measurements, repeated. Progress the plan, or change it.',
  },
];

export function Home() {
  return (
    <>
      <Seo
        title="Physiotherapy & remedial massage in Newtown"
        description="Physiotherapy and remedial massage appointments in Newtown. Fees, practitioner credentials and what a first appointment involves."
        includeBusinessSchema
      />

      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-shell items-end gap-10 px-gutter py-section lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.14em] text-clinic">
              Newtown, Sydney
            </p>
            <h1 className="mt-4 text-display">
              Get the range
              <br />
              back.
            </h1>
            <p className="mt-6 max-w-measure text-lg text-ink-muted">
              Physiotherapy and remedial massage for people who need a specific problem
              assessed, treated and measured. Appointments run to time, and you leave with a
              written plan.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#services"
                className="rounded-card bg-ink px-5 py-3 font-medium text-ink-inverse transition-colors hover:bg-clinic-deep"
              >
                See what we treat
              </a>
              <Link
                to="/fees"
                className="rounded-card border border-line-strong px-5 py-3 font-medium transition-colors hover:border-ink"
              >
                Fees &amp; rebates
              </Link>
            </div>
          </div>

          <div className="max-w-sm justify-self-end">
            <Arc degrees={135} label="A protractor sweep, the measure of joint range" />
            <p className="mt-3 font-mono text-sm text-ink-muted">
              Range of motion is measured in degrees. So is progress.
            </p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-shell px-gutter py-section">
        <h2 className="text-title">What we treat</h2>
        <p className="mt-3 max-w-measure text-ink-muted">
          Two disciplines under one roof. Physiotherapy is a registered profession; remedial
          massage is self-regulated. Which one suits you depends on what you need — call if
          you are not sure.
        </p>

        <h3 className="mt-12 text-micro font-semibold uppercase tracking-[0.14em] text-clinic">
          Physiotherapy
        </h3>
        <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {physiotherapyServices.map((s) => (
            <li key={s.slug} className="contents">
              <ServiceCard service={s} />
            </li>
          ))}
        </ul>

        <h3 className="mt-12 text-micro font-semibold uppercase tracking-[0.14em] text-balm">
          Remedial massage
        </h3>
        <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {massageServices.map((s) => (
            <li key={s.slug} className="contents">
              <ServiceCard service={s} />
            </li>
          ))}
        </ul>
      </section>

      {/* How care runs */}
      <section className="border-y border-line bg-paper-sunk">
        <div className="mx-auto max-w-shell px-gutter py-section">
          <h2 className="text-title">How an episode of care runs</h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {stages.map((stage) => (
              <li key={stage.title}>
                <div className="max-w-[9.5rem]">
                  <Arc degrees={stage.degrees} />
                </div>
                <p className="mt-3 font-mono text-sm text-clinic">{stage.degrees}°</p>
                <h3 className="mt-1 text-xl">{stage.title}</h3>
                <p className="mt-2 text-ink-muted">{stage.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Practitioners */}
      <section id="practitioners" className="mx-auto max-w-shell px-gutter py-section">
        <h2 className="text-title">Practitioners</h2>
        <p className="mt-3 max-w-measure text-ink-muted">
          Registration numbers below can be checked on the public AHPRA register.
        </p>
        <ul className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {practitioners.map((p) => (
            <li key={p.name} className="border-t border-line pt-5">
              <h3 className="text-xl">{p.name}</h3>
              <p className={p.discipline === 'physiotherapy' ? 'text-clinic' : 'text-balm'}>
                {p.title}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-ink-muted">
                {p.qualifications.map((q) => <li key={q}>{q}</li>)}
              </ul>
              <p className="mt-3 font-mono text-sm text-ink-faint">
                {p.ahpraNumber ? `AHPRA ${p.ahpraNumber}` : p.association}
              </p>
              <p className="mt-3 text-sm">
                <span className="text-ink-muted">Focus: </span>
                {p.focus.join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
