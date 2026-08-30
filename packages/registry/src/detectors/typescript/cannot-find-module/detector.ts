import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
  schemaVersion: 1,
  id: "typescript/cannot-find-module",
  ecosystem: "typescript",
  title: "TypeScript cannot resolve a module",
  explanation:
    "TypeScript error TS2307 means the compiler could not resolve an imported module or a corresponding type declaration under the active module-resolution settings.",
  match: {
    threshold: 70,
    evidence: [
      {
        id: "typescript-error-code",
        description:
          "The TypeScript compiler emitted TS2307 for a module import.",
        weight: 70,
        required: true,
        pattern: {
          kind: "substring",
          value: "error TS2307: Cannot find module",
          caseSensitive: true,
        },
      },
      {
        id: "type-declarations-message",
        description:
          "The error mentions the module's corresponding type declarations.",
        weight: 30,
        required: false,
        pattern: {
          kind: "substring",
          value: "or its corresponding type declarations.",
          caseSensitive: true,
        },
      },
    ],
    exclusions: [
      {
        kind: "substring",
        value: "code: 'MODULE_NOT_FOUND'",
        caseSensitive: true,
      },
    ],
  },
  likelyCauses: [
    "The imported package, source file, or type package is missing.",
    "The import specifier has incorrect path segments, extension, or letter casing.",
    "The active moduleResolution, baseUrl, paths, package exports, or project references do not describe the import.",
  ],
  diagnosticSteps: [
    {
      description:
        "Trace how TypeScript attempts to resolve module specifiers.",
      command: "tsc --traceResolution --noEmit",
    },
    {
      description: "Inspect the effective compiler configuration.",
      command: "tsc --showConfig",
    },
  ],
  remediation: [
    {
      description: "Correct an invalid import path or filename casing.",
      safety: "safe",
    },
    {
      description:
        "Install the intended runtime or type dependency in the package that owns the import.",
      safety: "review",
    },
    {
      description:
        "Adjust module-resolution settings only after verifying they match the runtime or bundler.",
      safety: "review",
    },
  ],
  documentation: [
    {
      title: "TypeScript module resolution reference",
      url: "https://www.typescriptlang.org/docs/handbook/modules/reference.html#module-resolution",
    },
  ],
});
