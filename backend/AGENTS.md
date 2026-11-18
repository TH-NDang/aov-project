# Backend engineering boundaries

These rules supplement the repository instructions. See [the backend guide](README.md),
[the documentation index](docs/README.md), and ADR-013 for the current layout.
They apply to both services unless a rule names one.

## Changes and compatibility

- Establish the current behavior from code, HTTP contracts and tests before refactoring.
- Keep endpoint paths, validation order, error codes, transaction boundaries and lock order intact unless the task explicitly changes them.
- Separate structural changes from dependency upgrades, schema changes and new behavior.
- Keep comments, identifiers and error details in English; write user documentation in Vietnamese.

## Feature modules

- Each `com.wikiaov.<module>` owns its data and publishes contracts at its package root.
- Keep domain rules independent of Spring, JPA, JDBC, HTTP clients and cloud SDKs.
- The module's `*Api` interface owns the OpenAPI documentation and the parameter constraints. The controller
  implements it and owns the Spring mappings and the request binding (paths and versions as in the repository
  `AGENTS.md`). Controllers delegate to an application facade and hold no logic. Every controller of both services follows this.
- Application facades own authorization and transaction boundaries. Internal collaborators run within the facade's transaction.
- Group large modules by function before layer: `internal/<capability>/{application,domain,persistence/entity,infrastructure}`.
  Examples are Hero `authoring`, `skills`, `skins`, `importing`; Patch `season`, `ruleset`, `release`; Media `asset`,
  `upload`, `ingestion`, `storage`. Create only the layers that the function actually needs. Small cohesive modules may
  retain their current layered structure.
- Each capability owns its entities, repositories, queries and adapters. A read model may combine data from capabilities
  of the same module, but do not move every repository into one overview store or make one facade own all module data.
- Keep module-level `internal/web` contracts/controllers, HTTP commands/response DTOs and serialized domain content
  records at their existing names when moving them would alter HTTP, OpenAPI schema names or stored JSON compatibility.
  Module-wide error enums and deliberate shared policies may remain at module level. Do not use compatibility folders
  as a catch-all for new unrelated functionality.
- Prefer Spring Data JPA repository methods, typed projections, `@Query`, `@Lock` and Specifications for ordinary persistence. Use custom repository fragments for genuinely dynamic Criteria queries and narrow adapters for operations such as an empty-table-safe database lock.
- Do not expose generic SQL or arbitrary-entity APIs such as `rows(sql)`, `write(sql)` or `lock(Class, id)` to use cases. Moving those APIs into a wrapper does not establish a useful boundary.
- Put persistence operations, locks and database-specific queries in the owning capability's `persistence`; external IO
  belongs behind a useful port in `application/port` and its `infrastructure` adapter. Use custom Criteria fragments only
  for dynamic queries that repository methods/Specifications do not express clearly, and document native lock exceptions.
- Use shared pure policies only for genuinely identical rules; map their violations to the owning module's existing errors.
- Do not create an interface for every class or replace concrete workflows with a generic CRUD framework.
- `ModuleArchitectureTests` checks module boundaries. `LayerArchitectureTests` checks domain, controller and direct-IO dependencies.

## Entities, input and write use cases

- New entities follow the `media` module: `@Getter`, a protected no-args constructor, a static factory, methods named
  after the business action, no public setters, `@Version` for optimistic locking. Existing entities are moved when
  their module is reworked, not in bulk.
- A request body is a record named `*Command` in the owning capability's `application` package, validated with Bean
  Validation and `@Valid`. Check by hand only what needs data. Page limits are declared on the `*Api` parameters
  (`@Min(0) int page, @Min(1) @Max(100) int size`). Existing module-level commands keep their place (see above).
- Every admin write use case, after validation: locks or version-checks the row, writes, then records an `AuditEntry`.
- A missing row is the module's `*_NOT_FOUND` error. Never call `orElseThrow()` without a supplier. A bad query
  parameter is `PlatformErrorCode.INVALID_QUERY_PARAMETER`, not the module's content error.
- User-facing sentences are not built in the backend. Return a code and let the frontend choose the words; e-mail
  text lives in per-locale templates.

## Function layout and generated code

- Leave one blank line between methods and constructors, including abstract methods in repository interfaces. The shared Eclipse profile enforces this in Maven, hooks and VS Code.
- Separate meaningful phases within a method with one blank line: input checks, reads/locks, decisions, writes/audit and the returned result. Keep related assignments together.
- Keep a use case at one level of abstraction. Extract a coherent validation, mapping or persistence step into a named method or capability when its details obscure the workflow.
- Do not insert a blank line after every statement, decorate methods with section banners or add comments that merely repeat the code.
- These rules also apply to AI-generated code. Formatting preserves structural spacing; agents must choose and review semantic groups rather than expecting the formatter to infer business phases.

## Java style beyond Spotless

These rules apply to new and touched code; existing code is brought in line when its module is reworked, not in bulk.

- Imports are explicit. No wildcard imports and no fully qualified names inside code.
- `if`, `for` and `while` always use braces, including one-line bodies.
- Beans declare their constructor explicitly. Lombok stays for entity accessors.
- Every method that implements an interface method carries `@Override`.
- Nullable parameters, fields and return values carry jspecify `@Nullable`. Only repositories return `Optional`.
- A closed set of values is an enum mapped with `@Enumerated(EnumType.STRING)`. Never compare a state with a string
  literal, in Java or inside a query.
- A limit, a default locale or a regular expression needed in more than one class is a named constant: in the root
  package of `platform` when several modules need it, in the owning rule class otherwise.
- The name `*Repository` is reserved for Spring Data interfaces. A hand-written persistence class is named after what
  it reads or writes (`HeroSectionSnapshots`, `SeasonOrderLock`).

## Configuration and tools

- Keep Maven Wrapper and `compose.yaml` at the service root so existing commands and Docker volumes remain stable.
- Spring configuration belongs in `src/main/resources/config/`; use the standard profile discovery mechanism.
- Local container assets belong in `infra/local/`; formatting configuration belongs in `config/format/`.
- Development scripts belong in `scripts/dev/`; parse local environment files as data and never execute their values.
- Preserve exported environment values, keep real secrets out of version control, and do not print credential values in diagnostics.
- Store generated files and local receipts under ignored build or local-state paths. Never move applied Flyway migrations to tidy the tree.

## Verification

From `backend/wiki-service`, run `./mvnw.cmd spotless:apply` before compiling and
`./mvnw.cmd clean verify` for the complete build. Use `sh mvnw` on Unix.

`wiki.build.directory` defaults to the service's absolute `target` path. When JDT or another IDE builder also writes
there, use a separate absolute directory for Maven verification:

```powershell
$verificationDirectory = Join-Path $PWD.Path ".local-state/verification/target"
./mvnw.cmd "-Dwiki.build.directory=$verificationDirectory" clean verify
```

Keep `target` as the final directory segment so ArchUnit recognizes test output without changing boundary rules.

Read test results from `<selected build directory>/surefire-reports/`, not from an earlier `target` run. OpenAPI artifacts
remain at `target/openapi/wiki-v1.json` and `target/openapi-mvc/`; CI uses the default output and keeps its existing paths.
Keep shared source/configuration stable while tests run and never run concurrent builds against one output directory.

Run the launcher regression script when changing the environment loader. Validate Compose with
`docker compose config --quiet` after changing mounts or service configuration.
Use Docker for the integration tests and report skipped tests explicitly.
Do not weaken or disable behavior assertions to make a refactor pass; the test rules in the repository `AGENTS.md`
also forbid asserting on source text or file hashes.
