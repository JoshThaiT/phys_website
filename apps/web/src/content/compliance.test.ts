import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkCompliance, practitionerSchema, serviceSchema } from 'shared';
import { services } from './services';
import { practitioners } from './practitioners';
import { clinic } from './clinic';

/**
 * Health Practitioner Regulation National Law s133 and AHPRA's advertising
 * guidelines. These tests exist so that a prohibited phrase added later fails
 * CI rather than depending on someone remembering the rule.
 *
 * This is a mechanical good-faith check, not legal advice.
 */

function everyString(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => everyString(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => everyString(v, out));
  return out;
}

describe('s133 compliance — content data', () => {
  const strings = [
    ...everyString(services),
    ...everyString(practitioners),
    ...everyString(clinic),
  ];

  it('has content to check', () => {
    expect(strings.length).toBeGreaterThan(50);
  });

  it.each(['services', 'practitioners', 'clinic'])('%s contains no prohibited terms', (name) => {
    const source = { services, practitioners, clinic }[name];
    const violations = everyString(source)
      .flatMap((s) => checkCompliance(s).map((v) => `${v.reason} — in: "${s.slice(0, 60)}"`));
    expect(violations).toEqual([]);
  });
});

describe('s133 compliance — rendered copy', () => {
  const dir = join(process.cwd(), 'apps/web/src');

  function tsxFiles(d: string): string[] {
    return readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = join(d, e.name);
      if (e.isDirectory()) return tsxFiles(p);
      return e.name.endsWith('.tsx') && !e.name.includes('.test.') ? [p] : [];
    });
  }

  it('finds component files to scan', () => {
    expect(tsxFiles(dir).length).toBeGreaterThan(3);
  });

  /**
   * Only copy a patient can read counts as advertising. Class names
   * (`leading-relaxed`, `top-0`), imports and code comments are not, and
   * scanning them produces false positives that erode trust in this suite.
   */
  function visibleCopy(source: string): string {
    return source
      .replace(/className=(\{[^}]*\}|"[^"]*")/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
      .replace(/^\s*import[\s\S]*?;$/gm, ' ')
      .replace(/\b(href|to|type|id|rel|aria-[a-z]+)=("[^"]*"|\{[^}]*\})/g, ' ');
  }

  it('strips class names before checking', () => {
    expect(visibleCopy('<p className="leading-relaxed top-0">Hello</p>')).not.toContain('leading');
  });

  it('no component contains a prohibited marketing claim', () => {
    const violations = tsxFiles(dir).flatMap((file) => {
      const text = visibleCopy(readFileSync(file, 'utf8'));
      return checkCompliance(text).map((v) => `${file}: ${v.reason}`);
    });
    expect(violations).toEqual([]);
  });
});

describe('the compliance checker itself', () => {
  it.each([
    ['Our patients say we changed their lives', 'testimonial'],
    ['Sydney\u2019s best physiotherapy clinic', 'superiority'],
    ['Guaranteed results in four weeks', 'guarantee'],
    ['A painless treatment', 'painless'],
    ['See our 5 star Google reviews', 'reviews'],
    ['Limited time offer \u2014 book now before it ends', 'pressure'],
    ['We cure back pain', 'cure'],
  ])('flags %s', (copy) => {
    expect(checkCompliance(copy).length).toBeGreaterThan(0);
  });

  it.each([
    'A physiotherapy review appointment to reassess your program.',
    'We measure joint range at the first appointment and again at review.',
    'Used for neck and lower back pain.',
  ])('allows legitimate clinical copy: %s', (copy) => {
    expect(checkCompliance(copy)).toEqual([]);
  });
});

describe('practitioner credential requirements', () => {
  it('every physiotherapist publishes an AHPRA registration number', () => {
    for (const p of practitioners.filter((x) => x.discipline === 'physiotherapy')) {
      expect(p.ahpraNumber, `${p.name} is missing an AHPRA number`).toMatch(/^PHY\d{10}$/);
    }
  });

  it('every remedial massage therapist names a professional association', () => {
    for (const p of practitioners.filter((x) => x.discipline === 'remedial-massage')) {
      expect(p.association, `${p.name} is missing an association`).toBeTruthy();
    }
  });

  it('rejects a physiotherapist without a registration number', () => {
    const result = practitionerSchema.safeParse({
      name: 'Test Physio',
      title: 'Physiotherapist',
      discipline: 'physiotherapy',
      qualifications: ['BPhysio'],
      focus: ['Back'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a service whose slug is not url-safe', () => {
    const bad = { ...services[0], slug: 'Not A Slug' };
    expect(serviceSchema.safeParse(bad).success).toBe(false);
  });
});
