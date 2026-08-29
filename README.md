# OSS Error Registry

OSS Error Registry is an offline-first, deterministic diagnostic engine and open
registry for common developer, build, and deployment errors.

The project is being designed so developers can diagnose logs locally without an
LLM, API key, database, login, or external service. Detector definitions will be
deterministic and contributor-friendly, with fixtures and tests kept alongside
each detector.

> **Project status:** the declarative detector contract, bounded deterministic
> matching engine, production registry architecture, and deterministic reporter
> are implemented and composed through a safe command-line interface. The
> built-in catalog intentionally contains only one reference detector.

## Workspace

- `packages/core` — shared contracts and deterministic matching engine
- `packages/registry` — deterministic built-in detector registry and tooling
- `packages/reporter` — deterministic JSON and human-readable output
- `packages/cli` — bounded file/stdin command-line entry point

The current detector definition contract is described in
[`docs/detector-contract.md`](docs/detector-contract.md). Matching, scoring,
ordering, and safety bounds are described in
[`docs/matching-engine.md`](docs/matching-engine.md). The detector directory
layout, fixture contract, generated index, and security boundary are described
in [`docs/registry-architecture.md`](docs/registry-architecture.md). Reporter
formats and guarantees are described in [`docs/reporter.md`](docs/reporter.md).
CLI usage, exit codes, input limits, and safety are described in
[`docs/cli.md`](docs/cli.md).

The current package names are private workspace names and may change before the
first public release.

## Development

Requirements:

- Node.js 22.13.0 or newer
- pnpm 11 or newer

Install dependencies and validate the workspace:

```sh
pnpm install
pnpm check
```

Build and invoke the unpublished CLI from this checkout:

```sh
pnpm build
pnpm cli --help
pnpm cli error.log
some-command 2>&1 | pnpm cli --format json
```

The packages are private and have not been published to npm.

When changing the built-in detector catalog, regenerate and verify its static
index:

```sh
pnpm registry:generate
pnpm registry:check
```

Do not edit `packages/registry/src/generated/detectors.ts` manually.

On Windows systems where PowerShell blocks script shims, use `pnpm.cmd` without
changing the system execution policy.

## License

Licensed under the [MIT License](LICENSE).
