import { Link } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { services } from '@/content/services';

export function NotFound() {
  return (
    <>
      <Seo title="Page not found" description="That page does not exist." />
      <div className="mx-auto max-w-shell px-gutter py-section">
        <p className="font-mono text-sm text-ink-faint">404</p>
        <h1 className="mt-2 text-title">That page does not exist</h1>
        <p className="mt-4 max-w-measure text-ink-muted">
          It may have moved. Here is everything we offer:
        </p>
        <ul className="mt-8 max-w-measure">
          {services.map((s) => (
            <li key={s.slug} className="border-b border-line">
              <Link to={`/services/${s.slug}`} className="block py-3 underline-offset-4 hover:underline">
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
