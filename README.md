# OSS Error Registry

OSS Error Registry is an offline-first, deterministic CLI, diagnostic engine,
and open registry for common developer, build, and deployment errors.

It turns a log into structured, reviewable guidance without an LLM, API key,
database, login, network service, telemetry, or analytics. Detection uses
versioned declarative signatures, bounded matching, committed fixtures, and
deterministic output.

> **Project status:** the core engine, static production registry, reporter, and
> bounded file/stdin CLI are implemented. The initial catalog intentionally
> contains eight high-signal detectors rather than a broad superficial list.
> Public package metadata and offline package validation are implemented, but no
> workspace package has been published to npm.

## What it returns

For every deterministic match, the tool reports:

- detector ID and ecosystem;
- diagnosis title and evidence score;
- matched evidence and explanation;
- likely causes and diagnostic steps;
- remediation suggestions marked `safe` or `review`; and
- authoritative documentation references.

The score is a deterministic evidence-point total, not a probability.

## Supported catalog

| Ecosystem  | Detector ID                     | Diagnosis                                        |
| ---------- | ------------------------------- | ------------------------------------------------ |
| Docker     | `docker/daemon-unavailable`     | Docker client cannot reach the configured engine |
| Git        | `git/non-fast-forward-push`     | Push rejected as non-fast-forward                |
| Git        | `git/not-a-repository`          | Current directory is not a Git repository        |
| Node.js    | `node/module-not-found`         | CommonJS module cannot be resolved               |
| npm        | `npm/eresolve-peer-dependency`  | Peer dependency resolution conflict              |
| npm        | `npm/missing-script`            | Requested package script is undefined            |
| pnpm       | `pnpm/outdated-lockfile`        | Frozen install has an outdated lockfile          |
| TypeScript | `typescript/cannot-find-module` | Compiler error TS2307                            |

Only these errors are currently claimed. Requests for additional real errors are
welcome through the detector contribution workflow.

## Run locally

Requirements:

- Node.js 22.13.0 or newer
- pnpm 11 or newer

Install, build, and invoke the unpublished CLI from a checkout:

```sh
pnpm install
pnpm build
pnpm cli --help
```

Read an explicit UTF-8 log file:

```sh
pnpm cli error.log
pnpm cli --format json error.log
```

Or pipe stderr and stdout to stdin:

```sh
some-command 2>&1 | pnpm cli
some-command 2>&1 | pnpm cli --format json
```

Pretty output is the default. A matching report begins like this:

```text
Status: matches
Matches: 1
Normalized input length: 69

Diagnosis 1
  Detector ID: git/not-a-repository
  Ecosystem: git
  Title: Current directory is not a Git repository
  Evidence score: 100/100
  Matched evidence:
    1. not-a-repository-fatal
    2. parent-search-message
```

JSON mode emits the reporter's stable schema. For the 20-character input
`unrecognized failure`, the no-match report is:

```json
{
  "schemaVersion": 1,
  "status": "no-match",
  "matchCount": 0,
  "normalizedInputLength": 20,
  "matches": []
}
```

Usage, output formats, exit codes, the 1 MiB input limit, and stdin behavior are
documented in [`docs/cli.md`](docs/cli.md).

## Add one detector

A detector is one self-contained directory:

```text
packages/registry/src/detectors/<ecosystem>/<detector-name>/
  detector.ts
  cases.json
  fixtures/
    positive/
    negative/
```

Contributors do not edit a central detector list or create handwritten
detector-specific tests. The generator discovers valid directories, writes a
deterministically ordered static index, and the generic harness automatically
runs every positive and negative case.

Follow [`DETECTOR_GUIDE.md`](DETECTOR_GUIDE.md) for the exact schema, naming,
fixtures, validation rules, commands, and pull request workflow. General project
guidance is in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Development

Run the complete repository validation:

```sh
pnpm check
git diff --check
```

When detector files change, regenerate the committed static index first:

```sh
pnpm registry:generate
pnpm registry:check
```

`pnpm check` verifies registry drift, formatting, linting, strict TypeScript,
all Vitest suites, and the production build. Do not edit
`packages/registry/src/generated/detectors.ts` manually.

Run the complete release-readiness gate without publishing anything:

```sh
pnpm release:check
```

It performs the regular checks, packs every intended public package twice,
verifies deterministic allowlisted contents, installs the local tarballs into an
isolated offline consumer, checks declarations and imports, and exercises the
packaged CLI. Temporary artifacts are removed automatically.

On Windows systems where PowerShell blocks script shims, use `pnpm.cmd` without
changing the system execution policy.

## Design and security

- Input and fixtures are data; they are never executed.
- Detector modules are restricted to a data-only `defineDetector({...})` form.
- Core matching is bounded, deterministic, offline, and free of callbacks.
- Runtime registry loading uses committed static imports and does not crawl the
  filesystem or dynamically load contributor modules.
- The CLI reads only the explicit file or stdin, never URLs or commands embedded
  in a log.
- Registry tooling rejects path traversal, absolute fixture paths, unexpected
  files, invalid UTF-8, oversized input, symbolic links, and generated drift.
- Output contains no timestamps, randomness, telemetry, or machine-specific
  metadata.

Diagnostic command strings are inert display text. Remediation that can change
dependencies, configuration, services, or history is marked for review.

## Workspace and architecture

- `@oss-error-registry/core` — detector contract and deterministic matching
  engine
- `@oss-error-registry/registry` — production detectors and static runtime index
- `@oss-error-registry/reporter` — deterministic pretty and JSON output
- `@oss-error-registry/cli` — bounded file/stdin CLI and executable

The root workspace remains private. The four intended public packages are ESM,
expose only documented root APIs, and use lockstep Semantic Versioning. Their
current `0.0.0` version is a development placeholder, not a published release.
See [`docs/releasing.md`](docs/releasing.md) and [`CHANGELOG.md`](CHANGELOG.md)
for package boundaries, version policy, and the non-publishing release gate.

Detailed design documents:

- [`docs/detector-contract.md`](docs/detector-contract.md)
- [`docs/matching-engine.md`](docs/matching-engine.md)
- [`docs/registry-architecture.md`](docs/registry-architecture.md)
- [`docs/reporter.md`](docs/reporter.md)
- [`docs/cli.md`](docs/cli.md)
- [`docs/releasing.md`](docs/releasing.md)

## License

Licensed under the [MIT License](LICENSE).
