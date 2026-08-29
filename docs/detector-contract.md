# Detector contract

Detectors are declarative, serializable descriptions of recognizable developer
errors. A detector records textual evidence and the guidance to return when the
matching engine identifies that evidence. Detector definitions cannot provide
callbacks, lifecycle hooks, or executable matching code.

The contract is exported by `@oss-error-registry/core`. `defineDetector()` and
`definePlugin()` validate definitions at runtime and freeze accepted objects to
protect shared registry state from accidental mutation.

## IDs and ecosystems

Detector IDs use lowercase kebab-case in this form:

```text
<ecosystem>/<detector-name>
```

For example, `npm/eresolve-peer-dependency` belongs to the `npm` ecosystem. The
`ecosystem` field must exactly equal the ID prefix. Ecosystems are strings, not
a closed TypeScript union, so a new ecosystem does not require a core release.

## Evidence and thresholds

Each evidence rule has a unique ID, description, integer weight from 1 through
100, a `required` boolean, and one text pattern:

- `substring` patterns contain a string and optional case-sensitivity setting.
- `regex` patterns contain regex source text, optional flags, and optional
  `line` or `input` scope. Public definitions never contain `RegExp` objects.

Required evidence acts as a gate: a detector cannot match when any required rule
is absent. Optional evidence can strengthen a diagnosis. The threshold is the
minimum evidence score the matching engine requires. A score is a deterministic
sum of matched evidence weights, not a probability or statistical confidence.

Exclusions are text patterns that veto a detector when present. They help
prevent a signature from claiming similar output produced by another tool.

Regex flags are restricted to `i`, `m`, and `u`. Validation compiles regexes,
limits their length, and rejects numeric backreferences and common nested
quantifiers. These checks reduce obvious risk; the matcher also bounds input
size and pattern-evaluation work. They do not mathematically eliminate every
possible regular-expression denial-of-service condition.

The complete matching semantics are documented in
[`matching-engine.md`](matching-engine.md).

## Guidance

- `likelyCauses` explains plausible reasons for the error.
- `diagnosticSteps` contains investigation steps and optional command text.
- `remediation` contains suggestions marked `safe` or `review`, with optional
  command text.
- `documentation` contains titled HTTPS references.

Commands are informational strings. Core validation stores and freezes them; it
never invokes a shell, starts a process, or executes remediation.

## Plugins

A detector plugin is only a versioned bundle:

```ts
interface DetectorPlugin {
  readonly apiVersion: 1;
  readonly id: string;
  readonly detectors: NonEmptyArray<DetectorDefinition>;
}
```

Plugins must contain at least one detector. They have no hooks and are not
dynamically loaded by the core package.

## Complete example

This example is illustrative and is not part of the production registry:

```ts
import {
  defineDetector,
  type DetectorDefinition,
} from "@oss-error-registry/core";

const npmEresolvePeerDependency = defineDetector({
  schemaVersion: 1,
  id: "npm/eresolve-peer-dependency",
  ecosystem: "npm",
  title: "Peer dependency resolution conflict",
  explanation:
    "npm could not construct a dependency tree that satisfies the declared peer dependency ranges.",
  match: {
    threshold: 80,
    evidence: [
      {
        id: "npm-eresolve-code",
        description: "npm emitted its ERESOLVE error code.",
        weight: 60,
        required: true,
        pattern: {
          kind: "substring",
          value: "npm ERR! code ERESOLVE",
          caseSensitive: true,
        },
      },
      {
        id: "dependency-tree-message",
        description: "The log describes an unresolved dependency tree.",
        weight: 30,
        required: false,
        pattern: {
          kind: "regex",
          source:
            "unable to resolve dependency tree|could not resolve dependency",
          flags: "i",
          scope: "line",
        },
      },
    ],
    exclusions: [
      {
        kind: "substring",
        value: "YN0002",
        caseSensitive: true,
      },
    ],
  },
  likelyCauses: [
    "Two packages require incompatible versions of the same peer dependency.",
  ],
  diagnosticSteps: [
    {
      description: "Inspect why npm selected the conflicting package version.",
      command: "npm explain <package-name>",
    },
  ],
  remediation: [
    {
      description: "Review the conflicting peer dependency ranges.",
      safety: "safe",
    },
    {
      description: "Align versions after reviewing compatibility notes.",
      safety: "review",
      command: "npm install <package-name>@<compatible-version>",
    },
  ],
  documentation: [
    {
      title: "npm peer dependency configuration",
      url: "https://docs.npmjs.com/cli/using-npm/config#legacy-peer-deps",
    },
  ],
} as const satisfies DetectorDefinition);
```
