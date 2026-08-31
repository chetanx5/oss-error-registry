# `@oss-error-registry/reporter`

Deterministic human-readable and versioned JSON formatting for OSS Error
Registry analysis results.

> Version `0.1.0` is prepared but has not yet been published to npm. Requires
> Node.js 22.13.0 or newer and uses ESM.

## Install

After publication:

```sh
npm install @oss-error-registry/core @oss-error-registry/reporter
```

## Usage

```ts
import type { AnalysisResult } from "@oss-error-registry/core";
import { formatJson, formatPretty } from "@oss-error-registry/reporter";

declare const result: AnalysisResult;

const terminalText = formatPretty(result);
const jsonText = formatJson(result);
```

The package root exports only `formatPretty()` and `formatJson()`. Both return a
string, preserve the input result, use fixed field ordering, and produce
byte-identical output for the same analysis.

Formatting does not analyze input, load detectors, read files, execute commands,
add timestamps or machine-specific values, access a network, or send telemetry.
Pretty output neutralizes non-printing terminal controls.

See the
[repository README](https://github.com/chetanx5/oss-error-registry#readme) and
[reporter contract](https://github.com/chetanx5/oss-error-registry/blob/main/docs/reporter.md).
