# OSS Error Registry

OSS Error Registry is an offline-first, deterministic CLI, diagnostic engine,
and open registry for common developer, build, and deployment errors.

It turns log text into structured, reviewable guidance without an LLM, API key,
database, login, telemetry, analytics, or runtime network service. Detection
uses versioned declarative signatures, bounded matching, committed fixtures, and
stable output.

> **Release status:** version `0.1.1` is prepared as an installability hotfix
> but has not been published. Do not install `0.1.0`: that release exposed pnpm
> `workspace:*` dependency specifications in its public manifests. The hotfix
> retains those specifications in source and verifies pnpm's rewritten tarball
> manifests before publication.

## Why deterministic diagnostics?

AI assistants are excellent for exploratory debugging, but many recurring tool
errors have stable signatures and well-understood first checks. A deterministic
registry is useful when a result must be:

- available offline and without credentials;
- reproducible across runs and machines;
- explainable through the exact evidence that matched;
- reviewable as ordinary open-source data and fixtures; and
- safe to use in local scripts or CI without sending logs elsewhere.

OSS Error Registry complements AI-assisted debugging; it does not attempt to
replace it. A deterministic result can provide a fast starting point or become
structured context for deeper investigation.

## What it returns

For every match, the tool reports:

- detector ID and ecosystem;
- diagnosis title and deterministic evidence score;
- matched evidence and explanation;
- likely causes and diagnostic steps;
- remediation suggestions marked `safe` or `review`; and
- authoritative documentation references.

The evidence score is a bounded point total from declared rules, not a
probability or model confidence estimate. No match is also a successful,
structured result; it means only that the current catalog did not recognize the
input.

## Supported catalog

The initial catalog deliberately favors eight high-signal detectors over broad,
superficial coverage.

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

Only these errors are currently claimed. See [Limitations](#limitations) and the
[roadmap](ROADMAP.md) for the intended direction.

## Install and run

Requirements:

- Node.js 22.13.0 or newer
- pnpm 11 or newer for repository development

### From the repository today

Until the `0.1.1` hotfix is explicitly published, install and run from a
checkout:

```sh
git clone https://github.com/chetanx5/oss-error-registry.git
cd oss-error-registry
pnpm install --frozen-lockfile
pnpm build
pnpm cli --help
```

### Intended npm invocation after the hotfix is published

Once `@oss-error-registry/cli` version `0.1.1` is published, the package is
prepared for this invocation:

```sh
npx @oss-error-registry/cli error.log
some-command 2>&1 | npx @oss-error-registry/cli
```

These commands describe the prepared `0.1.1` package interface. Version `0.1.0`
cannot be installed because its internal workspace dependency specifications
were not rewritten during publication.

## CLI usage

Read an explicit UTF-8 log file:

```sh
pnpm cli error.log
pnpm cli --format json error.log
```

Or read standard input:

```sh
some-command 2>&1 | pnpm cli
some-command 2>&1 | pnpm cli --format json
```

Pretty output is the default. `--help`, `--version`, explicit `-` stdin, and
`--` option termination are supported. Successful analysis uses exit code `0`,
including no-match results; invalid usage uses `2`, input failures use `3`, and
unexpected internal failures use `1`.

See [`docs/cli.md`](docs/cli.md) for the complete argument, input, output, and
exit-code contracts.

## Example

Input:

```text
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! While resolving: example-app@1.0.0
npm ERR! Found: react@18.3.1
npm ERR! Could not resolve dependency: peer react@"^17.0.0" from example-plugin@2.0.0
```

Pretty output:

```text
Status: matches
Matches: 1
Normalized input length: 234

Diagnosis 1
  Detector ID: npm/eresolve-peer-dependency
  Ecosystem: npm
  Title: Peer dependency resolution conflict
  Evidence score: 90/100
  Matched evidence:
    1. npm-eresolve-code
    2. dependency-tree-message
  Explanation:
    npm could not construct a dependency tree that satisfies the declared peer dependency ranges.
  Likely causes:
    1. Two packages require incompatible versions of the same peer dependency.
    2. A package's peer dependency range does not include the installed version.
  Diagnostic steps:
    1. Inspect why npm selected the conflicting package version.
       Command: npm explain <package-name>
  Remediation suggestions:
    1. [safe] Review the conflicting peer dependency ranges before changing versions.
    2. [review] Align direct dependency versions after reviewing compatibility notes.
       Command: npm install <package-name>@<compatible-version>
  Documentation:
    1. npm peer dependency configuration
       URL: https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependencies
```

JSON mode uses a stable, versioned schema. A deterministic no-match response is:

```json
{
  "schemaVersion": 1,
  "status": "no-match",
  "matchCount": 0,
  "normalizedInputLength": 20,
  "matches": []
}
```

## Programmatic usage

The four ESM packages expose narrow package-root APIs:

```ts
import { analyze } from "@oss-error-registry/core";
import { builtInDetectors } from "@oss-error-registry/registry";
import { formatJson, formatPretty } from "@oss-error-registry/reporter";

declare const errorText: string;

const result = analyze(errorText, builtInDetectors);
const terminalReport = formatPretty(result);
const jsonReport = formatJson(result);
```

`@oss-error-registry/cli` additionally exports `runCli()`, `CLI_EXIT_CODE`, and
their public TypeScript types for controlled embedding. Package-specific READMEs
document each supported root API.

## How matching works

1. Core validates and normalizes bounded UTF-8 input.
2. Every detector is structurally validated at the analysis boundary.
3. Exclusions veto known near-misses.
4. Required evidence gates a detector; matched evidence weights are summed and
   capped at 100.
5. Matches meeting their declared threshold are ordered by score descending,
   then detector ID in locale-independent ASCII order.
6. The reporter projects the frozen result into deterministic pretty text or
   versioned JSON.

Matching is literal substring or restricted regular-expression evaluation. It
does not use statistical inference. Detailed semantics and work limits are in
[`docs/matching-engine.md`](docs/matching-engine.md).

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

Contributors do not edit a handwritten central list or create one-off tests. The
generator discovers valid directories, writes a deterministically ordered static
index, and the generic harness runs every declared positive and negative case.

Follow [`DETECTOR_GUIDE.md`](DETECTOR_GUIDE.md) for the exact schema, naming,
fixtures, validation rules, and pull-request workflow. General project guidance
is in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Development

```sh
pnpm install --frozen-lockfile
pnpm registry:generate
pnpm check
pnpm release:check
git diff --check
```

`pnpm check` verifies registry drift, formatting, linting, strict TypeScript,
all Vitest suites, and the production build. `pnpm release:check` additionally
packs every public package twice with pnpm, rejects any packed `workspace:`
protocol, verifies exact lockstep internal dependency versions and deterministic
allowlisted contents, installs local tarballs into an isolated offline consumer
with lifecycle scripts disabled, checks runtime imports and declarations, and
exercises the packaged CLI. It does not publish anything.

On Windows, use `pnpm.cmd` if PowerShell blocks script shims; do not change the
system execution policy for this repository.

## Architecture and security

The dependency direction is intentionally acyclic:

```text
core <- registry
core <- reporter
core + registry + reporter <- cli
```

- Input and fixtures remain data and are never executed.
- The CLI reads only the explicit file or stdin; it does not scan directories or
  resolve URLs found in logs.
- Runtime registry loading uses committed static imports and no filesystem
  discovery or arbitrary dynamic imports.
- Core matching is bounded and free of callbacks, shell execution, subprocesses,
  networking, telemetry, and analytics.
- Output has no timestamps, randomness, locale-sensitive ordering, or
  machine-specific metadata.
- Registry tooling rejects traversal, absolute fixture paths, invalid UTF-8,
  oversized fixtures, symbolic links, unexpected files, and generated drift.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for component boundaries and
[`SECURITY.md`](SECURITY.md) for the security model and vulnerability-reporting
guidance.

## Limitations

- The catalog recognizes only the eight listed signatures; no-match does not
  mean an input is error-free.
- Evidence scores measure declared signature strength, not certainty.
- Signatures can change between tool versions, so fixtures and authoritative
  references require ongoing maintenance.
- Input is limited to 1 MiB, analysis results default to 10 matches, and the
  engine enforces detector, pattern, and evaluation bounds.
- The initial release supports ESM on Node.js 22.13.0 and newer.
- Guidance is diagnostic information, not an automatically executed repair.

## Project status and roadmap

Version `0.1.1` is a prepared hotfix for the installability defect in `0.1.0`.
The engine, registry, reporter, CLI, contributor workflow, and offline packaging
checks are implemented. The project does not claim API stability equivalent to a
`1.0.0` release or universal detector coverage.

Planned work is tracked in [`ROADMAP.md`](ROADMAP.md). Changes prioritize real
fixtures, narrow signatures, deterministic behavior, and contributor review over
catalog size.

## Contributing and conduct

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md), the
[`DETECTOR_GUIDE.md`](DETECTOR_GUIDE.md), and
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before opening a pull request.
Security-sensitive reports should follow [`SECURITY.md`](SECURITY.md) rather
than a public issue.

## License

Licensed under the [MIT License](LICENSE).
