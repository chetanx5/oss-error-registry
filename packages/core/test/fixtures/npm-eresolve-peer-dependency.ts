import type { DetectorDefinition } from "@oss-error-registry/core";

export const npmEresolvePeerDependencyExample = {
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
    "A package's peer dependency range has not been updated for the installed version.",
  ],
  diagnosticSteps: [
    {
      description: "Inspect why npm selected the conflicting package version.",
      command: "npm explain <package-name>",
    },
  ],
  remediation: [
    {
      description:
        "Review the conflicting peer dependency ranges before changing versions.",
      safety: "safe",
    },
    {
      description:
        "Align the direct dependency versions after reviewing compatibility notes.",
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
} as const satisfies DetectorDefinition;
