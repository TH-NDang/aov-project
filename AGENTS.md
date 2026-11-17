# AGENTS.md — aov-project

Instructions for AI coding agents (and humans) working in this repository.

## Language

| What | Language |
|---|---|
| Code comments, Javadoc/TSDoc, `TODO`/`FIXME` | **English only** |
| Identifiers (classes, methods, variables, DB tables/columns) | English |
| Log messages, exception messages, API error `detail` | English |
| Commit messages, branch names, PR titles | English |
| Documentation in `backend/docs/`, `frontend/docs/`, `README.md` files | Vietnamese — do **not** translate |
| User-facing UI text and game data (hero names, skill descriptions…) | Whatever the product requires (usually Vietnamese) |

The pre-commit hook rejects Vietnamese text in comments of newly added lines (see "Git hooks").

Vietnamese shown to users, in the UI and in warehouse content (items, arcana, enchantments, spells, glossary, patch
notes), follows `frontend/docs/QUY-UOC-VIET.md`: one word for one idea, the label-first format of item effects
(`Kích hoạt – Tên: mô tả. Hồi chiêu: 60 giây.`), numbers and units, capitals and punctuation. Text copied word for word
from the game (hero skill descriptions, the Cờ Liên Quân guide) stays as the game writes it.

## Project map

```text
aov-project/
├── backend/
│   ├── docs/           Specs (Vietnamese): 01 project, 02 database, 03 API, adr/
│   ├── wiki-service/   Spring Boot 4.1.1, Java 21, Maven Wrapper — AOV Wiki backend
│   └── community-service/ Java 21, Maven Wrapper — manual tournament backend; separate DB/API
├── frontend/           pnpm + Turborepo: apps/aov-wiki, apps/aov-stream, apps/admin-aov, packages/ui
├── infra/              Production-like Docker Compose: reverse proxy, realm template, backup scripts (guide: infra/README.md)
├── research/           Importers and checks for collected data (Python, Node), with unit tests
└── resources/          Local copies only, git-ignored (ADR-030); resources/README.md says where the data lives.
```

## Source of truth

- Backend behavior is specified by `backend/docs/01-BAN-DAC-TA-DU-AN.md`, `02-DATABASE-DU-AN.md`, `03-API-DU-AN.md`.
- Backend layout and engineering boundaries are described in `backend/AGENTS.md` and ADR-013; business/API/data contracts remain in 01/02/03.
- If `NOTE-SPRING-BOOT-4.md` conflicts with 01/02/03, follow 01/02/03.
- Architecture decisions live in `backend/docs/adr/`. Read them before changing what they cover.
- When code and spec disagree, stop and ask instead of silently picking one.

## Backend conventions (both services)

The rules below apply to `backend/wiki-service` and `backend/community-service`; `backend/AGENTS.md` adds the
engineering details. A rule that names one service applies to that service only. A difference that is deliberate is
listed here; anything not listed follows the common rule.

- Each service is one deployable, a modular monolith (Spring Modulith). wiki-service: root package `com.wikiaov`,
  modules `hero`, `media`, `patch`, `item`, `arcana`, `spell`, `enchantment`, `gamemode`, `query`, `access`,
  `platform`, `user`, `terminology`, `video`, `build`. community-service: root package `com.wikiaov.community`,
  modules `community`, `currency`, `platform`, `tournament`.
- Each module exposes public contracts at its package root. Large modules group implementation by function first:
  `internal/<capability>/{application,domain,persistence/entity,infrastructure}`. Examples: Hero `skills`, `skins`,
  `importing`; Patch `season`, `ruleset`, `release`; Media `asset`, `upload`, `storage`.
  Do not create every layer for every capability. Small cohesive modules may retain their existing layered layout.
- Module-level `internal/web`, HTTP commands/response DTOs in `internal/application`, and serialized content records
  in `internal/domain` may remain deliberately stable to preserve API/OpenAPI/JSON contracts. Do not treat these
  compatibility locations as a general shared bucket. See `backend/AGENTS.md` and ADR-013 for ownership details.
- Application facades own authorization and transactions and delegate coherent work to capabilities. Use focused Spring
  Data repositories, typed projections, `@Query`, `@Lock` and Specifications for ordinary persistence. Keep dynamic
  Criteria fragments or database-specific lock adapters narrowly scoped; do not hide generic SQL/arbitrary-entity APIs
  behind a store or collect every module repository in one facade.
- Never use another module's entity, repository or `internal` package. Call its public contract.
- IDs are `UUID`; human-readable identifiers are `code` slugs.
- API paths: controllers map paths under `ApiPaths.ROOT + "/..."` (or `ApiPaths.ADMIN`) and declare `version = "1"`
  on each method mapping. Spring MVC native API versioning reads the version from `/api/wiki/{apiVersion}`
  (`/api/community/{apiVersion}` in community-service). Never hard-code `/api/wiki/v1` in mappings.
- Errors: throw `ApiException` with a module-owned enum implementing `ApiErrorCode` (placed in `internal/application`),
  e.g. `HeroErrorCode.HERO_NOT_FOUND`. Never build error `ResponseEntity`s by hand. Codes must be unique across modules.
- Query strings of public endpoints are whitelisted with `QueryParameters.requireOnly`; pages are returned as `PageSlice`.
- Shared HTTP contracts have one shape in both services: `ApiPaths`, `ApiException` with a module-owned `ApiErrorCode`
  enum, `PageSlice`, `QueryParameters.requireOnly`, RFC 9457 problem details with a request id, and
  `fail-on-unknown-properties: true` for request bodies. Each lives once in the service's `platform` module; do not
  re-implement them per module. community-service still keeps per-module page types and query checks (move them to
  its `platform` when those modules are reworked) and still accepts unknown properties.
- An exception handler never maps `IllegalArgumentException` or another unexpected exception to a 4xx answer.
  Unexpected errors are logged and answered with 500.
- Both services run `ModuleArchitectureTests` and `LayerArchitectureTests`. community-service has only its module test
  (`ModuleArchitectureTest`) so far.
- Deliberate difference: community-service may use native PostgreSQL queries for reads over its `jsonb` documents
  (ADR-015).
- Schema changes only through Flyway migrations in `src/main/resources/db/migration`. Never edit an applied migration. JPA `ddl-auto` stays `validate`.
- Object storage only through the `ObjectStorage` port and `S3ObjectStorage` (AWS SDK for Java 2.x). No MinIO SDK.
- Media bytes never pass through the backend: presigned upload to `incoming/`, then `complete` validates and copies to
  the immutable `assets/` key. Other modules read assets via `MediaAssets` and report their references by implementing
  `MediaUsageProvider`; they never touch media tables.
- Lombok + MapStruct are allowed. Avoid `@Data` on JPA entities.
- Do not hold a DB transaction open during object storage or external HTTP calls.
- Formatting is owned by Spotless with `config/format/eclipse-formatter.xml` (4 spaces, 120 columns, comments untouched).
  Leave one blank line between methods/constructors, including abstract repository methods. Within a method, separate
  meaningful phases (validation, reads/locks, decisions, writes/audit, result) with one blank line; keep related statements
  together. These rules also apply to AI-generated code: a formatter cannot infer semantic phases.
  Run `./mvnw.cmd spotless:apply` before building; `verify` fails on unformatted code.

Commands (run inside `backend/wiki-service`; community-service has its own Maven Wrapper with the same `verify` and
`spotless:apply` goals):

```powershell
./mvnw.cmd verify                                             # build + tests + format check
./mvnw.cmd spotless:apply                                     # format all Java files
./scripts/dev/start-local.ps1 -EnvironmentFile <path to .env.r2>  # run locally (Docker required)
```

Object storage is Cloudflare R2 in development too (ADR-030 section 14). The launcher reads the `STORAGE_*` values from
the ignored environment file; a plain `spring-boot:run` with the `local` profile has no storage unless they are set.

Build output defaults to `target/`. If the IDE/JDT writes there during verification, isolate Maven output with an
absolute directory instead of stopping the user's IDE:

```powershell
$verificationDirectory = Join-Path $PWD.Path ".local-state/verification/target"
./mvnw.cmd "-Dwiki.build.directory=$verificationDirectory" clean verify
```

Keep `target` as the last directory segment so ArchUnit identifies `target/test-classes` as test output.
Surefire reports are under the selected build directory's `surefire-reports/`. The OpenAPI test artifact intentionally
remains `target/openapi/wiki-v1.json` (the MVC-only artifact is under `target/openapi-mvc/`); default CI paths are unchanged.
Do not run concurrent builds against the same output directory or edit shared sources while a verification is running.

## Frontend conventions (`frontend`)

`frontend/AGENTS.md` adds the rules for the data layer, folder structure and stylesheets.

- React + TypeScript + Vite. Shared UI from `@aov/ui` (`packages/ui`).
- Commands: `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format` (run inside `frontend`).
- Formatting is owned by Prettier (`frontend/.prettierrc.json`: no semicolons, double quotes, 120 columns).
- Lists load as the reader scrolls, never with page buttons. Put `InfiniteScroll` (`@aov/ui/components/infinite-scroll`)
  right after the last row, inside the box that scrolls. Drive it with `useInfiniteQuery` and `nextPageOf`
  (`@aov/ui/lib/page-slice`), or with `useRevealedRows` (`@aov/ui/hooks/use-revealed-rows`) when the rows are already in
  memory. Show a whole-list error only for `isLoadingError`: a later page that fails must keep the rows already loaded.
- Show a moment in time with `LocalTime` (`@aov/ui/components/local-time`): it reads the user's zone, draws the dashes
  and reveals the original time. Pass `sourceTimeZone` when the item has a zone of its own, such as `plan.timezone`;
  without one the original time reads as UTC. Group or compare by day with `dayKeyInZone` from `@aov/ui/lib/time-zone`.
  A yyyy-mm-dd date has no time and must never go through a time zone: `LocalTime` and `formatCalendarDate` keep it as written.
- Show real money with `LocalMoney` (`@aov/ui/components/local-money`): it reads the user's currency, draws the dashes and
  reveals the original amount with the date of the rate. Pass `on` with the day the amount belongs to, such as a
  tournament's end date, so it reads at the rate of that day. Pass every unit a prize was recorded in; use
  `LocalPrizeText` for free text such as `plan.prizePool`. A missing rate keeps the original amount. Gold and vouchers
  are in-game currencies and never go through it.
- Format numbers of the interface (row counts, views, statistics, money) with the reader's locale, never a hard-coded
  `"vi-VN"` in `toLocaleString` or `Intl.NumberFormat`. In-game figures are the exception: health, damage, seconds,
  metres and percentages in hero, item, arcana and trait text and in editorial notes are written as the game writes
  them (`1200`, `0.35`) whatever the reader's locale, as `frontend/docs/QUY-UOC-VIET.md` section 3 says.
- Colors, radius and the font family come from `packages/ui/src/styles/tokens.css` (see `frontend/docs/DESIGN-TOKENS.md`).
  App stylesheets alias those tokens; do not declare new palette values, except for overlays on artwork.
  Status colors use the token utilities (`text-destructive`, `bg-destructive/10`) or the token itself where no utility
  exists (`text-(--aov-warning)`, `bg-(--aov-success-soft)`), never Tailwind palette classes with hand-written `dark:`
  variants.
- Typography (admin) follows a 12/14/16/24 reading scale. Never use text smaller than 12px (`text-xs`), in Tailwind
  classes, inline styles or CSS; `pnpm lint` fails otherwise. Reading text is
  regular weight, titles bold. Use the role styles from `packages/ui/src/styles/typography.css` instead of picking
  sizes: `type-page-title` (24/32 bold, used by `PageHeader`), `type-section-title` (16/24 bold, section `h2`),
  `type-body` (14/20), `type-label` (12/16 semibold, column headers and field labels), `type-meta` (12/16 muted).
  Do not combine a `type-*` style with `text-{size}` or `font-{weight}` on the same element.
- Admin asks before destructive actions with `confirmAction` or `confirmDiscard` from `@/components/confirm-dialog`, never
  `window.confirm`. Both resolve with the answer, so a handler awaits them; a link click that asks must prevent the
  default first and navigate itself once accepted.

## Tests

These rules apply to new and touched tests; existing tests keep their names and set-up until their suite is reworked.

- Backend: `*Test` is a unit or slice test that needs no container. `*IntegrationTest` needs PostgreSQL or object
  storage and uses the one shared container configuration and the one shared Docker gate. No other suffix; the
  architecture tests keep their existing names.
- Frontend: every package needs a `test` script that runs every file under `tests/`. CI must run
  `pnpm format:check`, `pnpm typecheck` (Admin's also checks `tests/` and `lint/`), `pnpm lint` and `pnpm test`; a
  test or lint rule that none of these runs is a gap to fix.
- Shared set-up lives in one place per suite (`tests/fixtures/` in each frontend package, a test support package in
  each service). Do not paste a bootstrap block into a test file.
- A test waits for a condition with the suite's shared `waitFor` helper or uses fake timers. No fixed sleeps.
- One behavior per test, named as a sentence. A test does not assert on source text or on file hashes.
- A rule about the source itself (no text under 12px, no `window.confirm`, which modules a folder may import) is a lint
  check, not a test: it lives in the package's `lint/` folder, prints the offending files and runs as `pnpm lint`.

## Git

- Conventional Commits with a scope from this list: `wiki/<module>`, `community/<module>`, `wiki` or `community` for
  a change across one service, `fe/admin-aov`, `fe/aov-wiki`, `fe/aov-stream`, `fe/ui`, `fe/community-contracts`, `fe`
  for the whole frontend workspace, `infra`, `ci`, `hooks`, `spec`, `agents`, `research`, `resources`. Examples:
  `feat(wiki/hero): ...`, `fix(fe/aov-wiki): ...`, `docs(spec): ...`, `chore(infra): ...`.
- One logical change per commit. Commit spec changes separately from code.
- Never commit secrets (`.env`, keys, tokens). Only `.env.example` is tracked.
- `resources/` is git-ignored except `resources/README.md` (ADR-030). Public images are Media; evidence captures and
  import data live in the R2 source collections, and `pnpm sources:sync pull` (in `frontend/apps/admin-aov`) restores a
  local copy. Never commit files from `resources/`. Keep the Git LFS rules in `.gitattributes`; do not change them
  without asking.
- CI: `.github/workflows/backend.yml` runs `mvnw verify` (with Docker, so Testcontainers tests run), the Python script
  tests and the launcher checks on every push touching `backend/wiki-service`; `community-backend.yml` does the same for
  community-service, `frontend.yml` runs the frontend checks, `research.yml` the research importer tests, and
  `comments.yml` the English comment check on the pushed commits.
- A Flyway version number is taken when the branch is merged, not when the migration is written: use the next free
  number on the target branch and rename the file in the merge. A gap is fine. Never reuse or renumber a version that
  a shared database has applied; a branch's own local database is repaired or reset instead.
- The pre-commit hook formats staged Java of both services and staged frontend files, and checks comments in every
  tracked source folder.

## Git hooks

Hooks live in `.githooks/` (versioned). Enable them once per clone:

```powershell
git config core.hooksPath .githooks
git lfs install --skip-repo
```

- `pre-commit` (requires Node.js):
  1. Formats staged files: Java under `backend/wiki-service/src` and `backend/community-service/src` with that
     service's Spotless (needs Java, ~5-10 s per service),
     frontend files with Prettier (skipped with a warning until `pnpm install` has installed it).
     Fully staged files are re-staged. A partially staged file is formatted in the working tree only and
     the commit stops: review it, `git add` it, commit again.
  2. Rejects Vietnamese text in comments of staged code in every folder except docs and `resources/`.
     `comments.yml` runs the same check in CI (`--range <base>...<head>`) for clones without the hooks.
- Skip formatting once: `SKIP_FORMAT=1 git commit ...` (PowerShell: `$env:SKIP_FORMAT=1; git commit ...; Remove-Item Env:SKIP_FORMAT`).
- `pre-push`, `post-checkout`, `post-commit`, `post-merge`: Git LFS hooks.
- Bypass only for a genuine exception: `git commit --no-verify`.

## Scratch output

- Write command output, screenshots, browser profiles and throwaway builds outside the repository: the session's
  scratch directory or the OS temp folder. Never write `*.log` files into a module root.
- When a tool needs a path inside the repository, use `.local-state/<task>/` and delete that folder when the task is
  done. Reuse `.local-state/verification/target` for isolated Maven builds instead of creating one directory per task.
- Delete a headless browser profile as soon as its screenshots are saved.
- Do not create empty package folders ahead of code. A `.gitkeep` may only hold a folder that has no other file;
  remove it together with the first real file.

## Do not

- Do not modify or delete local files in `resources/` (above all the untracked `resources/raw`) unless explicitly asked.
- Do not add Redis, Kafka, Kubernetes or new services without an ADR.
- Do not translate or rewrite the Vietnamese specs unless explicitly asked.
