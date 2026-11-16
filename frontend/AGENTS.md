<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Frontend engineering rules

These rules supplement "Frontend conventions" in the repository `AGENTS.md`. They apply to new and touched code;
existing code is brought in line when its feature is reworked, not in bulk.

## Data layer

- One `*-api.ts` per feature declares every endpoint of that feature. A component never contains a URL.
- No app calls `fetch` outside its API client: `@/lib/api` in Admin. The Wiki and Stream have no shared client yet;
  the change that reworks their data layer adds one under `src/lib/` and moves every call behind it.
- One `xKeys` object per feature builds every query key (`heroKeys.detail(id)`). No inline key arrays; reads and
  invalidation use the same object.
- Writes go through `useMutation`. An error is shown once: by the global toast, or inline when the mutation sets
  `meta: { silent: true }`.
- Response types come from the generated OpenAPI file where one exists (`pnpm generate:hero-api` writes
  `apps/admin-aov/src/features/publishing/generated/hero-api.d.ts`). Do not redeclare them by hand.

## Structure

- A feature folder with more than about 25 files is split into `pages/`, `components/`, `model/` (no React, no DOM)
  and `api/`. File names say the role: `*-page.tsx`, `*-model.ts`, `*-api.ts`, `use-*.ts`.
- A component stays under about 300 lines and one screen. Split by responsibility before adding to a larger one.
- Code used by two apps lives in `packages/ui`; code used by two features lives in `src/components` or `src/lib`.
  Do not leave a re-export file behind after moving code.
- When a screen or component is replaced, delete the old files, their tests, their CSS and the paragraphs of the docs
  that describe them in the same change.
- Never branch on display text. Values are codes (`"OWN" | "CAPTURED"`); labels live in a lookup table.

## Stylesheets

- A layout switch is written exactly as `@media (max-width: 899.98px)` (compact) or `@media (min-width: 900px)`
  (wide), the same boundary as `usePageLayout`. Other widths only adjust proportions inside one layout.
- One stylesheet per component, imported by that component. A sheet never restyles a class owned by another sheet,
  and a rule is changed where it is declared, not by appending a second declaration.
- Class names carry the app or feature prefix (`wiki-`, `hub-`, `cp-`, `esp-`).
- Font weights are 400, 500, 600 or 700, in CSS and in Tailwind classes: the only ones the font files provide.
