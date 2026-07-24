import { Link } from 'react-router-dom';
import type { Service } from 'shared';
import { cn } from '@/lib/cn';

export function ServiceCard({ service }: { service: Service }) {
  const isPhysio = service.discipline === 'physiotherapy';

  return (
    <Link
      to={`/services/${service.slug}`}
      className={cn(
        'group flex flex-col rounded-card border border-line bg-paper-raised p-6',
        'transition-colors hover:border-ink-faint',
      )}
    >
      <span
        className={cn(
          'text-micro font-semibold uppercase tracking-[0.14em]',
          isPhysio ? 'text-clinic' : 'text-balm',
        )}
      >
        {isPhysio ? 'Physiotherapy' : 'Remedial massage'}
      </span>

      <h3 className="mt-2 text-xl leading-snug">{service.name}</h3>
      <p className="mt-2 max-w-measure text-ink-muted">{service.summary}</p>

      <dl className="mt-6 flex items-baseline gap-6 border-t border-line pt-4 font-mono text-sm">
        <div>
          <dt className="sr-only">Duration</dt>
          <dd>{service.durationMinutes} min</dd>
        </div>
        <div>
          <dt className="sr-only">Fee</dt>
          <dd>${service.feeAud}</dd>
        </div>
        <span
          aria-hidden="true"
          className="ml-auto not-sr-only text-ink-faint transition-transform group-hover:translate-x-1"
        >
          →
        </span>
      </dl>
    </Link>
  );
}
