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
- If `NOTE-SPRING-BOOT-4.md` conflicts with 01/02/03, follow 01/02/03.
- Architecture decisions live in `backend/docs/adr/`. Read them before changing what they cover.
- When code and spec disagree, stop and ask instead of silently picking one.

## Backend conventions (`backend/wiki-service`)

- Root package `com.wikiaov`. One deployable, modular monolith (Spring Modulith).
- Modules: `hero`, `media`, `patch`, `item`, `arcana`, `spell`, `enchantment`, `gamemode`, `query`, `access`, `platform`.
- Each module exposes public contracts at its package root; implementation goes in `internal/{web,application,domain,persistence,infrastructure}`.
- Never use another module's entity, repository or `internal` package. Call its public contract.
- IDs are `UUID`; human-readable identifiers are `code` slugs.
- API base path: `/api/wiki/v1`. Errors are `ProblemDetail` with a stable `code`.
- Schema changes only through Flyway migrations in `src/main/resources/db/migration`. Never edit an applied migration. JPA `ddl-auto` stays `validate`.
- Object storage only through the `ObjectStorage` port and `S3ObjectStorage` (AWS SDK for Java 2.x). No MinIO SDK.
- Lombok + MapStruct are allowed. Avoid `@Data` on JPA entities.
- Do not hold a DB transaction open during object storage or external HTTP calls.

Commands (run inside `backend/wiki-service`):

```powershell
./mvnw.cmd verify                                             # build + tests
./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local" # run locally (Docker required)
```

## Frontend conventions (`frontend`)

- React + TypeScript + Vite. Shared UI from `@aov/ui` (`packages/ui`).
- Commands: `pnpm dev`, `pnpm typecheck`, `pnpm build` (run inside `frontend`).

## Git

- Conventional Commits with a scope: `feat(wiki/hero): ...`, `fix(fe/aov-wiki): ...`, `docs(spec): ...`, `chore(infra): ...`.
- One logical change per commit. Commit spec changes separately from code.
- Never commit secrets (`.env`, keys, tokens). Only `.env.example` is tracked.
- Images under `resources/` are stored with Git LFS (`.gitattributes`). Do not change those rules without asking.

## Git hooks

Hooks live in `.githooks/` (versioned). Enable them once per clone:

```powershell
git config core.hooksPath .githooks
git lfs install --skip-repo
```

- `pre-commit`: rejects Vietnamese text in comments of staged code under `backend/` and `frontend/` (requires Node.js).
- `pre-push`, `post-checkout`, `post-commit`, `post-merge`: Git LFS hooks.
- Bypass only for a genuine exception: `git commit --no-verify`.

## Do not

- Do not modify files in `resources/` unless explicitly asked.
- Do not add Redis, Kafka, Kubernetes or new services without an ADR.
- Do not translate or rewrite the Vietnamese specs unless explicitly asked.
