import { Seo } from '@/components/Seo';
import { massageServices, physiotherapyServices } from '@/content/services';
import type { Service } from 'shared';

function FeeTable({ caption, services }: { caption: string; services: Service[] }) {
  return (
    <table className="mt-4 w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line-strong text-micro uppercase tracking-[0.14em] text-ink-muted">
          <th scope="col" className="py-3 pr-4 font-semibold">Appointment</th>
          <th scope="col" className="py-3 pr-4 font-semibold">Duration</th>
          <th scope="col" className="py-3 pr-4 font-semibold">Fee</th>
          <th scope="col" className="py-3 font-semibold">Referral</th>
        </tr>
      </thead>
      <tbody>
        {services.map((s) => (
          <tr key={s.slug} className="border-b border-line align-top">
            <th scope="row" className="py-4 pr-4 font-normal">{s.name}</th>
            <td className="py-4 pr-4 font-mono text-sm">{s.durationMinutes} min</td>
            <td className="py-4 pr-4 font-mono text-sm">${s.feeAud}</td>
            <td className="py-4 text-sm text-ink-muted">{s.referralRequired ? 'Required' : 'Not required'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Fees() {
  return (
    <>
      <Seo
        title="Fees & health fund rebates"
        description="Appointment fees for physiotherapy and remedial massage, health fund rebate position, and referral requirements."
      />
      <div className="mx-auto max-w-shell px-gutter py-section">
        <h1 className="text-title">Fees &amp; rebates</h1>
        <p className="mt-4 max-w-measure text-lg text-ink-muted">
          Every fee is listed. You will not be quoted one price and charged another.
        </p>

        <section className="mt-12">
          <h2 className="text-micro font-semibold uppercase tracking-[0.14em] text-clinic">
            Physiotherapy — AHPRA registered
          </h2>
          <FeeTable caption="Physiotherapy fees" services={physiotherapyServices} />
        </section>

        <section className="mt-12">
          <h2 className="text-micro font-semibold uppercase tracking-[0.14em] text-balm">
            Remedial massage — self-regulated
          </h2>
          <FeeTable caption="Remedial massage fees" services={massageServices} />
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-card border border-line bg-paper-raised p-6">
            <h2 className="text-xl">Private health funds</h2>
            <p className="mt-2 text-ink-muted">
              HICAPS terminals are on site, so extras claims are processed at the desk and you pay
              the gap. Rebate amounts are set by your fund and your level of cover — we cannot
              quote them. Remedial massage is only claimable where your fund recognises the
              therapist as a provider.
            </p>
          </div>
          <div className="rounded-card border border-line bg-paper-raised p-6">
            <h2 className="text-xl">Referrals and third-party claims</h2>
            <p className="mt-2 text-ink-muted">
              You do not need a GP referral to see a physiotherapist privately. Referrals are
              required for Medicare Chronic Disease Management plans, and for workers
              compensation and CTP claims, which are billed differently — call reception before
              your first appointment so we can set this up.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
