import { describe, expect, it } from "vitest";

import { analyze, defineDetector } from "@oss-error-registry/core";
import { formatJson, formatPretty } from "@oss-error-registry/reporter";

describe("core reporter integration", () => {
  it("formats the complete immutable guidance returned by analyze", () => {
    const detector = defineDetector({
      schemaVersion: 1,
      id: "test/reporter-integration",
      ecosystem: "test",
      title: "Reporter integration",
      explanation: "The integration signal matched.",
      match: {
        threshold: 100,
        evidence: [
          {
            id: "integration-signal",
            description: "The test input contains the integration signal.",
            weight: 100,
            required: true,
            pattern: {
              kind: "substring",
              value: "integration signal",
              caseSensitive: true,
            },
          },
        ],
        exclusions: [],
      },
      likelyCauses: ["The integration fixture intentionally matched."],
      diagnosticSteps: [
        {
          description: "Inspect the inert diagnostic command.",
          command: "inspect --integration",
        },
      ],
      remediation: [
        {
          description: "Review the inert remediation command.",
          safety: "review",
          command: "repair --integration",
        },
      ],
      documentation: [
        {
          title: "Integration documentation",
          url: "https://example.com/reporter-integration",
        },
      ],
    });

    const result = analyze("integration signal", [detector]);
    const pretty = formatPretty(result);
    const json = JSON.parse(formatJson(result)) as {
      matches: Array<Record<string, unknown>>;
    };

    expect(pretty).toContain("Detector ID: test/reporter-integration");
    expect(pretty).toContain("The integration signal matched.");
    expect(pretty).toContain("Command: inspect --integration");
    expect(pretty).toContain("Command: repair --integration");
    expect(json.matches[0]).toMatchObject({
      detectorId: "test/reporter-integration",
      score: 100,
      explanation: "The integration signal matched.",
      likelyCauses: ["The integration fixture intentionally matched."],
      diagnosticSteps: [{ command: "inspect --integration" }],
      remediation: [{ safety: "review", command: "repair --integration" }],
      documentation: [
        {
          title: "Integration documentation",
          url: "https://example.com/reporter-integration",
        },
      ],
    });
    expect(Object.isFrozen(result.matches[0]?.diagnosticSteps[0])).toBe(true);
  });
});
