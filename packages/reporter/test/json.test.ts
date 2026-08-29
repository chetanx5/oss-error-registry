import { describe, expect, it, vi } from "vitest";

import type { AnalysisResult, DetectorMatch } from "@oss-error-registry/core";
import { formatJson } from "@oss-error-registry/reporter";

import { createMatch, createResult, deepFreeze } from "./fixtures/results.js";

describe("formatJson", () => {
  it("renders the versioned zero-match schema", () => {
    const output = formatJson(createResult([], 41));

    expect(output).toBe(
      [
        "{",
        '  "schemaVersion": 1,',
        '  "status": "no-match",',
        '  "matchCount": 0,',
        '  "normalizedInputLength": 41,',
        '  "matches": []',
        "}",
      ].join("\n"),
    );
  });

  it("uses deterministic public property ordering", () => {
    const parsed = JSON.parse(formatJson(createResult())) as Record<
      string,
      unknown
    >;
    const match = (parsed["matches"] as Record<string, unknown>[])[0]!;

    expect(Object.keys(parsed)).toEqual([
      "schemaVersion",
      "status",
      "matchCount",
      "normalizedInputLength",
      "matches",
    ]);
    expect(Object.keys(match)).toEqual([
      "detectorId",
      "ecosystem",
      "title",
      "score",
      "matchedEvidenceIds",
      "explanation",
      "likelyCauses",
      "diagnosticSteps",
      "remediation",
      "documentation",
    ]);
    expect(Object.keys((match["diagnosticSteps"] as object[])[0]!)).toEqual([
      "description",
      "command",
    ]);
    expect(Object.keys((match["remediation"] as object[])[1]!)).toEqual([
      "description",
      "safety",
      "command",
    ]);
    expect(Object.keys((match["documentation"] as object[])[0]!)).toEqual([
      "title",
      "url",
    ]);
  });

  it("omits absent optional commands instead of emitting undefined or null", () => {
    const output = formatJson(
      createResult([
        createMatch({
          diagnosticSteps: [{ description: "Inspect manually." }],
          remediation: [
            {
              description: "Review manually.",
              safety: "review",
            },
          ],
        }),
      ]),
    );
    const parsed = JSON.parse(output) as {
      matches: Array<{
        diagnosticSteps: object[];
        remediation: object[];
      }>;
    };

    expect(parsed.matches[0]?.diagnosticSteps[0]).toEqual({
      description: "Inspect manually.",
    });
    expect(parsed.matches[0]?.remediation[0]).toEqual({
      description: "Review manually.",
      safety: "review",
    });
    expect(output).not.toContain("undefined");
    expect(output).not.toContain(": null");
  });

  it("preserves Unicode and safely escapes multiline and control data", () => {
    const title = 'Ошибка "сборки" 🚨';
    const explanation = "line one\nline two\t\u001B\u007F\u009B";
    const command = 'printf \\"hello\\" && echo windows\\work';
    const output = formatJson(
      createResult([
        createMatch({
          title,
          explanation,
          diagnosticSteps: [{ description: "原因", command }],
        }),
      ]),
    );
    const parsed = JSON.parse(output) as {
      matches: Array<{
        title: string;
        explanation: string;
        diagnosticSteps: Array<{ command: string }>;
      }>;
    };

    expect(parsed.matches[0]).toMatchObject({ title, explanation });
    expect(parsed.matches[0]?.diagnosticSteps[0]?.command).toBe(command);
    expect(output).not.toContain("\u001B");
    expect(output).not.toContain("\u007F");
    expect(output).not.toContain("\u009B");
    expect(output).toContain("\\u001b");
    expect(output).toContain("\\u007f");
    expect(output).toContain("\\u009b");
  });

  it("preserves score boundaries and all semantically ordered arrays", () => {
    const matches = [
      createMatch({
        detectorId: "test/maximum",
        score: 100,
        matchedEvidenceIds: ["z-first", "a-second"],
      }),
      createMatch({ detectorId: "test/minimum", score: 1 }),
    ];
    const parsed = JSON.parse(formatJson(createResult(matches))) as {
      matches: Array<{
        detectorId: string;
        score: number;
        matchedEvidenceIds: string[];
      }>;
    };

    expect(parsed.matches.map(({ detectorId }) => detectorId)).toEqual([
      "test/maximum",
      "test/minimum",
    ]);
    expect(parsed.matches.map(({ score }) => score)).toEqual([100, 1]);
    expect(parsed.matches[0]?.matchedEvidenceIds).toEqual([
      "z-first",
      "a-second",
    ]);
  });

  it("is independent of source object insertion order", () => {
    const normal = createMatch();
    const reordered: DetectorMatch = {
      documentation: normal.documentation,
      remediation: normal.remediation,
      diagnosticSteps: normal.diagnosticSteps,
      likelyCauses: normal.likelyCauses,
      explanation: normal.explanation,
      matchedEvidenceIds: normal.matchedEvidenceIds,
      score: normal.score,
      title: normal.title,
      ecosystem: normal.ecosystem,
      detectorId: normal.detectorId,
    };

    expect(formatJson(createResult([reordered]))).toBe(
      formatJson(createResult([normal])),
    );
  });

  it("serializes only report fields and ignores cyclic implementation data", () => {
    const match = createMatch() as DetectorMatch & {
      implementation?: unknown;
    };
    const implementation: Record<string, unknown> = {
      pattern: /do-not-serialize/gu,
      callback: () => "do-not-call",
    };
    implementation["cycle"] = implementation;
    match.implementation = implementation;

    const output = formatJson(createResult([match]));

    expect(() => JSON.parse(output)).not.toThrow();
    expect(output).not.toContain("implementation");
    expect(output).not.toContain("do-not-serialize");
    expect(output).not.toContain("callback");
  });

  it("is byte-identical across repeated calls and does not use time or randomness", () => {
    const result = createResult();
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");

    const first = formatJson(result);
    const second = formatJson(result);

    expect(second).toBe(first);
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it("accepts a deeply frozen result without mutating it", () => {
    const result: AnalysisResult = deepFreeze(createResult());
    const before = JSON.stringify(result);

    expect(() => formatJson(result)).not.toThrow();
    expect(JSON.stringify(result)).toBe(before);
  });
});
