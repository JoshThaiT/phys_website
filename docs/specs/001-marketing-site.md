# 001 — Public marketing site

**Status:** draft — awaiting approval
**Author:** spec-writer, 2026-07-21

## Problem

A physiotherapy and remedial massage clinic has no web presence. Prospective
patients searching for help with a specific complaint ("shoulder pain
Sydney", "remedial massage near me") have no way to judge whether this clinic
treats their problem, what it costs, whether their health fund is accepted, or
how to get an appointment. They currently phone during business hours or go
elsewhere.

Compounding this: the clinic is an AHPRA-regulated health service, so the
conversion tactics most clinic websites use — patient testimonials, star
ratings, outcome claims — are unlawful under s133 of the National Law. The site
has to convert without them.

## Goal

A prospective patient can determine, in under a minute, whether this clinic
treats their problem and what it will cost, and can start a booking.

## Non-goals

- **Booking itself.** This spec covers the path *to* the booking, not the
  booking engine. That is spec 002, and it needs answers this one does not.
- No patient accounts, no login, no patient-identifiable data of any kind.
- No blog or CMS. Content is typed data in the repo until there is a reason.
- No online payment.
- No telehealth or consultation delivery.

## Compliance constraints — these are requirements, not preferences

Derived from the Health Practitioner Regulation National Law s133 and AHPRA's
advertising guidelines. A change to any of these needs a human decision.

1. **No testimonials.** No patient quotes, reviews, star ratings, case stories,
   or before/after imagery. No embedded Google review widget.
2. **No claims of superiority.** No "best", "leading", "Sydney's top".
3. **No outcome or effectiveness claims** not backed by evidence. No "cure",
   "fix", "eliminate your pain", "guaranteed".
4. **No "safe", "painless", or "effective"** as bare descriptors of treatment.
5. **No time-limited offers or discount countdowns** — these are treated as
   pressuring a healthcare decision.
6. **Practitioner claims must be verifiable**: name, AHPRA registration number
   for physiotherapists, qualifications, association membership for massage
   therapists. Titles used accurately.
7. **The physiotherapy/remedial massage distinction must be visible**, since
   only one is AHPRA-registered and rebate eligibility differs.

What the site uses instead of social proof: specific clinical scope, named and
credentialled practitioners, transparent fees, and plain explanation of what a
first appointment involves.

## User flows

1. **Symptom-led.** Lands on home from search → scans conditions treated →
   recognises their complaint → opens that service → sees what the first
   appointment involves and the fee → taps Book.
2. **Price-led.** Lands on home → goes straight to Fees → sees per-service fee,
   health-fund rebate position, whether a referral is needed → taps Book.
3. **Practitioner-led.** Arrives via a practitioner's name → sees credentials,
   registration number, areas of focus → taps Book.
4. **Logistics-led.** Existing patient → finds address, parking, public
   transport, hours, phone → calls or navigates.

## Acceptance criteria

- [ ] AC1: Home lists every service offered, each linking to its own page.
- [ ] AC2: Each service page states what it treats, what a first appointment
      involves, its duration and its fee.
- [ ] AC3: A fees page lists every service with price, and states the
      health-fund rebate position and whether a GP referral is required.
- [ ] AC4: Every practitioner is listed with qualifications, and physiotherapists
      display an AHPRA registration number.
- [ ] AC5: The site states plainly which services are AHPRA-regulated
      physiotherapy and which are self-regulated remedial massage.
- [ ] AC6: A "Book" affordance is reachable from every page in one tap, and
      currently routes to phone and email until spec 002 ships.
- [ ] AC7: Address, hours, phone, parking and transport appear on every page
      footer.
- [ ] AC8: An automated content check fails the build if any prohibited term
      (testimonial markers, superiority claims, guarantee language) appears in
      site content.
- [ ] AC9: Every page has a unique title and meta description, and the clinic
      emits valid LocalBusiness/MedicalBusiness structured data.
- [ ] AC10: Usable at 320px width; all interactive elements keyboard reachable
      with a visible focus ring; contrast meets WCAG AA.

## Data

No database. Content is typed data validated by Zod schemas at module load, so
a malformed service or practitioner entry fails the build rather than rendering
blank. No patient data is collected, stored or transmitted by this spec.

## Edge cases

- Unknown service slug → 404 page offering the service list, not a blank screen.
- JavaScript disabled → core content and contact details still readable.
- Reduced motion preferred → all animation suppressed.
- Very long practitioner or service names → layout does not break at 320px.

## Open questions — blocking full content, not blocking the build

Defaults in brackets are what the implementation assumes until told otherwise.

1. Clinic name, address, hours, phone. [placeholder content, clearly marked]
2. Exact service list and fees. [a standard six-service set at typical Sydney
   metro rates]
3. Number of practitioners and their real credentials. [two placeholders]
4. Does the clinic offer telehealth? [assumed no]
5. HICAPS on-site claiming? [assumed yes, stated as such]
