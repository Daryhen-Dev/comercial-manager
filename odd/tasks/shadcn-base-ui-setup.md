# shadcn/ui setup with Base UI primitives

## Goal

Initialize shadcn/ui on the existing Next.js 16 project using the current CLI
(4.22.0) and Base UI primitives (the upstream default since July 2026), instead
of the older Radix-based setup most tutorials still describe.

## Context discovered during exploration

- Repo has **zero commits**. `git log` fails, so nothing is recoverable from
  history. Files were backed up to `/tmp/shadcn-backup/` before any write.
- `next` 16.4.2, `react` 19.3.0, TypeScript 5, `pnpm@10.34.5`.
- Tailwind v4 wired **non-standard**: `@tailwindcss/turbopack` loader (4.3.3)
  declared in `next.config.ts` `turbopack.rules`, with **no**
  `postcss.config.mjs`. The Next 16 docs still describe the
  `@tailwindcss/postcss` route, so doc-based assumptions may not hold.
- `next.config.ts` also enables `experimental.agentFeedback`, `cacheComponents`
  and `partialPrefetching`.
- `app/layout.tsx` uses Next 16 typed props: `LayoutProps<"/">`.
- `tsconfig.json` already maps `@/*` to `./*`.
- Global stylesheet is `app/globals.css` (already `@import "tailwindcss"`).
- No `components.json`, no `components/ui/`, shadcn not installed.

## Decisions

- Base primitives: **Base UI** (`base`), package `@base-ui/react` (1.9.0).
  Not `@base-ui-components/react` (frozen at `1.0.0-rc.0`, old name), and not
  `radix-ui` (1.8.1).
- Expected style token in `components.json`: `base-nova`.
- All init flags passed explicitly so the command is deterministic and does not
  hang on an interactive prompt in a non-TTY shell.

## Tasks

- [x] Back up files `init` may touch (`globals.css`, `layout.tsx`,
      `tsconfig.json`, `package.json`).
- [x] Run `init -b base -p nova`.
- [x] Verify `components.json`: `style: base-nova`, empty
      `tailwind.config` (v4), aliases intact.
- [x] Add a component and confirm its imports resolve to `@base-ui/react`.
- [x] Typecheck and build.

## Evidence

Init flags that actually matter on CLI 4.22.0:

```bash
pnpm dlx shadcn@latest init -b base -p nova \
  --css-variables --no-rtl --pointer --no-monorepo -y
```

Notes on the flags:

- `-p base-nova` is **rejected**. The preset id is bare (`nova`); the base is
  carried by `-b`. `--defaults` resolves to `--preset=base-nova` internally,
  which is why the docs/help text shows the prefixed form.
- Without `-p`, the command stops on an interactive preset picker and writes
  nothing.

Preflight output: `Found Next.js`, `Validating Tailwind CSS. Found v4`,
`Validating import alias` — all passed with the non-standard
`@tailwindcss/turbopack` loader setup.

Generated state:

- `components.json`: `style: base-nova`, `tailwind.config: ""`,
  `baseColor: neutral`, `iconLibrary: lucide`, `rsc: true`,
  `menuColor: default`, `menuAccent: subtle`.
- Dependencies added: `@base-ui/react@^1.9.0`, `class-variance-authority`,
  `cn@^0.5.0`, `lucide-react@^1.59.0`, `shadcn@^4.22.0`, `tw-animate-css`.
  `shadcn` lands in `dependencies` (not dev) because `globals.css` imports
  `shadcn/tailwind.css` at runtime.
- `lib/utils.ts` is now `export { cn } from "cn"` — generated components import
  `cn` from the `cn` package directly, not from `@/lib/utils`.
- `components/ui/dialog.tsx` imports `@base-ui/react/dialog`;
  `button.tsx` imports `@base-ui/react/button`. No `radix` string anywhere in
  `components/`, `components.json` or `package.json`.

Build passed twice: once right after `init`, once after adding
`button` + `dialog` (`next build`, Turbopack, TypeScript clean).

## Defect found and fixed

`init` printed "Updating fonts" but left `app/layout.tsx` untouched, and wrote a
self-referential token into `globals.css`:

```css
@theme inline {
  --font-sans: var(--font-sans);
  --font-heading: var(--font-sans);
}
```

The compiled CSS confirmed it: `--font-sans:var(--font-sans)` and
`.font-sans{font-family:var(--font-sans)}`. A custom property that references
itself is invalid at computed-value time, so `body { @apply font-sans }` fell
back to the browser default instead of Geist.

Root cause: `next/font` in `layout.tsx` exposes `--font-geist-sans`, but the
Nova preset expects the theme to define `--font-sans` itself.

Fix applied:

```css
--font-sans: var(--font-geist-sans);
--font-heading: var(--font-geist-sans);
--font-mono: var(--font-geist-mono);
```

Re-verified in build output: `--font-sans:var(--font-geist-sans)` and
`.font-sans{font-family:var(--font-geist-sans)}`.

## Open items

- Repository still has **zero commits**. Everything (including this setup) is
  untracked, so there is no history to recover from. Backups live in
  `/tmp/shadcn-backup/`.
- `--pointer` was chosen explicitly (buttons get a pointer cursor). Reversible
  via `components.json` or `shadcn apply`.
