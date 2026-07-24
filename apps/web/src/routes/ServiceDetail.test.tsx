import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServiceDetail } from './ServiceDetail';
import { services } from '@/content/services';

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/services/${slug}`]}>
      <Routes>
        <Route path="/services/:slug" element={<ServiceDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

const first = services[0]!;

describe('ServiceDetail', () => {
  it('shows duration, fee and referral position', () => {
    renderAt(first.slug);
    expect(screen.getByText(`${first.durationMinutes} minutes`)).toBeInTheDocument();
    expect(screen.getByText(`$${first.feeAud}`)).toBeInTheDocument();
    expect(screen.getByText(first.referralRequired ? 'Required' : 'Not required')).toBeInTheDocument();
  });

  it('lists what the appointment involves', () => {
    renderAt(first.slug);
    for (const step of first.firstVisit) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it('links to the booking form with this service preselected', () => {
    renderAt(first.slug);
    expect(screen.getByRole('link', { name: /request this appointment/i })).toHaveAttribute(
      'href',
      `/book?service=${first.slug}`,
    );
  });

  it('still offers the phone number as an alternative', () => {
    renderAt(first.slug);
    expect(screen.getByRole('link', { name: /or phone/i }).getAttribute('href')).toMatch(/^tel:/);
  });

  it('falls back to the not-found page for an unknown slug', () => {
    renderAt('no-such-service');
    expect(screen.getByRole('heading', { name: /does not exist/i })).toBeInTheDocument();
  });
});
