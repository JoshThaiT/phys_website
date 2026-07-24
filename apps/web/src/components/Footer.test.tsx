import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';
import { clinic } from '@/content/clinic';

describe('Footer', () => {
  it('renders the full street address', () => {
    const { container } = render(<Footer />);
    const address = container.querySelector('address');
    expect(address?.textContent).toContain(clinic.street);
    expect(address?.textContent).toContain(clinic.postcode);
  });

  it('makes the phone number callable', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: clinic.phone });
    expect(link.getAttribute('href')).toMatch(/^tel:/);
  });

  it('lists every set of opening hours', () => {
    render(<Footer />);
    for (const h of clinic.hours) {
      expect(screen.getByText(h.days)).toBeInTheDocument();
    }
  });

  it('states the regulatory position of both disciplines', () => {
    render(<Footer />);
    expect(screen.getByText(/Australian Health Practitioner Regulation Agency/)).toBeInTheDocument();
    expect(screen.getByText(/self-regulated/)).toBeInTheDocument();
  });
});
