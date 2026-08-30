# Detector guide

This guide describes the complete workflow for adding one production detector.
No central registry list or detector-specific test file needs to be edited.

## 1. Choose a real, specific error

A good detector represents a stable error signature emitted by a known tool. It
should be useful even without internet access and specific enough that a nearby
error can be represented by a negative fixture.

Before adding it:

- confirm the detector ID does not already exist;
- prefer stable error codes and exact tool prefixes over broad words such as
  `failed` or `error`;
- identify at least one realistic positive and negative log; and
- find authoritative HTTPS documentation for the error or relevant tool
  behavior.

## 2. Create one self-contained directory

```text
packages/registry/src/detectors/<ecosystem>/<detector-name>/
  detector.ts
  cases.json
  fixtures/
    positive/
    negative/
```

`<ecosystem>` and `<detector-name>` must use lowercase kebab-case. Their joined
value is the detector ID:

```text
<ecosystem>/<detector-name>
```

For example, directory `pnpm/outdated-lockfile` must contain a detector whose
`id` is `pnpm/outdated-lockfile` and whose `ecosystem` is `pnpm`.

The detector directory may contain only `detector.ts`, `cases.json`, and
`fixtures/`. The fixtures directory may contain only `positive/` and
`negative/`. Symbolic links and junction-like symbolic-link entries are
rejected.

## 3. Define the detector

`detector.ts` must contain exactly one import and one default export:

```ts
import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
  schemaVersion: 1,
  id: "tool/example-error",
  ecosystem: "tool",
  title: "Short diagnosis title",
  explanation: "What the error means and what operation failed.",
  match: {
    threshold: 80,
    evidence: [
      {
        id: "stable-error-code",
        description: "The tool emitted its stable error code.",
        weight: 80,
        required: true,
        pattern: {
          kind: "substring",
          value: "TOOL_ERROR_CODE",
          caseSensitive: true,
        },
      },
    ],
    exclusions: [],
  },
  likelyCauses: ["A concrete, plausible cause."],
  diagnosticSteps: [
    {
      description: "A safe investigation step.",
      command: "tool inspect",
    },
  ],
  remediation: [
    {
      description: "A conservative correction.",
      safety: "review",
    },
  ],
  documentation: [
    {
      title: "Official tool documentation",
      url: "https://example.com/official-documentation",
    },
  ],
});
```

The object must be declarative data. Extra imports or exports, functions,
callbacks, spreads, computed properties, getters, dynamic expressions, and
executable hooks are rejected.

### Evidence and thresholds

Every evidence rule needs a unique lowercase-friendly ID, description, integer
weight from 1 through 100, `required` flag, and pattern. Required evidence is a
gate: every required rule must match. Matched weights are summed and capped at
100; the result must meet `threshold`. The score is an evidence score, not a
probability.

Use:

- `substring` for stable literal text;
- `regex` only when a small variable portion must be represented;
- `scope: "line"` when an expression should not cross lines; and
- exclusions to veto recognizable nearby errors that could otherwise satisfy the
  evidence.

Regex flags are limited to `i`, `m`, and `u`. Keep expressions simple and
bounded; unsafe constructs and oversized sources are rejected.

### Guidance fields

- `title` names the diagnosis, not the raw symptom.
- `explanation` states what failed without promising a single cause.
- `likelyCauses` lists concrete plausible causes.
- `diagnosticSteps` starts with read-only investigation where possible.
- `remediation` uses `safe` for low-risk guidance and `review` for changes that
  can alter dependencies, configuration, files, history, or services.
- `documentation` contains descriptive titles and authoritative HTTPS URLs.

Command fields are printed as inert guidance. The engine and CLI never execute
them. Do not use that fact to recommend destructive or unexplained commands.

The complete schema and matching semantics are documented in
[`docs/detector-contract.md`](docs/detector-contract.md) and
[`docs/matching-engine.md`](docs/matching-engine.md).

## 4. Add `cases.json`

Every detector needs at least one positive and one negative case:

```json
{
  "detectorId": "tool/example-error",
  "cases": [
    {
      "name": "standard tool failure",
      "fixture": "fixtures/positive/basic.log",
      "expect": {
        "match": true,
        "score": 80
      }
    },
    {
      "name": "similar error from another tool",
      "fixture": "fixtures/negative/near-miss.log",
      "expect": {
        "match": false
      }
    }
  ]
}
```

Rules:

- `detectorId` must match the directory-derived ID.
- Case names and fixture references must be unique within the detector.
- Positive cases use `fixtures/positive/`, require `match: true`, and require
  the exact expected score.
- Negative cases use `fixtures/negative/`, require `match: false`, and must not
  contain `score`.
- Unknown fields are rejected.
- Every fixture must be referenced exactly once.

Add multiple cases only when they represent meaningful variants, such as stable
Windows and POSIX forms. Do not duplicate a fixture merely to increase counts.

## 5. Add fixtures

Fixtures are UTF-8 `.log` or `.txt` data files. File names use lowercase
letters, digits, dots, underscores, and hyphens. They must be non-empty and no
larger than 1 MiB.

Use the smallest realistic excerpt that preserves the signature. Replace private
data with neutral values such as `example.invalid`, `/workspace`, or
`<package-name>`. Never include credentials, tokens, private repository names,
or personal paths.

Fixtures are read as data and never executed. Paths must use forward slashes in
`cases.json`; absolute paths, traversal, nested fixture paths, backslashes,
symbolic links, unexpected files, and unreferenced files are rejected.

## 6. Generate and test

From the repository root:

```sh
pnpm registry:generate
pnpm registry:check
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

`registry:generate` discovers directories in deterministic ASCII detector-ID
order and rewrites `packages/registry/src/generated/detectors.ts` only when its
static imports change. Do not edit the generated file manually.

The generic registry harness automatically:

- loads every generated detector;
- validates ID and ecosystem alignment;
- checks registry order, uniqueness, and immutability;
- runs every positive case and exact score;
- runs every negative non-match;
- repeats analysis to verify deterministic results; and
- enforces fixture size, encoding, reference, path, and symlink safety.

Common validation failures identify the detector and field involved, including
invalid directory names, mismatched IDs, malformed source or JSON, missing case
types or fixtures, duplicate names or references, unexpected entries, unsafe
paths, duplicate loaded IDs, and generated-index drift.

## 7. Open the pull request

Commit the detector directory and generated index together. The pull request
template asks you to confirm that the error is real, both fixture classes are
present, cases and documentation are complete, and local checks pass. Explain
signature tradeoffs and known version limitations so reviewers can evaluate
false positives and false negatives.
