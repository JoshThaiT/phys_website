import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';
import { services } from '@/content/services';
import { practitioners } from '@/content/practitioners';

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

describe('Home', () => {
  it('links to every service', () => {
    renderHome();
    for (const service of services) {
      const link = screen.getByRole('link', { name: new RegExp(service.name, 'i') });
      expect(link).toHaveAttribute('href', `/services/${service.slug}`);
    }
  });

  it('separates physiotherapy from remedial massage', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Physiotherapy', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Remedial massage', level: 3 })).toBeInTheDocument();
  });

  it('shows every practitioner with their credentials', () => {
    renderHome();
    const section = screen.getByRole('heading', { name: 'Practitioners' }).parentElement!;
    for (const p of practitioners) {
      expect(within(section).getByRole('heading', { name: p.name })).toBeInTheDocument();
    }
  });

  it('publishes an AHPRA number for each registered physiotherapist', () => {
    renderHome();
    for (const p of practitioners.filter((x) => x.ahpraNumber)) {
      expect(screen.getByText(`AHPRA ${p.ahpraNumber}`)).toBeInTheDocument();
    }
  });

  it('has exactly one level-one heading', () => {
    renderHome();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
