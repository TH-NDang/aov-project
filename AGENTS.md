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

## Project map

```text
aov-project/
├── backend/
│   ├── docs/           Specs (Vietnamese): 01 project, 02 database, 03 API, adr/
│   └── wiki-service/   Spring Boot 4.1.1, Java 21, Maven Wrapper — AOV Wiki backend
├── frontend/           pnpm + Turborepo: apps/aov-wiki, apps/aov-stream, apps/admin-aov, packages/ui
└── resources/          Raw data and images (images via Git LFS).
```

## Source of truth

- Backend behavior is specified by `backend/docs/01-BAN-DAC-TA-DU-AN.md`, `02-DATABASE-DU-AN.md`, `03-API-DU-AN.md`.
- Backend layout and engineering boundaries are described in `backend/AGENTS.md` and ADR-013; business/API/data contracts remain in 01/02/03.
- If `NOTE-SPRING-BOOT-4.md` conflicts with 01/02/03, follow 01/02/03.
- Architecture decisions live in `backend/docs/adr/`. Read them before changing what they cover.
- When code and spec disagree, stop and ask instead of silently picking one.

## Backend conventions (`backend/wiki-service`)

- Root package `com.wikiaov`. One deployable, modular monolith (Spring Modulith).
- Modules: `hero`, `media`, `patch`, `item`, `arcana`, `spell`, `enchantment`, `gamemode`, `query`, `access`, `platform`, `user`, `terminology`.
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
- API paths: map `ApiPaths.ROOT + "/..."` (or `ApiPaths.ADMIN`) and declare `version = "1"` on the mapping.
  Spring MVC native API versioning reads the version from `/api/wiki/{apiVersion}`. Never hard-code `/api/wiki/v1` in mappings.
- Errors: throw `ApiException` with a module-owned enum implementing `ApiErrorCode` (placed in `internal/application`),
  e.g. `HeroErrorCode.HERO_NOT_FOUND`. Never build error `ResponseEntity`s by hand. Codes must be unique across modules.
- Query strings of public endpoints are whitelisted with `QueryParameters.requireOnly`; pages are returned as `PageSlice`.
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

Commands (run inside `backend/wiki-service`):

```powershell
./mvnw.cmd verify                                             # build + tests + format check
./mvnw.cmd spotless:apply                                     # format all Java files
./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local" # run locally (Docker required)
```

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

- React + TypeScript + Vite. Shared UI from `@aov/ui` (`packages/ui`).
- Commands: `pnpm dev`, `pnpm typecheck`, `pnpm build`, `pnpm format` (run inside `frontend`).
- Formatting is owned by Prettier (`frontend/.prettierrc.json`: no semicolons, double quotes, 120 columns).

## Git

- Conventional Commits with a scope: `feat(wiki/hero): ...`, `fix(fe/aov-wiki): ...`, `docs(spec): ...`, `chore(infra): ...`.
- One logical change per commit. Commit spec changes separately from code.
- Never commit secrets (`.env`, keys, tokens). Only `.env.example` is tracked.
- Images under `resources/` are stored with Git LFS (`.gitattributes`). Do not change those rules without asking.
- CI: `.github/workflows/backend.yml` runs `mvnw verify` (with Docker, so Testcontainers tests run) on every push touching `backend/wiki-service`.

## Git hooks

Hooks live in `.githooks/` (versioned). Enable them once per clone:

```powershell
git config core.hooksPath .githooks
git lfs install --skip-repo
```

- `pre-commit` (requires Node.js):
  1. Formats staged files: Java under `backend/wiki-service/src` with Spotless (needs Java, ~5-10 s),
     frontend files with Prettier (skipped with a warning until `pnpm install` has installed it).
     Fully staged files are re-staged. A partially staged file is formatted in the working tree only and
     the commit stops: review it, `git add` it, commit again.
  2. Rejects Vietnamese text in comments of staged code under `backend/` and `frontend/`.
- Skip formatting once: `SKIP_FORMAT=1 git commit ...` (PowerShell: `$env:SKIP_FORMAT=1; git commit ...; Remove-Item Env:SKIP_FORMAT`).
- `pre-push`, `post-checkout`, `post-commit`, `post-merge`: Git LFS hooks.
- Bypass only for a genuine exception: `git commit --no-verify`.

## Do not

- Do not modify files in `resources/` unless explicitly asked.
- Do not add Redis, Kafka, Kubernetes or new services without an ADR.
- Do not translate or rewrite the Vietnamese specs unless explicitly asked.
