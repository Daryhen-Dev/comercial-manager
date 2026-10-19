<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project premise: mobile-first

**This product is designed for a phone first.** Every surface starts at a 390px
portrait viewport and adapts upward; a desktop layout is a consequence of the
phone design, never the starting point. The primary user is an administrator
standing on-site at a branch, one hand on the phone, poor signal, daylight on the
screen.

Before designing or building any UI, read `PRODUCT.md` (product truth) and
`DESIGN.md` (visual system and tokens). They are the authority; this line is only
the pointer.
