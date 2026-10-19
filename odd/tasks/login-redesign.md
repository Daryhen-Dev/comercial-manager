# Login redesign: luminous closing frame

## Goal

Replace the plain shadcn card on the sign-in screen with the product's first real
visual surface: a dark door with a single light that travels its frame and closes
into a circumference when the door opens. Record the mobile-first premise in the
project while doing it.

## Context discovered during exploration

- No `PRODUCT.md` or `DESIGN.md` existed. `impeccable context` reported
  `NO_PRODUCT_MD` with an incumbent visual implementation and required init
  before a surface redesign.
- Product truth confirmed with the user: platform is **web** (not a native app),
  desktop remains a real second case, and the primary user is an administrator
  **standing on-site at a branch**, one hand on a phone, poor signal, daylight on
  the screen.
- The user pinned the visual idea and delegated colour: a border that illuminates,
  runs from one colour into another, and ends as a circumference.
- The surface is **Operate** mode, which is code-led by contract: no comp round,
  no plate generation, no image assets.
- No browser is available in this harness, so no screenshot round could run.

## Decisions

- **Direction is brief-pinned**, so the `concept-seed` roll does not govern it.
  The surface brief records `seed: none (unavailable)` with the reason.
- **Dark door, light workspace.** The login is dark because the pinned effect
  needs a ground to read on; the workspace inside stays light because the work
  there is reading tables in daylight. Recorded in `DESIGN.md` as a split, with
  the workspace side still unbuilt.
- **Gradient family is ember `#FF8A3D` → jade `#2BD9A6`.** Chosen over the
  default violet/cyan AI cluster to belong to the subject (grain and plant green)
  and to keep one warm-to-cool axis. Ember doubles as the error signal so there
  is no third colour.
- **Controls are rebuilt in the world, not reused from `components/ui`.** The
  craft floor treats a stock component inside a committed form as a lapse, so
  the screen has its own CSS module and leaves `components/ui` untouched.
- **The ring is a masked `conic-gradient` with two registered custom properties**,
  `--beam` (rotation) and `--arc` (arc length), instead of an animated blurred
  duplicate. The glow is `box-shadow`, because a blurred ring costs a repaint per
  frame on the phones this is built for.
- **The closing is the surface's one authored moment.** On success the frame goes
  to `granted`, the ring completes `360deg`, and navigation waits 280ms so the
  moment is actually seen. If auth fails, the ring returns to rest.

## Direction contract

THESIS: A single luminous arc orbits the credential frame, running from ember to
jade, and it closes into a full circumference at the moment of submission. The
category default this refuses is the floating white card on a grey ground.

OWN-WORLD: Near-black cool ground, one warm-to-cool gradient family, a single
hairline frame, no glass, no second accent, no illustration. Controls are 1px
rules with square-ish corners.

STORY: The visitor recognises the administrators' door of the system they already
work in, types two fields, and watches the frame close before the workspace opens.

FIRST VIEWPORT: On a phone the frame is the viewport minus safe-area padding; the
wordmark sits at the top on one line, the two fields stack, and the full-width
submit is last, within thumb reach. On desktop the frame caps at 26rem and
centres.

FORM: Brief-pinned; `seed: none (unavailable)`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Tasks

- [x] Capture product truth in `PRODUCT.md` (mobile-first, platform, users).
- [x] Record the surface brief with its direction contract.
- [x] Build the screen: frame, ring, fields, submit, alert, footer.
- [x] Verify contrast numerically against the built palette.
- [x] Run the mechanical detector.
- [x] Write `DESIGN.md` with the built tokens.
- [ ] Browser capture and finish review — blocked, no browser in this harness.

## Evidence

- `npx tsc --noEmit` → exit 0.
- `next build` → green; `/login` served as `ƒ` (dynamic).
- Compiled CSS inspected: `@property --beam` and `@property --arc` survive intact,
  the `conic-gradient(from var(--beam), …)` rule is whole, and
  `mask-composite: exclude` with `mask-clip: content-box, border-box` is emitted.
  `min-height: 100dvh` and `safe-area-inset-bottom` are present.
- Detector: `impeccable detect --json` on the three changed files returned `[]`.
- Contrast measured on the shipped palette, every pair above 4.5:1: ink 18.01,
  ink-soft 9.25, placeholder 5.31, footer 5.67, alert title 13.49, alert hint
  8.35, field error 11.79, button ink on jade 10.59 and on ember 8.19.
- Structural HTTP check: `/login` returns 200 and serves the wordmark, subtitle,
  both labelled fields, the submit and the frame's `data-state`.

## Open items

- **No screenshot round ran.** There is no browser in this harness, so the finish
  review was substituted with an in-thread pass against the craft floor and the
  direction contract. The visual judgement the skill requires is unavailable; the
  user is the only one who can make it.
- **No `impeccable-finish-reviewer` or `impeccable-documenter` agent exists in
  this runtime**, so both were substituted in-thread. Disclosed rather than
  silently skipped.
- `.impeccable/design.json` was not written, and would not be versioned anyway:
  the project ignores every dot-directory by the user's own policy.
- The `(main)` workspace is still on shadcn light tokens and has not been
  designed. The door/workspace split is decided; the workspace half is not built.
- The branch name is deliberately not shown on the login screen. It would
  duplicate `ID_LOCAL_IMPLICITO` or force a database read on a page that
  otherwise needs none. The recovery hint in the error copy covers the confusion
  instead ("si tu usuario pertenece a otra sucursal, no puede ingresar acá").
