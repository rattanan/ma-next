---
version: alpha
name: "Amplitude"
website: "https://amplitude.com"
description: >-
  A product-analytics platform whose marketing site runs on a near-monochrome canvas with a single cobalt-blue voltage and a black-pill primary CTA — the above-fold hero pairs a 60px display headline in pure black with an animated rotating tagline that lights up in cobalt #1e61f0, sitting over an embedded purple-tinted dashboard mock that does the entire chromatic job below the headline. IBM Plex Sans (with Gellix as the rendered display) carries every tier; the system stays at weight 600 across labels and headings rather than reaching for 700+. Six product-domain accent panels (cobalt, purple-blue, violet, near-black) below the fold tile out the "unfair advantage" bands. The primary CTA is a 56px-tall near-black pill #1a1f23 — not the brand cobalt — which inverts the dev-tools convention of holding the brand color for the CTA fill.

seo:
  title: "Amplitude Design System for React — cobalt blue, IBM Plex Sans, 16 components"
  metaDescription: "Amplitude's marketing-system tokens as a DESIGN.md file. Cobalt voltage on a near-monochrome canvas, IBM Plex Sans / Gellix display, black-pill CTA, 18 colors, 16 components. For React, Next.js, and AI coding tools."
  highlights:
    - "Black CTA, blue voltage — the primary button fills with near-black #1a1f23 while cobalt #1e61f0 is reserved for the rotating tagline word"
    - "Animated word-swap headline — the hero h1 cycles through four taglines, each rendered as a cobalt span inside a black sentence"
    - "Embedded dashboard hero — the above-fold area shows a real-looking purple-tinted analytics mock rather than abstract brand chrome"
    - "Six-up advantage tile band — saturated-fill cards in cobalt, indigo, violet, and ink build a horizontal advantage strip below the fold"
    - "IBM Plex Sans across every tier — Gellix is the visible display family but the loaded font variables walk IBM Plex Sans and IBM Plex Serif"
  tags:
    - "Analytics & Data"
  lastUpdated: "2026-05-19"
  author:
    name: "Dov Azencot"
    url: "https://x.com/dovazencot"
  opening: |
    Amplitude's marketing site does the opposite of what its category usually does. Where Mixpanel paints the hero violet and Segment fills its CDP page with deep navy, Amplitude sits on a near-monochrome canvas — a 60px IBM Plex Sans headline in pure black on white, with one cobalt-blue word that animates through "faster answers," "testing everything," "non-stop optimizations." The brand voltage is reserved entirely for that rotating verb. The primary CTA beneath the headline does not even use the cobalt — it is a 56px-tall near-black pill in ink #1a1f23 with white text, sitting next to a transparent secondary that opens a request-demo flow.

    The DESIGN.md file packages the system into a machine-readable spec. Inside: 18 color tokens drawn from a structural palette of near-blacks, cool grays, and a hairline cream, plus a brand tier of cobalt #1e61f0, deep cobalt #0052f2, navy #001a4f, and a single accent violet #a273ff that appears only in the "unfair advantage" band below the fold. 14 typography tokens span the Gellix display stack with IBM Plex Sans as the loaded body family — sizes go from 60px hero down to 12px metadata, with weight 600 doing the heading work and weight 400 the body. 16 components cover the black-pill primary, the dashboard-mock embed, the six-up advantage tile band, hairline cards, and the top-nav.

    Feed this file to Claude or Cursor and it reproduces Amplitude's specific moves: near-monochrome canvas instead of brand-tinted gradient, cobalt voltage reserved for a single animated word, near-black pill CTA over the brand cobalt, and the embedded dashboard mock that does the chromatic job the hero itself refuses to do. The one move worth borrowing only if your product has a genuine analytics surface: the dashboard-as-hero embed. Most teams reach for an abstract brand gradient because they have nothing real to show.
  related:
    - href: "/design"
      title: "Browse all design systems"
      description: "The full directory of DESIGN.md files on shadcn.io, with live mockups for each."
    - href: "https://amplitude.com"
      title: "Amplitude — official site"
      description: "Amplitude's public marketing site — the source of truth for the live tokens captured in this file."
    - href: "https://github.com/google-labs-code/design.md"
      title: "The DESIGN.md specification"
      description: "Google Labs' open spec for machine-readable design system files — the format this page is built on."
  questions:
    - id: "primary-color"
      title: "What is Amplitude's primary brand color?"
      answer: "Amplitude's brand voltage is a saturated cobalt blue #1e61f0, with a deeper cobalt #0052f2 reserved for the gradient end-stops behind the embedded dashboard mock and a near-navy #001a4f used as the surface tone of the cobalt advantage tile below the fold. The cobalt appears just six times in the captured page — twice as text on the animated hero tagline, twice as a background fill inside the dashboard mock, twice as a border. The primary CTA pill is not cobalt; it is near-black ink #1a1f23. This reservation is the design move — the brand color belongs to the rotating verb in the headline, not to the call to action."
    - id: "typography"
      title: "What typeface does Amplitude use, and what should I use as a substitute?"
      answer: "Amplitude's rendered marketing typography is Gellix, a contemporary geometric sans loaded inside a heavy fallback stack that walks Arial and system-ui. The CSS exposes IBM Plex Sans and IBM Plex Serif as the loaded webfonts (--font-ibm-plex-sans, --font-ibm-plex-serif), with Plex Sans active across body and labels. Display headlines sit at 60px in weight 700 with -1px tracking; section labels at 16-18px in weight 600; body at 14-16px in weight 400. Inter at the same weights is the closest open-source substitute for Gellix, and IBM Plex Sans itself is free under the OFL — so the loaded-font stack is already reproducible without any licensing work. Weight 600 is the system's emphasis tier; there is no 800+ moment anywhere on the page."
    - id: "cta-pill"
      title: "Why is Amplitude's primary CTA black instead of cobalt blue?"
      answer: "Amplitude inverts the dev-tools convention of filling the primary CTA with the brand color. The hero CTA is a 56px-tall near-black pill #1a1f23 with white text, sitting beside a transparent secondary button. The cobalt is reserved for the rotating headline word — the verb that completes the sentence 'The AI analytics platform for [faster answers].' Splitting the brand voltage and the call-to-action fill keeps both moments legible: the headline animation reads as the product's voice, and the CTA reads as a destination button rather than as a brand reinforcement. Stripe, Vercel, and Linear all use a similar split (their CTAs are also dark / monochrome rather than brand-colored)."
    - id: "rounded-style"
      title: "What is Amplitude's corner-radius philosophy?"
      answer: "Amplitude runs a small-step radius scale anchored at 6px, with a fully-rounded pill for the primary CTA. 6px appears 55 times across cards, dropdowns, and feature cells; 8px is the secondary tier with 20 occurrences on slightly larger surfaces; 16px and 12px sit on the dashboard-mock chrome inside the hero. The pill (9999px / 30-32px) carries the primary CTA, the rotating-tagline highlight chip behind the animated word, and a handful of dashboard mock pills. There is no 4px tight tier — the smallest radius in the system is 6px, which keeps the surface language warmer than a typical dev-tools system."
    - id: "use-in-project"
      title: "Can I use this DESIGN.md to build my own analytics-platform marketing site?"
      answer: "Yes — the file is designed to be fed into Claude, Cursor, or any AI tool that reads structured design tokens. The agent will reproduce Amplitude's specific moves: near-monochrome canvas with cobalt voltage reserved for a single animated headline word, black-pill primary CTA rather than a brand-colored fill, IBM Plex Sans across every typographic tier, embedded dashboard mock as the chromatic anchor instead of an abstract gradient, and a six-up advantage tile band in cobalt-indigo-violet-ink below the fold. You can also reference the tokens directly: every hex, font name, radius, and spacing value is a quoted scalar you can paste into Tailwind config. The one caveat: the rotating-headline move requires either real product motion or a Framer-Motion text-cycle component to land — a static cobalt word feels dead."

mockups:
  - "marketing-hero"
  - "dashboard-card-grid"

colors:
  primary: "#1e61f0"
  primary-dark: "#0052f2"
  primary-navy: "#001a4f"
  accent-violet: "#a273ff"
  accent-periwinkle: "#6980ff"
  ink: "#000000"
  ink-pill: "#1a1f23"
  ink-soft: "#171717"
  ink-muted: "#373d42"
  muted: "#565656"
  muted-cool: "#697077"
  muted-warm: "#868d95"
  body-text: "#333333"
  canvas: "#ffffff"
  surface-1: "#f2f4f8"
  hairline: "#d5d9e0"
  hairline-strong: "#9fa5ad"
  cookie-ink: "#1f1f1f"

typography:
  display-xl:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 60px
    fontWeight: 700
    lineHeight: 70px
    letterSpacing: "-1px"
  display-md:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 44px
    fontWeight: 600
    lineHeight: 48px
    letterSpacing: "-1px"
  heading-lg:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 30px
    letterSpacing: "-0.12px"
  heading-md:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 22px
    fontWeight: 500
    lineHeight: 24px
    letterSpacing: 0
  heading-sm:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: 0
  body-lg:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 23.4px
    letterSpacing: 0
  body-md:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0
  body-sm:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 18.9px
    letterSpacing: 0
  label-md:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 21.6px
    letterSpacing: "-0.04px"
  label-sm:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 18.9px
    letterSpacing: "-0.035px"
  button-md:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0
  nav-link:
    fontFamily: "\"IBM Plex Sans\", Gellix, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0
  caption:
    fontFamily: "Gellix, \"IBM Plex Sans\", Arial, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0
  body-serif:
    fontFamily: "\"IBM Plex Serif\", Georgia, serif"
    fontSize: 14.4px
    fontWeight: 400
    lineHeight: 21.6px
    letterSpacing: 0

rounded:
  none: "0px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "18px"
  pill: "30px"
  full: "9999px"

spacing:
  xxs: "2px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"

components:
  button-primary:
    backgroundColor: "{colors.ink-pill}"
    textColor: "{colors.canvas}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "16px"
    height: "56px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "7px 16px"
    height: "40px"
    borderColor: "{colors.hairline}"
  button-cobalt:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "40px"
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
    height: "64px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    padding: "0px 12px"
  hero-heading:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.display-xl}"
    padding: "0px"
  hero-tagline-highlight:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.display-xl}"
  section-heading:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.display-md}"
  body-paragraph:
    backgroundColor: "transparent"
    textColor: "{colors.body-text}"
    typography: "{typography.body-md}"
  body-paragraph-muted:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.body-md}"
  card-hairline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: "24px"
    borderColor: "{colors.hairline}"
  card-surface:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: "24px 16px"
  advantage-tile-cobalt:
    backgroundColor: "{colors.primary-navy}"
    textColor: "{colors.canvas}"
    typography: "{typography.heading-sm}"
    rounded: "{rounded.xl}"
    padding: "24px"
  advantage-tile-violet:
    backgroundColor: "{colors.accent-violet}"
    textColor: "{colors.ink}"
    typography: "{typography.heading-sm}"
    rounded: "{rounded.xl}"
    padding: "24px"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "40px"
    borderColor: "{colors.hairline}"
  stat-callout:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.display-md}"
    padding: "24px 16px"
---

## Overview

Amplitude's marketing site refuses the convention of its category. **Voltage-as-verb.** Where Mixpanel paints its hero violet and Segment fills its CDP page with deep navy, Amplitude sits on a near-monochrome canvas — a 60px display headline in pure black `{colors.ink}` on white `{colors.canvas}`, with one cobalt-blue word that animates through "faster answers," "testing everything," "non-stop optimizations." The brand voltage `{colors.primary}` (#1e61f0) is reserved entirely for that rotating verb. The primary CTA beneath the headline does not even use the cobalt — it is a 56px-tall near-black pill in `{colors.ink-pill}` (#1a1f23) with white text, sitting next to a transparent secondary that opens a request-demo flow.

The chromatic discipline is the move. The brand cobalt appears six times in the captured page — twice as text on the rotating word, twice as a background fill inside the embedded dashboard mock, twice as a border. Deeper cobalts (`{colors.primary-dark}` #0052f2 and `{colors.primary-navy}` #001a4f) live almost entirely inside the dashboard-mock chrome and the cobalt advantage tile below the fold. Where Vercel holds matte black across the page and Linear runs a violet-graphite surface ladder, Amplitude does neither — it runs an explicitly editorial white canvas and lets a single in-product mock carry the chromatic anchor.

Typography is the loaded IBM Plex stack (`--font-ibm-plex-sans`, `--font-ibm-plex-serif`) with Gellix as the rendered display family. Display tops at 60px in weight 700 with -1px tracking, headings at 18-24px in weight 600, body at 14-16px in weight 400. Weight 600 is the system's emphasis tier — there is no 800+ moment.

**Key Characteristics:**
- Near-monochrome canvas (`{colors.canvas}` — #ffffff) with pure black `{colors.ink}` body text; the brand cobalt reserved for one animated headline word.
- Black-pill primary CTA — 56px tall, `{colors.ink-pill}` (#1a1f23) fill, white text, 6px corner radius. Sits next to a hairline-bordered transparent secondary.
- Three brand cobalt tiers — primary cobalt `{colors.primary}` (#1e61f0) for the animated word, primary-dark `{colors.primary-dark}` (#0052f2) inside the dashboard-mock gradient, primary-navy `{colors.primary-navy}` (#001a4f) as the surface fill of the cobalt advantage tile.
- Six-up "Your unfair advantage" tile band — saturated-fill cards in navy, violet `{colors.accent-violet}`, periwinkle `{colors.accent-periwinkle}`, and ink, each carrying a white heading. The only chromatic band on the page outside the hero mock.
- Embedded dashboard hero — the above-fold area shows a real-looking purple-tinted analytics mock with overlapping panels rather than abstract brand chrome.
- IBM Plex Sans / Gellix across every typographic tier — weight 600 emphasis, weight 400 body, no 800+ display weight.
- Small-step radius scale anchored at `{rounded.sm}` 6px (55 occurrences); the pill at 30px / 9999px carries only the primary CTA and the rotating-tagline highlight chip.
- 4px base spacing unit. The dominant tokens are `{spacing.md}` 12px (48 occurrences) and `{spacing.base}` 16px (42); section vertical padding sits at 48px.

## Colors

### Brand

- **Cobalt** (`{colors.primary}` — #1e61f0): frequency 6. Used as text (2), bg (2), border (2). The single brand voltage — reserved for the animated headline word and for a single accent fill inside the dashboard mock. Wired in CSS without a custom property name; the cobalt is applied inline through Tailwind utility classes.
- **Cobalt Dark** (`{colors.primary-dark}` — #0052f2): frequency 4. Used as background (2), border (1), gradient (1). The end-stop on the dashboard-mock background gradient and on a single hover-state callout.
- **Cobalt Navy** (`{colors.primary-navy}` — #001a4f): frequency 3, all as background. The fill tone of the cobalt advantage tile in the six-up band below the fold.
- **Accent Violet** (`{colors.accent-violet}` — #a273ff): frequency 3, all as background. The fill tone of the violet advantage tile in the six-up band.
- **Accent Periwinkle** (`{colors.accent-periwinkle}` — #6980ff): frequency 1, as background. The fill tone of a smaller secondary tile within the advantage band.

### Surface

- **Canvas** (`{colors.canvas}` — #ffffff): frequency 539. Used as text on dark surfaces (262), border (261), background (16). The page floor — pure white, no cream undertone.
- **Surface-1** (`{colors.surface-1}` — #f2f4f8): frequency 14, all as background. The faint cool-gray surface used inside the "trusted by industry leaders" logo strip and a handful of feature cells.

### Text / Ink

- **Ink** (`{colors.ink}` — #000000): frequency 379. Used as text (166), border (169), background (22), shadow (13), gradient (9). The dominant text and border tone — pure black, deliberately not softened to a charcoal.
- **Ink Pill** (`{colors.ink-pill}` — #1a1f23): the fill of the primary CTA button. Slightly warmer than pure ink, which keeps the button reading as a separate object from black running text.
- **Ink Soft** (`{colors.ink-soft}` — #171717): frequency 110. Used as text (56), border (54). A secondary near-black tone for body emphasis where pure ink would feel too heavy.
- **Ink Muted** (`{colors.ink-muted}` — #373d42): frequency 110. Used as text (55), border (55). The body-running-text alternative for long-form paragraphs.
- **Muted** (`{colors.muted}` — #565656): frequency 922. Used as text (462), border (460). The dominant secondary text and border tone — captions, sub-labels, section dividers.
- **Muted Cool** (`{colors.muted-cool}` — #697077): frequency 31. Used as text (15), border (15), background (1). Tertiary metadata.
- **Muted Warm** (`{colors.muted-warm}` — #868d95): frequency 60. Used as text (30), border (30). The lightest gray in the system for de-emphasized labels.
- **Body Text** (`{colors.body-text}` — #333333): the rendered text color of the body paragraph component. A measured charcoal that sits between ink-muted and pure ink.
- **Cookie Ink** (`{colors.cookie-ink}` — #1f1f1f): the text color of the cookie-preferences h2 modal. Captured because it represents a distinct UI surface tier.

### Hairline

- **Hairline** (`{colors.hairline}` — #d5d9e0): frequency 1, as border. The single rendered hairline tone on the captured page — used on the secondary button outline and on feature-cell dividers. Most other "borders" use one of the ink tones at low opacity.
- **Hairline Strong** (`{colors.hairline-strong}` — #9fa5ad): frequency 5. Used as text (3), border (2). A heavier outline tone for separator strips and form field outlines.

## Typography

### Font Family

The system loads **IBM Plex Sans** (`--font-ibm-plex-sans`) and **IBM Plex Serif** (`--font-ibm-plex-serif`) as the named webfonts but renders **Gellix** as the visible display family across body and headings. The fallback stack walks `Arial, ui-sans-serif, system-ui, sans-serif`, with emoji fallbacks behind that. IBM Plex Serif appears only inside the cookie-preferences modal body copy — the rest of the page is sans throughout.

The dual-loaded stack is the typographic move. Gellix carries the rendered look while Plex Sans is the licensable substitute kept warm in the variable name — feeding the design tokens into a Plex-only project still reads as Amplitude.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 60px | 700 | 70px | -1px | Hero h1 — the rotating-tagline headline |
| `{typography.display-md}` | 44px | 600 | 48px | -1px | Section h3 — "Your unfair advantage" / "Understand what your customers want" |
| `{typography.heading-lg}` | 24px | 600 | 30px | -0.12px | Sub-section titles |
| `{typography.heading-md}` | 22px | 500 | 24px | 0 | h6 / large card titles |
| `{typography.heading-sm}` | 18px | 600 | 28px | 0 | h4 / advantage-tile titles |
| `{typography.body-lg}` | 18px | 400 | 23.4px | 0 | Hero sub-paragraph, section leads |
| `{typography.body-md}` | 16px | 400 | 22px | 0 | Default running text |
| `{typography.body-sm}` | 14px | 400 | 18.9px | 0 | Caption rows, footnote text |
| `{typography.label-md}` | 16px | 600 | 21.6px | -0.04px | Nav labels, card titles |
| `{typography.label-sm}` | 14px | 600 | 18.9px | -0.035px | h4 small titles, feature-cell labels |
| `{typography.button-md}` | 16px | 600 | 24px | 0 | Primary and secondary button labels |
| `{typography.nav-link}` | 18px | 400 | 28px | 0 | Top-nav link labels |
| `{typography.caption}` | 12px | 600 | 16px | 0 | Small-caps badges, stat callouts |
| `{typography.body-serif}` | 14.4px | 400 | 21.6px | 0 | IBM Plex Serif body — cookie modal only |

### Principles

Display weight tops at 700 only on the 60px hero — every other heading sits at weight 600, which is the system's true emphasis tier. The hero h1 with -1px tracking reads loud without going into the 800-900 range a typical fintech or enterprise hero would use. The 600-weight emphasis carries from label tier all the way up to the 44px section displays, anchoring the system on a single weight rather than a ladder.

Body and nav both run weight 400. The nav link at 18px / 400 is notably larger than most marketing systems run their nav (Stripe and Vercel sit at 14px / 500); Amplitude's choice keeps the top band feeling editorial rather than transactional.

### Note on Font Substitutes

Gellix is a licensed display family. **Inter** at the same weights is the closest open-source substitute; the proportions transfer cleanly. **IBM Plex Sans** itself is free under the SIL Open Font License — and since it is already loaded into Amplitude's CSS variables as the named fallback, the licensable substitute is built into the system. For the serif tier, IBM Plex Serif is also OFL and reproduces the cookie-modal body identically.

## Layout

### Spacing System

- **Base unit:** 4px. The dominant gap is `{spacing.md}` 12px (48 captured occurrences) and `{spacing.base}` 16px (42).
- **Tokens:** `{spacing.xxs}` 2px · `{spacing.xs}` 6px · `{spacing.sm}` 8px · `{spacing.md}` 12px · `{spacing.base}` 16px · `{spacing.lg}` 20px · `{spacing.xl}` 24px · `{spacing.2xl}` 32px · `{spacing.3xl}` 48px.
- **Section padding (vertical):** ~48px between major sections; the hero band sits noticeably more generous with ~96px of breathing room above and below the headline.
- **Card internal padding:** `{spacing.xl}` (24px) on `{component.card-hairline}` and `{component.advantage-tile-cobalt}`; `{spacing.xl}` paired with 16px horizontal inset on `{component.card-surface}`.
- **Top-nav padding:** `{spacing.md}` (12px) vertical, `{spacing.xl}` (24px) horizontal.

### Grid & Container

- **Max content width:** ~1392px on the full-bleed sections (the captured primary button reports a 1392px parent width); the hero headline itself constrains to ~756px so the rotating tagline lands without wrapping awkwardly.
- **Hero block:** white canvas, embedded dashboard mock pinned beneath the CTA cluster, all centered.
- **Advantage band:** 6-up tile grid spanning the content width, each tile fixed to roughly the same height with a colored background and a white heading inside.
- **Feature rows below:** alternating 2-column "image + body" splits with the image side carrying a faint purple-tinted surface fill.

### Rhythm

The page alternates between **monochrome editorial** and **saturated tile bands**. Hero and the long-form feature explainers run on pure white with black type. The "unfair advantage" band, the embedded dashboard mock, and the feature-image surfaces are the only chromatic moments. This pacing is the structural device — the cobalt and violet land harder because they are surrounded by white.

## Elevation

The system has essentially **no shadow tier**. The captured page has 13 occurrences of `#000000` used as shadow ink — almost all confined to faint elevations on the embedded dashboard-mock chrome and to subtle drop shadows beneath the advantage tiles. Hairline borders and surface-color contrast do the elevation work that shadows would carry on a typical analytics product.

- **Flat (no shadow):** hero, body bands, feature cells, footer — 99% of surfaces.
- **Dashboard-mock elevation:** the embedded analytics panel sits with a soft 8px black-at-low-opacity shadow that gives the impression of a real product window floating above the page.
- **Advantage-tile shadow:** the six-up colored tiles carry a faint 4px shadow that grounds them on the white canvas without competing with the saturated fills.

## Shapes

The radius scale is **small-step plus pill**:

- `{rounded.none}` 0px — only on the top-nav surface and embedded image edges.
- `{rounded.sm}` 6px — the dominant radius, 55 captured occurrences. Carries the primary button, secondary button, feature cells.
- `{rounded.md}` 8px — 20 occurrences. Larger cards, dropdown menus.
- `{rounded.lg}` 12px — 5 occurrences. Image surrounds, larger feature cells.
- `{rounded.xl}` 16px — 10 occurrences. The cards on the advantage tile band, the hairline-bordered content cards below the fold.
- `{rounded.2xl}` 18px — 4 occurrences. The embedded dashboard-mock chrome.
- `{rounded.pill}` 30px (3 occurrences) / 32px (3) / `{rounded.full}` 9999px (15) — the primary CTA, the rotating-tagline highlight chip, and a small set of dashboard-mock pills.

There is no 4px tight tier. The 6px floor keeps the surface language warmer than a typical dev-tools system; pairing it with the pill on the primary CTA puts the warmest, most-tappable element at the top of the hierarchy.

## Components

**`button-primary`** — The signature CTA. Near-black `{colors.ink-pill}` (#1a1f23) fill, white text, `{rounded.sm}` 6px radius, 16px padding, 56px height, weight 600. The fill is a measured warm-black rather than pure ink — keeps the button reading as a separate object on the white canvas. "Amplitude Solutions →" is the canonical instance.

**`button-secondary`** — Transparent fill, black `{colors.ink}` text, 1px `{colors.hairline}` border, `{rounded.sm}` 6px radius, 7×16px padding, 40px height. Used for "Request demo" and other tertiary actions.

**`button-cobalt`** — `{colors.primary}` fill, white text, 6px radius, 10×12px padding. Reserved for in-product callouts and dashboard-mock action buttons — never the hero primary.

**`top-nav`** — White `{colors.canvas}` surface, 64px height, 12×24px padding. Above it floats a black announcement bar carrying promotional text. Houses the Amplitude wordmark flush left, product / solutions / customers / developers / pricing links center, and a Log in / Get started cluster flush right.

**`nav-link`** — Black `{colors.ink}` text in `{typography.nav-link}` (18px / 400). Notably larger than most marketing nav systems run.

**`hero-heading`** — Pure black `{colors.ink}` text on the white canvas, `{typography.display-xl}` (60px / 700) with -1px tracking. Holds the static portion of the sentence.

**`hero-tagline-highlight`** — Cobalt `{colors.primary}` text at the same `{typography.display-xl}` size — the rotating verb portion of the headline. Wrapped in a span that animates through four tagline values: "faster answers," "testing everything," "non-stop optimizations."

**`section-heading`** — Black `{colors.ink}` text at `{typography.display-md}` (44px / 600). Used for "Your unfair advantage," "Understand what your customers want," and the lower feature-band headings.

**`body-paragraph`** — Default body text in `{colors.body-text}` (#333333) at `{typography.body-md}` (16px / 400). The measured charcoal sits between ink-muted and pure ink — readable but never harsh.

**`body-paragraph-muted`** — `{colors.muted}` variant for secondary copy.

**`card-hairline`** — White `{colors.canvas}` surface, 1px `{colors.hairline}` border, `{rounded.xl}` 16px radius, 24px internal padding. The default content card below the fold.

**`card-surface`** — `{colors.surface-1}` (#f2f4f8) fill, `{rounded.xl}` 16px radius, 24×16px padding. The faint cool-gray card used inside the logo strip.

**`advantage-tile-cobalt`** — `{colors.primary-navy}` (#001a4f) fill, white text, `{rounded.xl}` 16px radius, 24px padding, `{typography.heading-sm}`. The cobalt tile in the six-up "unfair advantage" band.

**`advantage-tile-violet`** — `{colors.accent-violet}` (#a273ff) fill, black text, `{rounded.xl}` 16px radius, 24px padding. The violet sibling to the cobalt advantage tile. Three additional tiles use periwinkle, deep cobalt, and ink as fills.

**`text-input`** — White `{colors.canvas}` surface, black text, 1px `{colors.hairline}` border, `{rounded.sm}` 6px radius, 10×12px padding, 40px height. No glow, no ring on focus — just a hairline thickness shift.

**`stat-callout`** — Transparent, black text at `{typography.display-md}` (44px / 600). The big-number stats inside the logo / industry-leader strip ("19K," "171%," "6 months," "217%").

## Do's and Don'ts

**Do** reserve `{colors.primary}` (#1e61f0) for one animated headline word. The brand cobalt's entire job on this page is to highlight a rotating verb inside an otherwise black sentence — multiplying it into multiple cobalt elements dilutes the only chromatic brand signal above the fold.

**Do** fill the primary CTA with `{colors.ink-pill}` (#1a1f23), not the brand cobalt. The deliberate split — brand color in the headline, near-black in the button — keeps both moments legible. Switching the CTA to cobalt and the headline to black would collapse them into the same voice.

**Do** use the embedded dashboard mock to do the chromatic anchoring the hero refuses to do. Removing the mock and leaving the hero as pure typography would leave the page feeling under-pigmented.

**Do** keep display weight at 700 only on the 60px hero. Every other heading drops to weight 600, which is the system's true emphasis tier. Pushing section displays to 700 turns the editorial dek into a generic SaaS shout.

**Don't** introduce a 4px tight radius tier. The system starts at `{rounded.sm}` 6px (55 occurrences) and never goes tighter. Adding a 4px corner would feel borrowed from a Vercel/Linear dev-tools system rather than from Amplitude's softer surface language.

**Don't** render the body paragraph in pure `{colors.ink}` (#000000). The body component sits at `{colors.body-text}` (#333333), a measured charcoal — pure ink is reserved for the hero heading, top-nav links, and high-emphasis labels.

**Don't** color the advantage-tile band in a single brand cobalt. The six-up band gets its rhythm from rotating across `{colors.primary-navy}`, `{colors.accent-violet}`, `{colors.accent-periwinkle}`, and ink. Flattening it to one color removes the visual labor the band does for the page.

**Don't** swap `{colors.canvas}` (pure #ffffff) for a cream undertone. The system is explicitly pure-white — Cloudflare runs cream because of its orange canvas; Amplitude has nothing to warm against, so the page stays bright.

## Known Gaps

- **Dark mode:** the captured marketing surfaces are light-only. A dark variant likely exists inside the product dashboard but is not represented here.
- **Hover and focus states:** the system declares the resting state for `{component.button-primary}` and `{component.button-secondary}`; hover / focus / disabled tints were not exposed on the captured surface.
- **Form input error states:** `{component.text-input}` carries only the resting state; validation styling lives inside the product surfaces.
- **Motion:** the hero headline rotates through four tagline values via a JavaScript text-cycle animation, but timing curves, dwell duration, and the cross-fade easing are not captured here.
- **Product surfaces:** this DESIGN.md captures the marketing site only. The Amplitude Dashboard, Experiment, and Session Replay product surfaces carry their own token systems and chart palettes that are not represented.
- **Chart palette:** the embedded dashboard mock shows multi-color chart series (purple, cyan, magenta gradients) but those are decorative mock-data rather than a documented chart-color scale.
- **Six-up advantage band fills:** the band uses at least four distinct colored tiles; only `{colors.primary-navy}`, `{colors.accent-violet}`, and `{colors.accent-periwinkle}` are extracted as primary tokens — the remaining ink / charcoal tile is captured under `{colors.ink}`.
