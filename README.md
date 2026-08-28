# OSS Error Registry

OSS Error Registry is an offline-first, deterministic diagnostic engine and open
registry for common developer, build, and deployment errors.

The project is being designed so developers can diagnose logs locally without an
LLM, API key, database, login, or external service. Detector definitions will be
deterministic and contributor-friendly, with fixtures and tests kept alongside
each detector.

> **Project status:** the declarative detector contract and runtime validation
> are under development. Matching, scoring, the built-in registry, reporters,
> and command-line behavior have not been implemented yet.

## Workspace

- `packages/core` — shared contracts and the future deterministic engine
- `packages/registry` — the future built-in detector registry
- `packages/reporter` — future structured and human-readable output
- `packages/cli` — the future command-line entry point

The current detector definition contract is described in
[`docs/detector-contract.md`](docs/detector-contract.md).

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

On Windows systems where PowerShell blocks script shims, use `pnpm.cmd` without
changing the system execution policy.

## License

Licensed under the [MIT License](LICENSE).
