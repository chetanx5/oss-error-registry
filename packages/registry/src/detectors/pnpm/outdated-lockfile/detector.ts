import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
  schemaVersion: 1,
  id: "pnpm/outdated-lockfile",
  ecosystem: "pnpm",
  title: "Outdated pnpm lockfile",
  explanation:
    "pnpm cannot complete a frozen installation because pnpm-lock.yaml no longer describes the current package manifest.",
  match: {
    threshold: 70,
    evidence: [
      {
        id: "pnpm-error-code",
        description: "pnpm emitted its outdated lockfile error code.",
        weight: 70,
        required: true,
        pattern: {
          kind: "substring",
          value: "ERR_PNPM_OUTDATED_LOCKFILE",
          caseSensitive: true,
        },
      },
      {
        id: "frozen-lockfile-message",
        description:
          "The installation explains that frozen lockfile mode failed.",
        weight: 30,
        required: false,
        pattern: {
          kind: "substring",
          value: 'Cannot install with "frozen-lockfile"',
          caseSensitive: true,
        },
      },
    ],
    exclusions: [
      {
        kind: "substring",
        value: "npm ERR! code ERESOLVE",
        caseSensitive: true,
      },
    ],
  },
  likelyCauses: [
    "A package.json dependency changed without regenerating pnpm-lock.yaml.",
    "A merge resolved package.json and pnpm-lock.yaml inconsistently.",
    "The lockfile was generated with workspace state that is not present in the current checkout.",
  ],
  diagnosticSteps: [
    {
      description: "Review manifest and lockfile changes together.",
      command: "git diff -- package.json pnpm-lock.yaml",
    },
    {
      description:
        "Check whether the environment explicitly enables frozen lockfile mode.",
      command: "pnpm config get frozen-lockfile",
    },
  ],
  remediation: [
    {
      description:
        "Regenerate the lockfile with the repository's expected pnpm version, review the diff, and commit it with the manifest change.",
      safety: "review",
      command: "pnpm install",
    },
    {
      description:
        "Restore unintended package.json changes when the committed lockfile is already authoritative.",
      safety: "review",
    },
  ],
  documentation: [
    {
      title: "pnpm ERR_PNPM_OUTDATED_LOCKFILE",
      url: "https://pnpm.io/errors#err_pnpm_outdated_lockfile",
    },
  ],
});
