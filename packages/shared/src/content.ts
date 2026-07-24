import { z } from 'zod';

/**
 * Content schemas. Parsed at module load so a malformed entry throws at import
 * and fails the build, rather than rendering an empty card in production.
 */

export const disciplineSchema = z.enum(['physiotherapy', 'remedial-massage']);
export type Discipline = z.infer<typeof disciplineSchema>;

export const serviceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  discipline: disciplineSchema,
  /** One line, shown on the card. Descriptive, never an outcome claim. */
  summary: z.string().min(20).max(160),
  /** What this appointment is used for. Plural, specific, non-promissory. */
  treats: z.array(z.string().min(3)).min(2),
  /** What physically happens in a first appointment. */
  firstVisit: z.array(z.string().min(10)).min(2),
  durationMinutes: z.number().int().min(15).max(120),
  feeAud: z.number().int().positive(),
  /** Concession/health-fund position, stated plainly. */
  rebate: z.enum(['private-health-extras', 'private-health-extras-if-member', 'none']),
  referralRequired: z.boolean(),
});
export type Service = z.infer<typeof serviceSchema>;

export const practitionerSchema = z
  .object({
    name: z.string().min(3),
    title: z.string().min(3),
    discipline: disciplineSchema,
    qualifications: z.array(z.string().min(2)).min(1),
    /**
     * AHPRA registration number. Required for physiotherapists — they are
     * registered under the National Law and the number is publicly verifiable.
     */
    ahpraNumber: z.string().regex(/^PHY\d{10}$/).optional(),
    /** Professional association for self-regulated disciplines. */
    association: z.string().optional(),
    focus: z.array(z.string().min(3)).min(1),
  })
  .refine((p) => p.discipline !== 'physiotherapy' || Boolean(p.ahpraNumber), {
    message: 'A physiotherapist must have an AHPRA registration number.',
    path: ['ahpraNumber'],
  })
  .refine((p) => p.discipline !== 'remedial-massage' || Boolean(p.association), {
    message: 'A remedial massage therapist must list a professional association.',
    path: ['association'],
  });
export type Practitioner = z.infer<typeof practitionerSchema>;

export const clinicSchema = z.object({
  name: z.string().min(3),
  street: z.string().min(5),
  suburb: z.string().min(2),
  state: z.string().min(2),
  postcode: z.string().regex(/^\d{4}$/),
  phone: z.string().min(8),
  email: z.string().email(),
  hours: z.array(z.object({ days: z.string(), opens: z.string(), closes: z.string() })).min(1),
  transport: z.array(z.string().min(5)).min(1),
  parking: z.string().min(10),
});
export type Clinic = z.infer<typeof clinicSchema>;

/**
 * Terms that may not appear in site content.
 *
 * Health Practitioner Regulation National Law s133 prohibits advertising a
 * regulated health service using testimonials, claims of superiority,
 * unsubstantiated effectiveness claims, or anything encouraging indiscriminate
 * use of the service. This list is a good-faith mechanical check, not legal
 * advice, and it deliberately errs toward blocking.
 */
export const PROHIBITED_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\btestimonial/i, reason: 's133(1)(c): testimonials are prohibited' },
  {
    pattern: /\b(patient|client|customer|google|verified|5[- ]star)\s+reviews?\b/i,
    reason: 'patient reviews used in advertising read as testimonials',
  },
  {
    pattern: /\b(our|my)\s+(patients?|clients?)\s+(say|said|report|love|rave|tell)/i,
    reason: 's133(1)(c): reported patient statements are testimonials',
  },
  { pattern: /\bwhat our (patients|clients) say\b/i, reason: 'testimonial section heading' },
  { pattern: /\bchanged (my|their|her|his) li(fe|ves)\b/i, reason: 'outcome testimonial' },
  { pattern: /\b\d(\.\d)?\s*(star|\/\s*5)\b/i, reason: 'star ratings are testimonials' },
  { pattern: /\bsuccess stor/i, reason: 's133(1)(c): success stories are testimonials' },
  { pattern: /\bbefore\s*(and|&|\/)\s*after\b/i, reason: 'before/after imagery implies outcome' },
  { pattern: /\b(best|leading|top|number one|#1|premier|finest)\b/i, reason: 'claim of superiority' },
  { pattern: /\bguarantee(d|s)?\b/i, reason: 'outcome guarantee' },
  { pattern: /\bcure(s|d)?\b/i, reason: 'claim to cure' },
  { pattern: /\bpain[- ]free\b|\bpainless\b/i, reason: 'AHPRA: do not describe treatment as painless' },
  { pattern: /\b100%\b/i, reason: 'absolute effectiveness claim' },
  { pattern: /\bmiracle|\bmiraculous/i, reason: 'unsubstantiated claim' },
  { pattern: /\blimited time\b|\bhurry\b|\boffer ends\b|\bbook now before\b/i, reason: 'time-limited pressure on a health decision' },
  { pattern: /\bfix(es|ed)? your\b|\beliminate your pain\b/i, reason: 'outcome promise' },
];

/** Returns every prohibition a string violates. Empty array means compliant. */
export function checkCompliance(text: string): { pattern: string; reason: string }[] {
  return PROHIBITED_PATTERNS.filter((p) => p.pattern.test(text)).map((p) => ({
    pattern: String(p.pattern),
    reason: p.reason,
  }));
}
