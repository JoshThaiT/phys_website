import { useEffect } from 'react';
import { clinic } from '@/content/clinic';

interface SeoProps {
  title: string;
  description: string;
  /** Emitted only on the home route; one LocalBusiness node per site. */
  includeBusinessSchema?: boolean;
  /** Admin pages only: excludes the page from indexing (spec 003 AC11). */
  noindex?: boolean;
}

function setMeta(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Structured data describes the business and its hours. It deliberately omits
 * aggregateRating and review — those are testimonials under s133 and would be
 * a breach even in machine-readable form.
 */
export function businessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: clinic.name,
    telephone: clinic.phone,
    email: clinic.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: clinic.street,
      addressLocality: clinic.suburb,
      addressRegion: clinic.state,
      postalCode: clinic.postcode,
      addressCountry: 'AU',
    },
    medicalSpecialty: 'PhysicalTherapy',
  };
}

export function Seo({ title, description, includeBusinessSchema = false, noindex = false }: SeoProps) {
  useEffect(() => {
    document.title = `${title} — ${clinic.name}`;
    setMeta('description', description);
    // A client-side SPA navigation reuses this same <head> — an admin page's
    // noindex tag must not survive onto the next public page rendered in the
    // same session, or it stays not-indexable indefinitely.
    if (noindex) {
      setMeta('robots', 'noindex,nofollow');
    } else {
      setMeta('robots', 'index,follow');
    }
  }, [title, description, noindex]);

  useEffect(() => {
    if (!includeBusinessSchema) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(businessSchema());
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [includeBusinessSchema]);

  return null;
}
