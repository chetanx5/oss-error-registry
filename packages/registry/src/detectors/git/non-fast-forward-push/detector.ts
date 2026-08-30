import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
  schemaVersion: 1,
  id: "git/non-fast-forward-push",
  ecosystem: "git",
  title: "Git push rejected as non-fast-forward",
  explanation:
    "The remote branch contains history that the local branch does not contain, so Git rejected an update that would not be a fast-forward.",
  match: {
    threshold: 100,
    evidence: [
      {
        id: "non-fast-forward-rejection",
        description:
          "Git marked a pushed ref as rejected for being non-fast-forward.",
        weight: 60,
        required: true,
        pattern: {
          kind: "regex",
          source:
            "^\\s*!\\s+\\[rejected\\]\\s+.+\\s+->\\s+.+\\s+\\(non-fast-forward\\)$",
          scope: "line",
        },
      },
      {
        id: "failed-push-summary",
        description: "Git reported that it failed to push one or more refs.",
        weight: 40,
        required: true,
        pattern: {
          kind: "substring",
          value: "error: failed to push some refs to",
          caseSensitive: true,
        },
      },
    ],
    exclusions: [
      {
        kind: "substring",
        value: "[remote rejected]",
        caseSensitive: true,
      },
    ],
  },
  likelyCauses: [
    "Another contributor pushed commits to the remote branch after the last local fetch.",
    "The local branch was rebased or amended after an earlier version was pushed.",
    "The push targets a different remote branch than expected.",
  ],
  diagnosticSteps: [
    {
      description:
        "Inspect local and known remote branch history before changing it.",
      command: "git log --oneline --graph --decorate --all",
    },
    {
      description: "Confirm the current branch and its configured upstream.",
      command: "git status --short --branch",
    },
  ],
  remediation: [
    {
      description:
        "Fetch the remote branch and review the incoming commits before integrating them.",
      safety: "review",
    },
    {
      description:
        "Merge or rebase according to the repository's contribution policy, resolve conflicts, then push normally.",
      safety: "review",
    },
    {
      description:
        "Do not force-push unless repository owners explicitly confirm that replacing remote history is intended.",
      safety: "safe",
    },
  ],
  documentation: [
    {
      title: "git push fast-forward rules",
      url: "https://git-scm.com/docs/git-push#_note_about_fast_forwards",
    },
  ],
});
