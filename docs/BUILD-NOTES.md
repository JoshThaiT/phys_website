# Build notes — spec 001

`pnpm verify` green: 72 tests, lint and typecheck clean. `pnpm build` succeeds.

## The compliance suite is the point

`apps/web/src/content/compliance.test.ts` fails CI if prohibited copy appears in
either the content data or any rendered component. It encodes s133 of the
Health Practitioner Regulation National Law and AHPRA's advertising guidelines:
no testimonials, no reviews or star ratings, no superiority claims, no
guarantees, no "painless", no time-limited pressure.

It caught two real problems during this build:

1. **A gap in the checker.** A meta-test feeds it known-bad copy. "Our patients
   say we changed their lives" passed — the pattern set had no rule for
   reported patient statements. Added.
2. **False positives on Tailwind classes.** Scanning raw source flagged
   `leading-relaxed`, `top-0` and `align-top` as superiority claims. Only
   reader-visible copy is advertising, so class names, imports and code
   comments are stripped before checking. A compliance suite that cries wolf
   gets disabled within a month.

**This is a mechanical good-faith check, not legal advice.** A registered
practitioner should review the final copy before launch.

## Design

The visual direction is a clinic, not a spa. Palette from the room itself:
clinical teal drawn from kinesiology tape for the AHPRA-regulated physiotherapy
side, a warmer balm tone for self-regulated remedial massage — the colour split
carries the regulatory distinction the site is required to make plain. Paper
rather than cream, so it reads as a treatment note.

The signature is a protractor sweep. Range of motion is measured in degrees, so
degrees mark the stages of care — assessment at 30°, treatment at 90°, review
at 150°. It is the one place boldness is spent; everything else stays quiet.

Type: Bricolage Grotesque for display, Public Sans for body, IBM Plex Mono for
clinical data. **Screenshots taken during this build show fallback fonts** —
the sandbox cannot reach Google Fonts. They will load in a real browser.

## What is placeholder

Clearly marked in each content module. All of it needs replacing before launch:

- Clinic name, address, hours, phone, email
- The six services, their durations and fees
- All three practitioners — **the AHPRA numbers are format-valid but fake.**
  Every number published must resolve on the public AHPRA register.

## Known cosmetic issue

The placeholder email address is long enough to wrap mid-word in the footer. A
real domain will not. Not worth a fix against fake content.

## Not built — needs your answers

Booking is spec 002 and is blocked on decisions only you can make.
