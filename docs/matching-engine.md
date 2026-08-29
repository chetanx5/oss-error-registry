# Matching engine

`@oss-error-registry/core` exposes `analyze()` for deterministic, offline
evaluation of validated detector definitions against error or log text:

```ts
import {
  analyze,
  defineDetector,
  type AnalysisResult,
} from "@oss-error-registry/core";

const result: AnalysisResult = analyze(errorText, [detector]);
```

Core accepts text and detector objects only. It does not read files or stdin,
load a registry, access a network, format terminal output, or execute commands.

## Normalization

Before matching, `analyze()`:

1. requires a string containing non-whitespace text;
2. enforces the configured UTF-8 byte limit;
3. strips ANSI/VT terminal control sequences; and
4. converts CRLF and CR line endings to LF.

It does not lowercase or otherwise rewrite the error text. The default and hard
maximum input limit is `MAX_ANALYSIS_INPUT_BYTES` (1,048,576 bytes, or 1 MiB).
`maxInputBytes` may impose a lower per-call limit. `normalizedInputLength` is
the normalized JavaScript string length in UTF-16 code units.

## Pattern matching

Substring patterns use literal substring semantics. Regular-expression syntax
inside a substring value has no special meaning. `caseSensitive: true` preserves
case; omitted or `false` uses case-insensitive matching without changing the
normalized input. Case-insensitive substring matching follows deterministic
ECMAScript Unicode-aware (`iu`) case-folding semantics.

Regex patterns are constructed from the source and restricted flags accepted by
`defineDetector()`. An omitted scope defaults to `input`. Input scope evaluates
the normalized full input once. Line scope evaluates each normalized line and
stops at the first matching line. A new `RegExp` is created for each pattern
evaluation, and its state is reset before every test.

## Exclusions, required evidence, and scoring

Exclusions are evaluated first. Any matching exclusion vetoes the detector,
regardless of its positive evidence.

Every required evidence rule must match. A missing required rule rejects the
detector even when optional evidence reaches the threshold. Each matching rule
contributes its weight once; repeated occurrences do not add weight repeatedly.
The evidence score is capped at 100, and a detector matches when the score is at
least its threshold.

The score is a deterministic evidence-point total. It is **not** a probability
or statistical confidence percentage.

## Ordering and result bounds

Matches are ordered by score descending, then by ASCII detector ID ascending.
Duplicate detector IDs are rejected so ordering remains unambiguous. Results do
not contain timestamps, random identifiers, or filesystem paths.

The default result limit is `DEFAULT_MAX_RESULTS` (10). `maxResults` accepts an
integer from 1 through `MAX_ANALYSIS_RESULTS` (100). The engine retains only the
best requested number of matches while it evaluates the complete collection.
Returned result objects and arrays are frozen.

## Work bounds and errors

Analysis accepts at most `MAX_ANALYSIS_DETECTORS` (1,000) detectors. Pattern
arrays are also bounded to a combined `MAX_ANALYSIS_PATTERNS_PER_DETECTOR` (100)
evidence and exclusion patterns per detector. Every detector is structurally
revalidated at the analysis boundary, so manually constructed valid definitions
are accepted and unsafe definitions are rejected before matching. Pattern tests
share a deterministic evaluation budget: 100,000 by default and at most
`MAX_ANALYSIS_PATTERN_EVALUATIONS` (1,000,000). `maxPatternEvaluations` may
request a value within that range. A line-scoped regex consumes one evaluation
per tested line; other patterns consume one evaluation.

Invalid input, oversized input, invalid options, invalid detector collections,
and exhausted work budgets produce specific `AnalysisError` subclasses. An input
limit and an evaluation count cannot guarantee a time bound for every JavaScript
regular expression. Detector validation rejects common dangerous constructs, but
detector authors must still prefer simple, anchored patterns.

Diagnostic and remediation `command` fields remain inert metadata. The engine
does not import a process API, invoke a shell, evaluate strings, or return those
commands in match results.
