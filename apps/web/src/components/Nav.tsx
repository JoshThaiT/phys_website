import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { clinic } from '@/content/clinic';
import { cn } from '@/lib/cn';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/fees', label: 'Fees & rebates', end: false },
  { to: '/#practitioners', label: 'Practitioners', end: false },
  { to: '/#visit', label: 'Find us', end: false },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-shell items-center gap-4 px-gutter py-3">
        <Link to="/" className="font-display text-base font-bold leading-tight tracking-tight">
          {clinic.name.split(' ')[0]}
          <span className="block text-micro font-medium uppercase tracking-[0.14em] text-ink-muted">
            Physiotherapy &amp; Remedial Massage
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  'text-sm text-ink-muted transition-colors hover:text-ink',
                  isActive && l.end && 'text-ink',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/book"
          className="ml-auto rounded-card bg-clinic px-4 py-2 text-sm font-medium text-ink-inverse
                     transition-colors hover:bg-clinic-deep md:ml-0"
        >
          Book<span className="hidden sm:inline"> an appointment</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="rounded-card border border-line px-3 py-2 text-sm md:hidden"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line md:hidden">
          <ul className="mx-auto max-w-shell px-gutter py-2">
            {links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="block border-b border-line py-3 text-sm last:border-0"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
