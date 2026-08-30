import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
  schemaVersion: 1,
  id: "git/not-a-repository",
  ecosystem: "git",
  title: "Current directory is not a Git repository",
  explanation:
    "Git could not find repository metadata in the current directory or any permitted parent directory.",
  match: {
    threshold: 80,
    evidence: [
      {
        id: "not-a-repository-fatal",
        description: "Git emitted its fatal not-a-repository message.",
        weight: 80,
        required: true,
        pattern: {
          kind: "substring",
          value: "fatal: not a git repository",
          caseSensitive: true,
        },
      },
      {
        id: "parent-search-message",
        description:
          "Git reports that it searched parent directories for .git metadata.",
        weight: 20,
        required: false,
        pattern: {
          kind: "substring",
          value: "(or any of the parent directories): .git",
          caseSensitive: true,
        },
      },
    ],
    exclusions: [
      {
        kind: "substring",
        value: "fatal: repository '",
        caseSensitive: true,
      },
    ],
  },
  likelyCauses: [
    "The command was run outside the intended repository checkout.",
    "The repository's .git directory or gitfile is missing or inaccessible.",
    "A script changed its working directory before invoking Git.",
  ],
  diagnosticSteps: [
    {
      description: "Ask Git for the current repository root.",
      command: "git rev-parse --show-toplevel",
    },
    {
      description:
        "Confirm the current directory before retrying the Git command.",
    },
  ],
  remediation: [
    {
      description: "Change to the intended existing repository directory.",
      safety: "safe",
    },
    {
      description:
        "Initialize a new repository only when this directory is intentionally a new project.",
      safety: "review",
      command: "git init",
    },
  ],
  documentation: [
    {
      title: "git init documentation",
      url: "https://git-scm.com/docs/git-init",
    },
  ],
});
