# 002 — Booking requests

**Status:** draft — awaiting approval
**Author:** spec-writer, 2026-07-21

## Problem

Booking currently means phoning during opening hours. People who decide to book
at 10pm, or who cannot make a private call from work, drop out. Reception also
loses time to phone tag on appointments that could have been captured in
writing.

## Goal

A prospective patient can submit an appointment request in under 90 seconds,
and reception can action it from a single list.

## Approach and its consequence

Requests, not real-time bookings. Nothing is confirmed by the website;
reception contacts the person and books them in the practice's own system. This
keeps a single source of truth for the calendar and avoids double-booking.

**The free-text "reason for visit" makes this a health records system.** Under
the Privacy Act 1988, an organisation providing a health service and holding
health information is covered regardless of turnover — the $3m small business
exemption does not apply. "Lower back pain since my surgery" is health
information, which is sensitive information, which requires consent to collect
and attracts the higher standard of protection. NSW providers are additionally
subject to the Health Records and Information Privacy Act 2002.

This is not a reason to drop the field — it is genuinely useful to reception.
It is a reason to design for it deliberately.

## Non-goals

- No real-time availability, no calendar integration, no confirmed bookings.
- No payment, no card capture.
- No patient accounts or login.
- No clinical intake questionnaire. The reason field is one optional sentence,
  not a health history.
- No file or image upload.

## Privacy requirements — requirements, not preferences

1. **Consent is explicit and unticked by default.** Submission is blocked
   without it. The consent text names what is collected and why (APP 3).
2. **A collection notice sits at the point of collection** — not buried in a
   linked policy — stating who collects it, why, who sees it, and how to
   request access or correction (APP 5).
3. **The reason field is optional and labelled as optional**, with guidance
   that clinical detail is not needed to book.
4. **Health information never enters a log, an error message, or a notification
   email.** Reception's email says a request arrived and links to it; the
   reason text is read in the admin view only.
5. **Retention is bounded and automatic.** An unactioned request is purged
   after 90 days. Once reception converts it to a patient, the record lives in
   the practice management system, where clinical retention law applies.
6. **Transport and storage are encrypted**, and the database is hosted in
   Australia.
7. **No third-party analytics, tag manager, session recorder or ad pixel on the
   booking page.** Session recorders capture form contents.

## User flows

1. Patient opens Book from any page → picks a service → enters name, phone,
   email → optionally picks a practitioner and preferred times → optionally
   adds a reason → consents → submits → sees a reference number and what
   happens next.
2. Validation fails → the first invalid field receives focus, with the error
   named next to it.
3. Submission fails on the network → the form is preserved, an error is shown,
   and retry does not create a duplicate.
4. Reception receives a notification containing no health information, opens
   the admin list, contacts the person, marks the request actioned.

## Acceptance criteria

- [ ] AC1: A request cannot be submitted without name, a valid phone or email,
      and a selected service.
- [ ] AC2: A request cannot be submitted without explicit consent; the consent
      control is unticked on load.
- [ ] AC3: The reason field is optional, labelled optional, and accepts at most
      500 characters.
- [ ] AC4: A successful submission returns a human-readable reference and
      states that the clinic will make contact, and by when.
- [ ] AC5: A collection notice is visible on the form itself before submission.
- [ ] AC6: The reason field never appears in any server log or error response.
- [ ] AC7: Submitting the same request twice within the idempotency window
      creates one record, not two.
- [ ] AC8: More than 5 requests from one source in 10 minutes are rejected with
      429.
- [ ] AC9: A bot filling the hidden honeypot field is accepted by the UI and
      silently discarded.
- [ ] AC10: Every request stores a purge date 90 days out.
- [ ] AC11: The form is fully keyboard operable; errors are announced to screen
      readers and the first invalid field receives focus.

## Data

New table `booking_requests`. Health information is confined to one nullable
column so that retention and redaction have a single target.

## Edge cases

- Only one of phone or email supplied → valid; at least one is required.
- 500-character reason → accepted; 501 → rejected with a field error.
- Whitespace-only name → rejected.
- Duplicate rapid submissions → idempotent.
- Database unreachable → 503 with a message telling the person to phone, with
  the number shown. A booking form that fails silently is worse than none.

## Open questions

1. Who receives the notification, and does the clinic want SMS as well as
   email? [email to reception only]
2. Is 90 days the right purge window for unactioned requests? [assumed yes]
3. Should the admin list be built now or does reception work from email
   links? [assumed a minimal authenticated admin list is spec 003]
