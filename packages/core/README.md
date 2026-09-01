# `@oss-error-registry/core`

Detector contracts, runtime validation, and the bounded deterministic matching
engine for OSS Error Registry.

> Version `0.1.1` is prepared as an installability hotfix but has not yet been
> published. Do not use the `0.1.0` package set. Requires Node.js 22.13.0 or
> newer and uses ESM.

## Install

After the `0.1.1` publication:

```sh
npm install @oss-error-registry/core
```

For repository development, use the root pnpm workspace instead of installing
this package separately.

## Usage

```ts
import {
  analyze,
  defineDetector,
  type AnalysisResult,
} from "@oss-error-registry/core";

const detector = defineDetector({
  schemaVersion: 1,
  id: "node/module-not-found",
  ecosystem: "node",
  title: "CommonJS module cannot be resolved",
  explanation: "Node.js could not resolve a module requested by CommonJS.",
  match: {
    threshold: 100,
    evidence: [
      {
        id: "cannot-find-module",
        description: "Node.js emitted its Cannot find module error.",
        weight: 100,
        required: true,
        pattern: {
          kind: "substring",
          value: "Error: Cannot find module '",
          caseSensitive: true,
        },
      },
    ],
    exclusions: [],
  },
  likelyCauses: ["The requested package is not installed or resolvable."],
  diagnosticSteps: [{ description: "Inspect the requested module name." }],
  remediation: [
    {
      description: "Verify the package name before changing dependencies.",
      safety: "safe",
    },
  ],
  documentation: [
    {
      title: "Node.js CommonJS module loading",
      url: "https://nodejs.org/api/modules.html#loading-from-node_modules-folders",
    },
  ],
});

const result: AnalysisResult = analyze(
  "Error: Cannot find module 'example-package'",
  [detector],
);
```

The package root exports `analyze()`, detector/plugin definition helpers,
analysis limits and errors, and their TypeScript types. Internal modules are not
exported as package subpaths.

Core accepts text and detector data only. It does not read files, load a
registry, format output, execute commands, access a network, or send telemetry.

See the
[repository README](https://github.com/chetanx5/oss-error-registry#readme),
[detector contract](https://github.com/chetanx5/oss-error-registry/blob/main/docs/detector-contract.md),
and
[matching semantics](https://github.com/chetanx5/oss-error-registry/blob/main/docs/matching-engine.md).
