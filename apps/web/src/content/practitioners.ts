import { practitionerSchema, type Practitioner } from 'shared';

/**
 * PLACEHOLDER — replace with real practitioners before launch.
 *
 * AHPRA registration numbers shown here are format-valid placeholders and are
 * not real registrations. Every physiotherapist listed publicly must show a
 * number that resolves on the public AHPRA register.
 */
const raw = [
  {
    name: 'Dr Aoife Brennan',
    title: 'Physiotherapist',
    discipline: 'physiotherapy',
    qualifications: ['Doctor of Physiotherapy, University of Sydney', 'Member, Australian Physiotherapy Association'],
    ahpraNumber: 'PHY0001234567',
    focus: ['Lower back and neck', 'Post-operative knee and shoulder rehabilitation', 'Persistent pain'],
  },
  {
    name: 'Marcus Oyelaran',
    title: 'Physiotherapist',
    discipline: 'physiotherapy',
    qualifications: ['Bachelor of Physiotherapy (Hons), UTS', 'Graduate Certificate in Sports Physiotherapy'],
    ahpraNumber: 'PHY0007654321',
    focus: ['Running and load-related injuries', 'Return to sport', 'Exercise rehabilitation'],
  },
  {
    name: 'Priya Raman',
    title: 'Remedial Massage Therapist',
    discipline: 'remedial-massage',
    qualifications: ['Diploma of Remedial Massage', 'Certificate IV in Massage Therapy'],
    association: 'Massage & Myotherapy Australia',
    focus: ['Neck, shoulder and upper back', 'Desk-related postural strain', 'Training recovery'],
  },
] as const;

export const practitioners: Practitioner[] = raw.map((p) => practitionerSchema.parse(p));
