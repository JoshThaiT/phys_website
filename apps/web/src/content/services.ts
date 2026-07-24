import { serviceSchema, type Service } from 'shared';

/**
 * PLACEHOLDER fees and descriptions — replace with the clinic's real schedule.
 *
 * Copy discipline: describe what an appointment involves and what it is used
 * for. Never state what it will achieve. "Used for" is lawful; "will fix" is
 * not.
 */
const raw = [
  {
    slug: 'physiotherapy-initial',
    name: 'Initial physiotherapy consultation',
    discipline: 'physiotherapy',
    summary: 'A longer first appointment covering history, physical assessment and a written plan.',
    treats: [
      'Neck and lower back pain',
      'Shoulder, knee and ankle injuries',
      'Post-operative rehabilitation',
      'Sports and overuse injuries',
      'Persistent pain lasting more than three months',
    ],
    firstVisit: [
      'A conversation about your history, symptoms and what you need to get back to.',
      'A physical assessment of movement, strength and joint range.',
      'Hands-on treatment where it is indicated on the day.',
      'A written plan and exercises you take home, with an agreed review point.',
    ],
    durationMinutes: 45,
    feeAud: 145,
    rebate: 'private-health-extras',
    referralRequired: false,
  },
  {
    slug: 'physiotherapy-followup',
    name: 'Physiotherapy review',
    discipline: 'physiotherapy',
    summary: 'A standard follow-up appointment to reassess, progress your program and treat.',
    treats: ['Ongoing rehabilitation', 'Progressing an exercise program', 'Reassessment after an initial consultation'],
    firstVisit: [
      'Reassessment of the movements and measures taken at your last visit.',
      'Hands-on treatment and program progression as indicated.',
      'Updated exercises where your program has changed.',
    ],
    durationMinutes: 30,
    feeAud: 110,
    rebate: 'private-health-extras',
    referralRequired: false,
  },
  {
    slug: 'exercise-rehabilitation',
    name: 'Exercise rehabilitation session',
    discipline: 'physiotherapy',
    summary: 'A supervised session in the clinic gym working through your prescribed program.',
    treats: ['Strength rebuilding after injury', 'Return to sport preparation', 'Load management for persistent pain'],
    firstVisit: [
      'Your program run under supervision, with technique corrected as you go.',
      'Loads adjusted against how the previous week went.',
    ],
    durationMinutes: 45,
    feeAud: 95,
    rebate: 'private-health-extras',
    referralRequired: false,
  },
  {
    slug: 'remedial-massage-60',
    name: 'Remedial massage — 60 minutes',
    discipline: 'remedial-massage',
    summary: 'Focused soft-tissue treatment of a specific area, with assessment at the start.',
    treats: ['Muscular tension in the neck, shoulders and back', 'Desk-related postural strain', 'Training load and recovery'],
    firstVisit: [
      'A short discussion of the areas you want addressed and any medical history that matters.',
      'Soft tissue treatment of the identified areas.',
      'Stretches or self-release suggestions for between appointments.',
    ],
    durationMinutes: 60,
    feeAud: 130,
    rebate: 'private-health-extras-if-member',
    referralRequired: false,
  },
  {
    slug: 'remedial-massage-90',
    name: 'Remedial massage — 90 minutes',
    discipline: 'remedial-massage',
    summary: 'A longer soft-tissue appointment covering multiple areas or a full-body treatment.',
    treats: ['Multiple areas of muscular tension', 'Whole-body recovery work', 'Longer sessions for larger areas'],
    firstVisit: [
      'A short discussion of the areas you want addressed and any medical history that matters.',
      'Soft tissue treatment across the areas agreed.',
      'Stretches or self-release suggestions for between appointments.',
    ],
    durationMinutes: 90,
    feeAud: 185,
    rebate: 'private-health-extras-if-member',
    referralRequired: false,
  },
  {
    slug: 'dry-needling',
    name: 'Dry needling',
    discipline: 'physiotherapy',
    summary: 'Added to a physiotherapy appointment where assessment indicates it is appropriate.',
    treats: ['Myofascial trigger points', 'Muscular tension not responding to hands-on treatment'],
    firstVisit: [
      'Assessment of whether needling is indicated for you on the day.',
      'A consent conversation covering what it involves and common after-effects.',
      'Treatment within a standard physiotherapy appointment.',
    ],
    durationMinutes: 30,
    feeAud: 110,
    rebate: 'private-health-extras',
    referralRequired: false,
  },
] as const;

export const services: Service[] = raw.map((s) => serviceSchema.parse(s));

export const servicesBySlug = new Map(services.map((s) => [s.slug, s]));

export const physiotherapyServices = services.filter((s) => s.discipline === 'physiotherapy');
export const massageServices = services.filter((s) => s.discipline === 'remedial-massage');
