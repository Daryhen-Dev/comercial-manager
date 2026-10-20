# Design

<!-- impeccable:design-schema 1 -->

Scope: documents the **sign-in surface** (`/login`) and the dark workspace tokens
that drive `(main)` and every module inside it.

## World

**One dark world, entered through a door made of light.**

The product's first surface is the threshold of an administrative system used by
people standing in a plant, holding a phone in one hand. The whole application is
dark by decision: the user rejected the light mode and kept this palette, so the
door and the workspace share one ground. The door carries a single travelling
light so the threshold reads as a threshold.

One idea owns this surface: **a luminous arc travels the frame and closes into a
circumference at the moment the door opens.** There is no second effect.

## Colour

A single warm-to-cool gradient family, on a cool near-black ground. No second
accent, no glass, no illustration.

| Token | Value | Role |
| --- | --- | --- |
| `--ground` | `#07090c` | page base |
| radial 1 | `#101821` at 0% → transparent 62% | cool lift behind the frame |
| radial 2 | `rgb(43 217 166 / 0.08)` at 110% | jade breath from below |
| `--ink` | `#f2f5f7` | primary text |
| `--ink-soft` | `#a8b3bd` | secondary text, labels, hints |
| muted | `#7f8b96` | placeholders, footer |
| `--rule` | `rgb(255 255 255 / 0.13)` | hairline borders |
| `--from` | `#ff8a3d` | ember — start of the gradient |
| `--to` | `#2bd9a6` | jade — end of the gradient, focus, success |
| inner ground | `#0c1116 → #080b0f` | the frame's interior, a soft vertical fall |
| field ground | `rgb(255 255 255 / 0.035)` | ~`#111417` over the inner ground |
| alert ground | `rgb(255 138 61 / 0.09)` + inset `rgb(255 138 61 / 0.32)` | error surface, ember reused as signal |
| alert title | `#ffd9bd` | error heading |
| field error | `#ffb98a` | validation message |

Ember does double duty: it opens the gradient and it is the error signal. That is
intentional — one family, two jobs, no third colour.

## Type

Face: **Geist**, already self-hosted through `next/font` in `app/layout.tsx`.
No external font stylesheet, no second face.

| Role | Size | Weight | Tracking |
| --- | --- | --- | --- |
| Wordmark (`h1`) | 1.375rem → 1.5rem at ≥40rem | 600 | -0.03em |
| Subtitle | 0.875rem | 400 | normal |
| Label | 0.8125rem | 500 | 0.01em |
| Input text | 1rem (never less: iOS zooms below 16px) | 400 | normal |
| Submit | 1rem | 600 | -0.01em |
| Field error | 0.8125rem | 400 | normal |
| Footer | 0.75rem | 400 | normal, tabular numerals |

No gradient text. Emphasis comes from weight and size only.

## Space and shape

- Page padding respects `env(safe-area-inset-*)`.
- Frame: full width, `max-width: 26rem`, radius `1.375rem`; interior radius
  `1.3125rem` (one pixel smaller, so the ring and the interior share an edge).
- Interior padding: `1.75rem 1.375rem 1.5rem`; `2rem 1.75rem 1.75rem` at ≥40rem.
- Vertical rhythm inside the form: `1.25rem` between fields.
- Controls are a full `3.25rem` tall, above the 44px touch floor.
- Controls use a 1px hairline border and `0.625rem` radius: squarer than the
  frame, so hierarchy reads as frame > control.

## The ring

`.frame::before` is a 1px ring painted by a `conic-gradient` masked to the
padding box (`mask-composite: exclude`, `mask-clip: content-box, border-box`).

- Two registered custom properties carry the state: `--beam` (rotation) and
  `--arc` (how much of the circumference the light occupies).
- At rest the arc spans `118deg` and orbits once every 9s.
- `:focus-within` grows the arc to `196deg` — the light answers the hand.
- Submitting closes it to `360deg` and speeds the orbit to 2.4s.
- Granted keeps `360deg`, slows to 6s, and the ambient glow turns jade.
- The ambient glow is `box-shadow` only (two offset-free colour casts at low
  alpha plus one real drop shadow), because a blurred duplicate of the ring costs
  a repaint per frame on the phones this is built for.

## Motion

One authored moment: **the ring closes before the door opens.** On a successful
`signIn` the frame goes to `granted`, the ring completes, and the app waits 280ms
before navigating. The delay is the design, not an accident.

Easing: `cubic-bezier(0.16, 1, 0.3, 1)` — exponential ease-out. Durations:
`620ms` for the arc, `420ms` for the glow, `180ms` for control states, `120ms`
for press.

`prefers-reduced-motion: reduce` stops the orbit entirely, pins the arc at
`200deg`, still closes to `360deg` on state change, and removes transitions.

## Browser surfaces

The parts nobody draws still carry the world: `::selection` is jade at 28%,
`caret-color` is jade, `accent-color` is jade, `scrollbar-color` is a white 22%
thumb on transparent, focus is a 3px jade ring on fields and a 2px ink outline
with 3px offset on the button.

## Accessibility floors, measured

WCAG 2.1 contrast on the built palette:

| Pair | Ratio |
| --- | --- |
| `--ink` on inner ground | 18.01 |
| `--ink-soft` on inner ground | 9.25 |
| placeholder on field ground | 5.31 |
| footer on inner ground | 5.67 |
| alert title on alert surface | 13.49 |
| alert hint on alert surface | 8.35 |
| field error on inner ground | 11.79 |
| button ink on jade | 10.59 |
| button ink on ember | 8.19 |

Every pair clears 4.5:1. Errors are announced with `role="alert"`, fields carry
`aria-invalid` and `aria-describedby`, and every control is labelled.

## Open items

- The `(main)` workspace ships a token system and a single placeholder page; the
  real modules are not built.
- **No browser capture was possible in this harness**, so the surface has been
  verified by build, compiled CSS inspection, structural HTTP checks and
  computed contrast — not by screenshot.

---

# Workspace (dark)

The product is **dark only**. There is no light mode and no theme toggle: the
user asked for a dark application and preferred the existing palette, so the same
jade/ember family runs through both grounds.

| | Ground | Why |
| --- | --- | --- |
| The door (`/login`) | near-black, self-contained | one light has to read on it |
| The workspace (`(main)`) | near-black, jade-tinted | a single visual world, no mode switching |

The sign-in surface carries its own tokens in `login.module.css`. The workspace
tokens live in `app/globals.css`, on the `:root, .dark` selector: `:root` keeps
the first paint dark before the class applies, and `html.dark` switches the
`dark:` utilities on. `app/layout.tsx` mounts `class="dark"` on `<html>`.

## Why the default theme felt flat

Two measured facts about the stock shadcn palette, both fixed here:

1. **Every neutral had chroma `0`** — literally grey, no temperature. There is no
   tonality to perceive when there is no colour.
2. **Only two text tones existed**: `--foreground` and `--muted-foreground`. The
   other `*-foreground` tokens are the colour of text sitting ON a filled
   surface, not hierarchy levels. A title, a paragraph, a label and a caption all
   collapsed into one colour.

## Colour ramp

Neutrals share one hue at very low chroma — `165`, the jade family. Ratios
measured against `--background`.

| Token | OKLCH | Hex | Ratio | Role |
| --- | --- | --- | --- | --- |
| `--background` | `0.16 0.008 165` | `#0a0e0c` | — | page |
| `--card` | `0.205 0.01 165` | `#131916` | — | raised surface |
| `--muted` | `0.245 0.01 165` | `#1c221f` | — | inset surface |
| `--accent` | `0.275 0.014 165` | — | — | hover surface |
| `--fg-strong` | `0.98 0.004 165` | `#f6f9f8` | 18.32 | display, h1, h2 |
| `--foreground` | `0.93 0.006 165` | `#e4e9e7` | 15.81 | body, h3 |
| `--fg-soft` | `0.75 0.008 165` | `#a9b0ad` | 8.74 | labels, supporting copy |
| `--fg-faint` | `0.665 0.01 165` | `#8e9692` | 6.38 | metadata, placeholders, captions |
| `--primary` | `0.74 0.13 165` | `#47c496` | 8.90 | jade accent; ink on it = 8.75 |
| `--destructive` | `0.68 0.17 27` | `#ef675c` | 6.24 | warm red, same family as ember |
| `--border` | `0.32 0.01 165` | `#2e3531` | 1.53 | decorative hairline only |
| `--input` | `0.52 0.012 165` | `#636b67` | 3.54 | control boundary (WCAG 1.4.11) |

`--muted-foreground` is aliased to `--fg-soft` so components generated by
`shadcn add` keep working while gaining the extra levels.

Two deliberate separations: `--border` is for decoration and stays low contrast;
`--input` is the boundary of a control and clears 3:1. Using one token for both
is how input fields end up invisible.

## Type scale

Defined in `@theme` with `--text-<name>--line-height`, `--font-weight` and
`--letter-spacing`, so **size, leading, tracking and weight ship together**. A
heading cannot be merely "body but bigger".

| Utility | Size | Line height | Weight | Tracking | Tone |
| --- | --- | --- | --- | --- | --- |
| `text-display` | 2.25rem | 1.1 | 600 | -0.03em | `fg-strong` |
| `text-h1` | 1.75rem | 1.15 | 600 | -0.025em | `fg-strong` |
| `text-h2` | 1.25rem | 1.25 | 600 | -0.02em | `fg-strong` |
| `text-h3` | 1rem | 1.35 | 600 | -0.01em | `foreground` |
| `text-body` | 1rem | 1.5 | 400 | normal | `foreground` |
| `text-label` | 0.8125rem | 1.35 | 500 | 0.01em | `fg-soft` |
| `text-caption` | 0.75rem | 1.4 | 400 | 0.01em | `fg-faint` |

Rule: **tone and type move together.** An `h2` is heavier, lighter and tighter,
not "the same text at a larger size". Colour is one third of the hierarchy, not
all of it.

## Mobile-first rules for controls

- Filters stack: label above the field, and the field and the selector go
  full-width on a phone, becoming one row only from `sm` up. A three-in-a-row
  filter leaves the text input narrower than a client name.
- Inputs and select triggers are `h-11` (44px) tall, the minimum comfortable
  touch target for a standing, one-handed user.
- The mobile shell uses a 3rem bar, so page content can rely on a known header
  height instead of negative-margin tricks.
