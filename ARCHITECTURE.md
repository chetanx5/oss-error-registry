# Architecture

OSS Error Registry separates deterministic analysis, production data, output
formatting, and process I/O into four small ESM packages. The separation keeps
the runtime understandable and lets contributors add detectors without changing
the engine.

## Data flow

```text
explicit UTF-8 file or stdin
            |
            v
@oss-error-registry/cli
            |
            +--> @oss-error-registry/registry (static detector data)
            |
            +--> @oss-error-registry/core (bounded analysis)
            |
            `--> @oss-error-registry/reporter (pretty or JSON text)
                         |
                         v
                       stdout
```

CLI usage and input failures go to stderr. Analysis output, including a
successful no-match report, goes to stdout.

## Package boundaries

### `@oss-error-registry/core`

Core owns detector and plugin contracts, runtime validation, input
normalization, bounded matching, scoring, ordering, immutable analysis results,
and analysis errors. It accepts text and detector objects only. It does not read
files, load a registry, format output, or access a network.

### `@oss-error-registry/registry`

Registry owns reviewed production detector definitions and their test fixtures.
Its public runtime API is the frozen `builtInDetectors` collection. A committed
generated file uses static imports, so normal runtime loading does not crawl the
detector tree, read fixture files, parse `cases.json`, or dynamically import
contributor-controlled paths.

Directory discovery and fixture reads occur only in trusted development tooling
and tests. The generator validates every detector directory before producing a
locale-independent, deterministically ordered index.

### `@oss-error-registry/reporter`

Reporter projects an `AnalysisResult` into human-readable text or stable
schema-versioned JSON. It preserves semantic array ordering, uses fixed property
and section ordering, escapes terminal controls, and introduces no time,
randomness, filesystem, or network dependency.

### `@oss-error-registry/cli`

CLI owns argument parsing, bounded UTF-8 file/stdin reads, composition of the
three lower-level packages, stdout/stderr routing, and exit codes. It does not
duplicate matching, registry discovery, or formatting logic. The only product
runtime filesystem operation is reading the exact input path selected by the
user.

## Dependency direction

```text
registry -> core
reporter -> core
cli -> core + registry + reporter
```

Core has no workspace dependency. Registry and reporter do not depend on each
other or CLI. No package depends back on CLI, so the graph remains acyclic.

## Detector contribution boundary

One detector lives under:

```text
packages/registry/src/detectors/<ecosystem>/<detector-name>/
  detector.ts
  cases.json
  fixtures/
    positive/
    negative/
```

The detector module is restricted to a data-only `defineDetector({...})` form.
The registry tool rejects extra executable constructs, malformed case data,
unsafe fixture paths, symbolic links, unexpected files, and generated drift. The
generic harness runs every declared positive and negative fixture without a
handwritten central test list.

See [`DETECTOR_GUIDE.md`](DETECTOR_GUIDE.md) and
[`docs/registry-architecture.md`](docs/registry-architecture.md) for the exact
contributor contract.

## Determinism and bounds

- Input is normalized using fixed ECMAScript and Node.js behavior.
- Evidence and exclusions use literal substrings or validated restricted regex
  definitions.
- Required evidence gates matching; weights are summed once and capped at 100.
- Matches sort by score descending, then ASCII detector ID ascending.
- Inputs, detectors, patterns, pattern evaluations, and returned results are
  bounded.
- Output omits timestamps, random identifiers, locale-sensitive ordering, and
  machine-specific paths.
- Registry generation contains no timestamps or absolute local paths.

Detailed matching semantics are in
[`docs/matching-engine.md`](docs/matching-engine.md).

## Build and publication boundary

TypeScript project references build declarations, declaration maps, JavaScript,
and source maps into each package's ignored `dist/` directory. Public manifests
allowlist only `dist`, `LICENSE`, and `README.md`.

`pnpm release:check` builds and packs all four packages twice, compares their
allowlisted contents, rejects unsafe source-map paths, installs the tarballs
into an isolated offline consumer with lifecycle scripts disabled, verifies
imports and declarations, and exercises the packaged CLI. Publication, tagging,
and release creation are intentionally outside that command.

## Security model

Runtime input and detector guidance are inert data. No product package executes
commands from logs or detector fields, invokes a shell or subprocess, evaluates
source text, contacts a network, scans directories, sends telemetry, or runs
fixtures. Development-only packaging tooling starts fixed local executables with
`shell: false`; it does not accept detector-controlled commands or publish
packages.

See [`SECURITY.md`](SECURITY.md) for threat boundaries and reporting guidance.
