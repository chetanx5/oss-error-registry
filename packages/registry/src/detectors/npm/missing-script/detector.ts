import { defineDetector } from "@oss-error-registry/core";

export default defineDetector({
  schemaVersion: 1,
  id: "npm/missing-script",
  ecosystem: "npm",
  title: "Missing npm package script",
  explanation:
    "npm was asked to run a script name that is not defined in the selected package.json scripts object.",
  match: {
    threshold: 70,
    evidence: [
      {
        id: "npm-missing-script",
        description: "npm reported a quoted missing script name.",
        weight: 70,
        required: true,
        pattern: {
          kind: "regex",
          source:
            "^npm (?:ERR!|error) [Mm]issing script: (?:\"[^\"]+\"|'[^']+'|\\S+)$",
          scope: "line",
        },
      },
      {
        id: "list-scripts-hint",
        description: "npm suggested listing the available package scripts.",
        weight: 20,
        required: false,
        pattern: {
          kind: "regex",
          source: "^npm (?:ERR!|error) To see a list of scripts, run:$",
          scope: "line",
        },
      },
      {
        id: "npm-run-hint",
        description: "npm printed its npm run hint.",
        weight: 10,
        required: false,
        pattern: {
          kind: "regex",
          source: "^npm (?:ERR!|error)\\s+npm run$",
          scope: "line",
        },
      },
    ],
    exclusions: [
      {
        kind: "substring",
        value: "ERR_PNPM_",
        caseSensitive: true,
      },
    ],
  },
  likelyCauses: [
    "The requested script name is misspelled or uses different casing.",
    "The command is running in a workspace package whose package.json does not define that script.",
    "The script was removed or renamed without updating automation that invokes it.",
  ],
  diagnosticSteps: [
    {
      description: "List the scripts defined by the selected package.",
      command: "npm run",
    },
    {
      description: "Confirm which package directory npm is using.",
      command: "npm prefix",
    },
  ],
  remediation: [
    {
      description: "Run the intended script using its exact package.json name.",
      safety: "review",
    },
    {
      description:
        "Add or rename the package.json script after reviewing the command it will execute.",
      safety: "review",
    },
  ],
  documentation: [
    {
      title: "npm run command",
      url: "https://docs.npmjs.com/cli/v11/commands/npm-run/",
    },
  ],
});
