import { describe, expect, it } from "vitest";

import { analyze } from "@oss-error-registry/core";

import {
  createTestDetector,
  regexEvidence,
  substringEvidence,
} from "./fixtures/test-detector.js";

describe("substring matching", () => {
  it("matches a case-sensitive literal", () => {
    const detector = createTestDetector({
      id: "test/case-sensitive",
      evidence: [substringEvidence("signal", "Build Failed", 50)],
    });

    expect(analyze("Build Failed", [detector]).matches).toHaveLength(1);
  });

  it("does not fold case for a case-sensitive literal", () => {
    const detector = createTestDetector({
      id: "test/case-sensitive-miss",
      evidence: [substringEvidence("signal", "Build Failed", 50)],
    });

    expect(analyze("build failed", [detector]).matches).toEqual([]);
  });

  it("matches case-insensitively when requested", () => {
    const detector = createTestDetector({
      id: "test/case-insensitive",
      evidence: [substringEvidence("signal", "Build Failed", 50, false, false)],
    });

    expect(analyze("BUILD FAILED", [detector]).matches).toHaveLength(1);
  });

  it("defaults omitted case sensitivity to case-insensitive matching", () => {
    const detector = createTestDetector({
      id: "test/default-case-insensitive",
      evidence: [
        {
          id: "signal",
          description: "Case-insensitive default.",
          weight: 50,
          required: false,
          pattern: { kind: "substring", value: "Build Failed" },
        },
      ],
    });

    expect(analyze("build failed", [detector]).matches).toHaveLength(1);
  });

  it("uses deterministic Unicode-aware case-insensitive matching", () => {
    const detector = createTestDetector({
      id: "test/unicode-case-insensitive",
      evidence: [substringEvidence("signal", "CAFÉ", 50, false, false)],
    });

    expect(analyze("café", [detector]).matches).toHaveLength(1);
  });

  it("treats regular-expression characters as literal text", () => {
    const detector = createTestDetector({
      id: "test/literal-special-characters",
      evidence: [substringEvidence("signal", "Error: [foo] + bar?", 50)],
    });

    expect(analyze("Error: [foo] + bar?", [detector]).matches).toHaveLength(1);
    expect(analyze("Error: f + barrrrr", [detector]).matches).toEqual([]);
  });
});

describe("regular-expression matching", () => {
  it("matches an input-scoped expression against the full normalized input", () => {
    const detector = createTestDetector({
      id: "test/regex-input",
      evidence: [regexEvidence("signal", "first\\nsecond", 50)],
    });

    expect(analyze("first\nsecond", [detector]).matches).toHaveLength(1);
  });

  it("defaults an omitted regex scope to the full input", () => {
    const detector = createTestDetector({
      id: "test/regex-default-input",
      evidence: [
        {
          id: "signal",
          description: "Default input scope.",
          weight: 50,
          required: false,
          pattern: { kind: "regex", source: "first\\nsecond" },
        },
      ],
    });

    expect(analyze("first\nsecond", [detector]).matches).toHaveLength(1);
  });

  it("matches a line-scoped expression against individual lines", () => {
    const detector = createTestDetector({
      id: "test/regex-line",
      evidence: [regexEvidence("signal", "^target line$", 50, false, "line")],
    });

    expect(
      analyze("before\ntarget line\nafter", [detector]).matches,
    ).toHaveLength(1);
  });

  it("does not let a line-scoped expression match across lines", () => {
    const detector = createTestDetector({
      id: "test/regex-line-miss",
      evidence: [regexEvidence("signal", "first\\nsecond", 50, false, "line")],
    });

    expect(analyze("first\nsecond", [detector]).matches).toEqual([]);
  });

  it("does not leak regular-expression state across lines or analyses", () => {
    const detector = createTestDetector({
      id: "test/regex-state",
      evidence: [regexEvidence("signal", "^target$", 50, false, "line")],
    });
    const input = "miss\ntarget\ntarget";

    expect(analyze(input, [detector])).toEqual(analyze(input, [detector]));
  });

  it("revalidates manually constructed regex flags before matching", () => {
    const base = createTestDetector({
      id: "test/stateful-flag-rejected",
      evidence: [regexEvidence("signal", "target", 50)],
    });
    const evidence = base.match.evidence[0];
    const detector = {
      ...base,
      match: {
        ...base.match,
        evidence: [
          {
            ...evidence,
            pattern: { kind: "regex", source: "target", flags: "g" },
          },
        ],
      },
    } as const;

    expect(() => analyze("target", [detector])).toThrowError(
      'pattern.flags contains unsupported flag "g"',
    );
  });
});

describe("evidence scoring", () => {
  it("scores one matching optional evidence rule", () => {
    const detector = createTestDetector({
      id: "test/one-optional",
      threshold: 30,
      evidence: [substringEvidence("optional", "signal", 30)],
    });

    expect(analyze("signal", [detector]).matches[0]).toMatchObject({
      score: 30,
      matchedEvidenceIds: ["optional"],
    });
  });

  it("adds multiple matching evidence weights", () => {
    const detector = createTestDetector({
      id: "test/multiple-evidence",
      threshold: 70,
      evidence: [
        substringEvidence("first", "alpha", 30),
        substringEvidence("second", "beta", 40),
      ],
    });

    expect(analyze("alpha beta", [detector]).matches[0]).toMatchObject({
      score: 70,
      matchedEvidenceIds: ["first", "second"],
    });
  });

  it("counts one evidence rule only once when its text occurs repeatedly", () => {
    const detector = createTestDetector({
      id: "test/repeated-occurrence",
      threshold: 40,
      evidence: [substringEvidence("signal", "repeat", 40)],
    });

    expect(analyze("repeat repeat repeat", [detector]).matches[0]?.score).toBe(
      40,
    );
  });

  it("accepts a detector when required evidence is present", () => {
    const detector = createTestDetector({
      id: "test/required-present",
      threshold: 60,
      evidence: [substringEvidence("required", "required", 60, true)],
    });

    expect(analyze("required", [detector]).matches).toHaveLength(1);
  });

  it("rejects a detector when required evidence is absent", () => {
    const detector = createTestDetector({
      id: "test/required-absent",
      threshold: 50,
      evidence: [
        substringEvidence("optional", "optional", 100),
        substringEvidence("required", "required", 1, true),
      ],
    });

    expect(analyze("optional", [detector]).matches).toEqual([]);
  });

  it("matches when the score reaches the threshold exactly", () => {
    const detector = createTestDetector({
      id: "test/exact-threshold",
      threshold: 75,
      evidence: [substringEvidence("signal", "signal", 75)],
    });

    expect(analyze("signal", [detector]).matches[0]?.score).toBe(75);
  });

  it("does not match below the threshold", () => {
    const detector = createTestDetector({
      id: "test/below-threshold",
      threshold: 76,
      evidence: [substringEvidence("signal", "signal", 75)],
    });

    expect(analyze("signal", [detector]).matches).toEqual([]);
  });

  it("caps the evidence score at 100", () => {
    const detector = createTestDetector({
      id: "test/score-cap",
      threshold: 100,
      evidence: [
        substringEvidence("first", "alpha", 80),
        substringEvidence("second", "beta", 70),
      ],
    });

    expect(analyze("alpha beta", [detector]).matches[0]?.score).toBe(100);
  });

  it("gives unmatched optional evidence a zero contribution", () => {
    const detector = createTestDetector({
      id: "test/unmatched-zero",
      threshold: 40,
      evidence: [
        substringEvidence("matched", "present", 40),
        substringEvidence("unmatched", "absent", 60),
      ],
    });

    expect(analyze("present", [detector]).matches[0]).toMatchObject({
      score: 40,
      matchedEvidenceIds: ["matched"],
    });
  });

  it("counts repeated required evidence only once", () => {
    const detector = createTestDetector({
      id: "test/repeated-required",
      threshold: 45,
      evidence: [substringEvidence("required", "required", 45, true)],
    });

    expect(
      analyze("required required required", [detector]).matches[0],
    ).toMatchObject({ score: 45, matchedEvidenceIds: ["required"] });
  });

  it("does not let evidence declaration order change match or score", () => {
    const optional = substringEvidence("optional", "optional", 60);
    const required = substringEvidence("required", "required", 40, true);
    const first = createTestDetector({
      id: "test/evidence-order-first",
      threshold: 100,
      evidence: [optional, required],
    });
    const second = createTestDetector({
      id: "test/evidence-order-second",
      threshold: 100,
      evidence: [required, optional],
    });

    expect(analyze("optional required", [first]).matches[0]?.score).toBe(100);
    expect(analyze("optional required", [second]).matches[0]?.score).toBe(100);
  });

  it("does not let evidence order change work-limit behavior", () => {
    const optional = substringEvidence("optional", "optional", 60);
    const required = substringEvidence("required", "required", 40, true);
    const first = createTestDetector({
      id: "test/bounded-order-first",
      threshold: 100,
      evidence: [optional, required],
    });
    const second = createTestDetector({
      id: "test/bounded-order-second",
      threshold: 100,
      evidence: [required, optional],
    });

    expect(() =>
      analyze("optional", [first], { maxPatternEvaluations: 1 }),
    ).toThrowError("Analysis exceeded the maximum of 1 pattern evaluations.");
    expect(() =>
      analyze("optional", [second], { maxPatternEvaluations: 1 }),
    ).toThrowError("Analysis exceeded the maximum of 1 pattern evaluations.");
  });
});

describe("exclusions", () => {
  const detector = createTestDetector({
    id: "test/exclusion",
    threshold: 100,
    evidence: [substringEvidence("signal", "perfect evidence", 100, true)],
    exclusions: [
      { kind: "substring", value: "other tool", caseSensitive: false },
    ],
  });

  it("allows a detector when its exclusion is absent", () => {
    expect(analyze("perfect evidence", [detector]).matches).toHaveLength(1);
  });

  it("rejects a detector when an exclusion is present", () => {
    expect(analyze("other tool", [detector]).matches).toEqual([]);
  });

  it("lets an exclusion override otherwise perfect evidence", () => {
    expect(
      analyze("perfect evidence from OTHER TOOL", [detector]).matches,
    ).toEqual([]);
  });

  it("rejects when any of multiple exclusions matches", () => {
    const multiple = createTestDetector({
      id: "test/multiple-exclusions",
      threshold: 100,
      evidence: [substringEvidence("signal", "perfect evidence", 100)],
      exclusions: [
        { kind: "substring", value: "first veto", caseSensitive: true },
        { kind: "substring", value: "second veto", caseSensitive: true },
      ],
    });

    expect(
      analyze("perfect evidence with second veto", [multiple]).matches,
    ).toEqual([]);
  });

  it("supports line-scoped regex exclusions", () => {
    const lineExclusion = createTestDetector({
      id: "test/line-exclusion",
      threshold: 100,
      evidence: [substringEvidence("signal", "perfect evidence", 100)],
      exclusions: [{ kind: "regex", source: "^veto$", scope: "line" }],
    });

    expect(analyze("perfect evidence\nveto", [lineExclusion]).matches).toEqual(
      [],
    );
  });

  it("supports input-scoped regex exclusions", () => {
    const inputExclusion = createTestDetector({
      id: "test/input-exclusion",
      threshold: 100,
      evidence: [substringEvidence("signal", "perfect evidence", 100)],
      exclusions: [
        { kind: "regex", source: "other\\s+tool", flags: "i", scope: "input" },
      ],
    });

    expect(
      analyze("perfect evidence from OTHER tool", [inputExclusion]).matches,
    ).toEqual([]);
  });

  it("does not let exclusion order change work-limit behavior", () => {
    const matching = {
      kind: "substring" as const,
      value: "veto",
      caseSensitive: true,
    };
    const missing = {
      kind: "substring" as const,
      value: "missing",
      caseSensitive: true,
    };
    const first = createTestDetector({
      id: "test/bounded-exclusion-first",
      evidence: [substringEvidence("signal", "signal", 50)],
      exclusions: [matching, missing],
    });
    const second = createTestDetector({
      id: "test/bounded-exclusion-second",
      evidence: [substringEvidence("signal", "signal", 50)],
      exclusions: [missing, matching],
    });

    expect(() =>
      analyze("veto signal", [first], { maxPatternEvaluations: 1 }),
    ).toThrowError("Analysis exceeded the maximum of 1 pattern evaluations.");
    expect(() =>
      analyze("veto signal", [second], { maxPatternEvaluations: 1 }),
    ).toThrowError("Analysis exceeded the maximum of 1 pattern evaluations.");
  });
});
