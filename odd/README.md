# Organic Driven Development in this repo

This directory is the durable record of ODD work. Read this before starting a
feature; update it while you work, not after.

## Why it exists

An interrupted feature must be resumable by someone who has none of the
original conversation. A chat transcript is not a recovery artifact. The task
file is.

## When a task file is required

Create one when either is true:

- exploration turns up two or more meaningful implementation steps, or
- losing the current context would cost real rework.

Small, fully understood changes stay small: no task file, no ceremony. A typo
fix does not need a design record.

## Task file convention

Path: `odd/tasks/<feature-name>.md`, kebab-case, named for the feature rather
than the ticket.

Required sections:

| Section | Contents |
| --- | --- |
| Goal | One paragraph. What changes for the user when this lands. |
| Context discovered during exploration | Facts that were expensive to learn, with file paths. |
| Decisions | Each decision, the alternative rejected, and why. |
| Tasks | Checkbox list. Check off only after the outcome was observed. |
| Evidence | Commands run, commit SHAs, build and test output. |
| Open items | Known gaps, deferred work, risks that outlive this feature. |

## Work units

- One feature per branch. Branch off `main` before the first write; never
  accumulate work directly on the default branch.
- One commit per reviewable work unit, Conventional Commit message, tests and
  docs alongside the behavior they describe.
- Record the commit SHA in the task file's Evidence section. A task is not
  closed until its evidence points at a commit.
- Push, pull request and merge stay a human decision.

## Definition of done

A task closes when all of these hold:

1. The behavior was observed working, not assumed.
2. Typecheck and production build pass.
3. The work-unit commit exists and is referenced in Evidence.
4. Every skipped or failing check is written down. Silence is not a pass.

## Existing records

- `shadcn-base-ui-setup.md` — shadcn/ui on Base UI primitives, Nova preset,
  including a self-referential `--font-sans` token that `init` wrote and the
  fix that restored Geist.
