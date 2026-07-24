import { clinicSchema, type Clinic } from 'shared';

/** PLACEHOLDER — replace with the real clinic details before launch. */
export const clinic: Clinic = clinicSchema.parse({
  name: 'Meridian Physiotherapy & Remedial Massage',
  street: 'Suite 3, 118 Enmore Road',
  suburb: 'Newtown',
  state: 'NSW',
  postcode: '2042',
  phone: '(02) 9557 0000',
  email: 'reception@meridianphysio.example',
  hours: [
    { days: 'Monday to Thursday', opens: '7:00am', closes: '7:00pm' },
    { days: 'Friday', opens: '7:00am', closes: '5:00pm' },
    { days: 'Saturday', opens: '8:00am', closes: '1:00pm' },
    { days: 'Sunday', opens: 'Closed', closes: '' },
  ],
  transport: [
    'Newtown Station — 6 minute walk',
    'Bus 423, 426, 428 — Enmore Road stop at the door',
  ],
  parking: 'Two-hour metered parking on Enmore Road; unrestricted parking on Simmons Street after 6pm.',
});
