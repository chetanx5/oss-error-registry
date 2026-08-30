# Registry architecture

The registry package owns the built-in, production detector catalog. It keeps
contributor-authored detector definitions and test data together, validates the
catalog at build and test time, and exposes a small filesystem-free runtime API.

## Detector directory convention

Each built-in detector is one self-contained directory:

```text
packages/registry/src/detectors/<ecosystem>/<detector-name>/
  detector.ts
  cases.json
  fixtures/
    positive/
    negative/
```

Both `<ecosystem>` and `<detector-name>` must use lowercase kebab-case. The
detector ID is derived from those directory names and must be exactly
`<ecosystem>/<detector-name>`.

`detector.ts` has one default export created with `defineDetector`:

```ts
import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
  schemaVersion: 1,
  id: "npm/example-error",
  ecosystem: "npm",
  // Declarative matching and diagnostic fields...
});
```

Detector definitions are data, not executable callbacks. The core detector
contract and its validation rules are documented in
[`detector-contract.md`](detector-contract.md).

The generator requires exactly one core `defineDetector` import and one default
`defineDetector({...})` export. Its argument must be a data-only object literal;
callbacks, spreads, computed properties, executable expressions, extra imports,
and extra exports are rejected. TypeScript and the generic registry tests then
validate the complete `DetectorDefinition` through core.

## `cases.json`

Every detector has a non-empty set of fixture-backed cases:

```json
{
  "detectorId": "npm/example-error",
  "cases": [
    {
      "name": "standard error",
      "fixture": "fixtures/positive/basic.log",
      "expect": {
        "match": true,
        "score": 90
      }
    },
    {
      "name": "similar unrelated error",
      "fixture": "fixtures/negative/other.log",
      "expect": {
        "match": false
      }
    }
  ]
}
```

The format is intentionally strict:

- `detectorId` must equal the ID derived from the detector directory.
- `cases` must be a non-empty array, and every case name must be non-empty and
  unique within that detector.
- Every detector must include at least one positive and one negative case.
- `fixture` must be a forward-slash relative path with exactly the form
  `fixtures/positive/<file>.log` or `fixtures/negative/<file>.log`; `.txt` is
  also supported. Fixture file names must use portable lowercase letters,
  digits, dots, underscores, and hyphens.
- Positive cases require `{ "match": true, "score": <integer 1..100> }`.
- Negative cases require `{ "match": false }` and must omit `score`.
- Fixture references must be unique, and every fixture file must be referenced.
- Unknown fields are rejected.

Fixtures are UTF-8 plain-text data. They are never executed or interpreted as
commands. Each fixture must contain non-whitespace text and must not exceed the
core analysis input limit of 1 MiB.

## Generated registry index

`src/generated/detectors.ts` contains deterministic static imports and the
readonly `builtInDetectors` collection. Contributors must not edit this file
manually. It is generated from the detector directory tree in ASCII detector-ID
order, without timestamps, random values, or absolute machine paths.

`builtInDetectors` is the registry package's only public runtime export. Its
array and detector definitions are immutable and can be passed directly to
core's `analyze()` function.

After adding or changing a detector, run:

```sh
pnpm registry:generate
pnpm test
pnpm registry:check
```

`registry:generate` validates the directory and fixture conventions before
writing the index. `registry:check` performs the same generation in memory and
fails if the committed index differs; it never rewrites the file. The drift
check is part of `pnpm check` and CI.

The normal clean-clone workflow remains:

```sh
pnpm install
pnpm check
```

## Generic test harness

Registry tests discover every detector directory and validate every case. They
check directory and ID consistency, detector validity, unique IDs, input bounds,
positive matches, negative non-matches, and exact expected scores. Adding a
detector does not require editing a central test list.

## Runtime and build-time boundary

Directory discovery, JSON parsing, and fixture reads occur only in the registry
generator and tests. The runtime registry entry point imports the committed
generated module, which contains static detector imports. Core analysis and the
published registry runtime do not scan the filesystem, access the network, load
arbitrary modules, evaluate source text, or execute commands.

Built-in `detector.ts` modules are trusted, reviewed repository source and run
the validated `defineDetector` module initialization when statically imported.
They are not sandboxed. The registry does not discover or load arbitrary
third-party modules at runtime; only each module's default `DetectorDefinition`
export is included in the generated collection.

## Security constraints

Registry tooling rejects absolute paths, backslashes, empty path segments,
`.`/`..` traversal, paths outside the detector directory, symbolic links,
invalid UTF-8, missing or oversized files, unexpected directory entries, and
malformed or unsupported JSON fields. Discovery uses Node path APIs and emits
portable forward-slash module specifiers. Ordering uses a locale-independent
ASCII comparison so results do not depend on filesystem or operating-system
enumeration order.

The tooling rejects symbolic links and junctions reported by Node as symbolic
links. Like ordinary build tools, validation assumes the detector tree is not
being concurrently replaced during a run; it is not a sandbox against a local
process racing filesystem checks.

## Current catalog

The initial production catalog contains eight focused detectors:

- `docker/daemon-unavailable`
- `git/non-fast-forward-push`
- `git/not-a-repository`
- `node/module-not-found`
- `npm/eresolve-peer-dependency`
- `npm/missing-script`
- `pnpm/outdated-lockfile`
- `typescript/cannot-find-module`

The contributor workflow is documented in
[`../DETECTOR_GUIDE.md`](../DETECTOR_GUIDE.md).
