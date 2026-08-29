import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
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
    exclusions: [],
  },
  likelyCauses: [
    "Two packages require incompatible versions of the same peer dependency.",
    "A package's peer dependency range does not include the installed version.",
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
        "Align direct dependency versions after reviewing compatibility notes.",
      safety: "review",
      command: "npm install <package-name>@<compatible-version>",
    },
  ],
  documentation: [
    {
      title: "npm peer dependency configuration",
      url: "https://docs.npmjs.com/files/package.json#peerdependencies",
    },
  ],
});
