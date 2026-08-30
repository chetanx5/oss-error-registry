import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
  schemaVersion: 1,
  id: "node/module-not-found",
  ecosystem: "node",
  title: "Node.js CommonJS module not found",
  explanation:
    "The Node.js CommonJS loader could not resolve the module requested by require() or by the program entry point.",
  match: {
    threshold: 100,
    evidence: [
      {
        id: "cannot-find-module",
        description: "Node.js reported a quoted unresolved module specifier.",
        weight: 60,
        required: true,
        pattern: {
          kind: "regex",
          source: "^Error: Cannot find module ['\"][^'\"]+['\"]$",
          scope: "line",
        },
      },
      {
        id: "commonjs-error-code",
        description:
          "The error object carries the CommonJS MODULE_NOT_FOUND code.",
        weight: 40,
        required: true,
        pattern: {
          kind: "substring",
          value: "code: 'MODULE_NOT_FOUND'",
          caseSensitive: true,
        },
      },
    ],
    exclusions: [
      {
        kind: "substring",
        value: "error TS2307:",
        caseSensitive: true,
      },
    ],
  },
  likelyCauses: [
    "The dependency is not installed in a node_modules directory visible to the requiring file.",
    "A relative require path or filename has a typo or incorrect letter casing.",
    "The program is running from a different package or build output location than expected.",
  ],
  diagnosticSteps: [
    {
      description:
        "Ask Node.js to resolve the same module from the current package.",
      command: "node -p \"require.resolve('<module-name>')\"",
    },
    {
      description:
        "Inspect which installed package should provide the missing module.",
      command: "npm explain <package-name>",
    },
  ],
  remediation: [
    {
      description: "Correct an invalid relative path or filename casing.",
      safety: "safe",
    },
    {
      description:
        "Add the dependency to the correct package after confirming it is intended runtime code.",
      safety: "review",
      command: "npm install <package-name>",
    },
  ],
  documentation: [
    {
      title: "Node.js CommonJS module loading",
      url: "https://nodejs.org/api/modules.html#loading-from-node_modules-folders",
    },
  ],
});
