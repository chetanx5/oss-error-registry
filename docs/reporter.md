# Reporter

`@oss-error-registry/reporter` is a deterministic, side-effect-free
transformation layer for the structured `AnalysisResult` returned by
`@oss-error-registry/core`. It provides human-readable terminal text and stable
machine-readable JSON. It does not analyze input or locate detectors.

## Public API

The package intentionally exports two functions:

```ts
import type { AnalysisResult } from "@oss-error-registry/core";
import { formatJson, formatPretty } from "@oss-error-registry/reporter";

declare const result: AnalysisResult;

const terminalText: string = formatPretty(result);
const jsonText: string = formatJson(result);
```

Both functions return a string and leave `result` unchanged. The reporter
expects a valid `AnalysisResult`; core constructs deeply frozen results, while
tests and other consumers may provide structurally valid synthetic results.

## Pretty format

`formatPretty()` starts with the report status, match count, and normalized
input length. A zero-match report explicitly says that no deterministic
diagnosis matched. Every diagnosis then includes:

- detector ID, ecosystem, and title;
- evidence score and matched evidence IDs;
- explanation and likely causes;
- diagnostic steps and optional informational commands;
- remediation suggestions, their `safe` or `review` classification, and optional
  informational commands; and
- titled documentation URLs.

The formatter emits canonical LF (`\n`) separators, does not add a trailing
newline, does not wrap based on terminal width, and does not emit ANSI color.
CRLF and CR inside report data are normalized to LF. Non-printing C0, DEL, and
C1 terminal controls are rendered as literal lowercase `\uXXXX` escapes;
ordinary Unicode and multiline text are preserved.

The evidence score is the core engine's deterministic evidence-point total out
of 100. It is not a probability.

## JSON format

`formatJson()` returns two-space-indented valid JSON with this version 1 report
shape:

```text
{
  "schemaVersion": 1,
  "status": "no-match" | "matches",
  "matchCount": number,
  "normalizedInputLength": number,
  "matches": [
    {
      "detectorId": string,
      "ecosystem": string,
      "title": string,
      "score": number,
      "matchedEvidenceIds": string[],
      "explanation": string,
      "likelyCauses": string[],
      "diagnosticSteps": [
        { "description": string, "command"?: string }
      ],
      "remediation": [
        {
          "description": string,
          "safety": "safe" | "review",
          "command"?: string
        }
      ],
      "documentation": [{ "title": string, "url": string }]
    }
  ]
}
```

`schemaVersion` versions the reporter JSON schema; it does not replace or
reinterpret a detector definition's schema version. Optional `command` fields
are omitted when absent. The projection excludes matching patterns, functions,
regular expressions, unknown implementation fields, and source object
prototypes. It introduces no timestamp, random identifier, input text,
machine-specific path, or `undefined` value.

JSON escaping preserves string values while ensuring C0, DEL, and C1 terminal
controls are represented by JSON escape sequences rather than raw control bytes.

## Determinism and ordering

Both formatters construct fields in a fixed order and produce byte-identical
output for repeated rendering of the same result. They do not use time,
randomness, locale-sensitive comparison, platform path APIs, or terminal size.

The reporter preserves the order of matches, matched evidence IDs, causes,
steps, remediation suggestions, and references. Those arrays already have
semantic ordering; the reporter does not sort or mutate them. JSON property
ordering is independent of the insertion order of properties on a synthetic
input object.

## Security boundary

All strings are data. The reporter never executes a diagnostic or remediation
command, evaluates detector text, invokes the matching engine, reads files or
stdin, inspects a registry, imports detector modules dynamically, starts a
process, or accesses a network. Its runtime source has no filesystem, network,
shell, or process-input dependency.

Command-looking strings are reproduced only as inert report content. Pretty
output also neutralizes non-printing terminal control characters so detector
metadata cannot introduce active ANSI or terminal control sequences.

## Relationship to other packages

The dependency direction is:

```text
reporter -> core public result types
```

Reporter does not depend on the registry or CLI. The repository CLI chooses one
of the reporter formats after it has obtained an `AnalysisResult`, while keeping
input, argument parsing, and output selection outside the reporter. See
[`cli.md`](cli.md).

## Synthetic example

```ts
import type { AnalysisResult } from "@oss-error-registry/core";
import { formatPretty } from "@oss-error-registry/reporter";

const result = {
  normalizedInputLength: 42,
  matches: [
    {
      detectorId: "npm/example-error",
      ecosystem: "npm",
      title: "Example npm error",
      score: 80,
      matchedEvidenceIds: ["example-code"],
      explanation: "npm reported an example deterministic failure.",
      likelyCauses: ["An example dependency is incompatible."],
      diagnosticSteps: [
        {
          description: "Inspect the selected dependency version.",
          command: "npm explain <package-name>",
        },
      ],
      remediation: [
        {
          description: "Review compatible versions before changing them.",
          safety: "review",
        },
      ],
      documentation: [
        {
          title: "Example documentation",
          url: "https://example.com/npm-error",
        },
      ],
    },
  ],
} as const satisfies AnalysisResult;

const text = formatPretty(result);
```

This example formats already-structured synthetic data directly. CLI behavior is
documented separately in [`cli.md`](cli.md).
