import { describe, expect, it } from "vitest";

import {
  AnalysisError,
  AnalysisInputError,
  AnalysisInputTooLargeError,
  AnalysisOptionsError,
  AnalysisWorkLimitError,
  DetectorCollectionError,
  MAX_ANALYSIS_INPUT_BYTES,
  MAX_ANALYSIS_PATTERN_EVALUATIONS,
  MAX_ANALYSIS_RESULTS,
  analyze,
  type AnalysisOptions,
} from "@oss-error-registry/core";

import {
  createTestDetector,
  regexEvidence,
  substringEvidence,
} from "./fixtures/test-detector.js";

describe("input normalization", () => {
  it("rejects a non-string input", () => {
    expect(() => analyze(42 as never, [])).toThrowError(
      new AnalysisInputError("Analysis input must be a string."),
    );
  });

  it.each(["", " \t\r\n ", "\u001B[31m \u001B[0m"])(
    "rejects empty normalized input %#",
    (input) => {
      expect(() => analyze(input, [])).toThrowError(AnalysisInputError);
    },
  );

  it("normalizes CRLF and CR line endings to LF", () => {
    const detector = createTestDetector({
      id: "test/normalized-lines",
      evidence: [regexEvidence("signal", "^second$", 50, false, "line")],
    });

    const result = analyze("first\r\nsecond\rthird", [detector]);
    expect(result.normalizedInputLength).toBe("first\nsecond\nthird".length);
    expect(result.matches).toHaveLength(1);
  });

  it("strips ANSI terminal control sequences before matching", () => {
    const detector = createTestDetector({
      id: "test/ansi",
      evidence: [substringEvidence("signal", "npm ERR!", 50)],
    });

    const result = analyze("\u001B[31mnpm ERR!\u001B[0m failure", [detector]);
    expect(result.matches).toHaveLength(1);
    expect(result.normalizedInputLength).toBe("npm ERR! failure".length);
  });

  it("preserves normal Unicode text and meaningful surrounding whitespace", () => {
    const detector = createTestDetector({
      id: "test/unicode-preserved",
      evidence: [substringEvidence("signal", "  Ошибка 🚨  ", 50)],
    });
    const input = "  Ошибка 🚨  ";

    const result = analyze(input, [detector]);
    expect(result.normalizedInputLength).toBe(input.length);
    expect(result.matches).toHaveLength(1);
  });

  it("strips a large bounded sequence of ANSI controls predictably", () => {
    const detector = createTestDetector({
      id: "test/many-ansi-controls",
      evidence: [substringEvidence("signal", "error", 50)],
    });
    const input = `${"\u001B[31m".repeat(5_000)}error\u001B[0m`;

    expect(analyze(input, [detector]).matches).toHaveLength(1);
  });
});

describe("input and work bounds", () => {
  it("accepts input at the maximum UTF-8 byte limit", () => {
    const input = "x".repeat(MAX_ANALYSIS_INPUT_BYTES);
    expect(analyze(input, []).normalizedInputLength).toBe(
      MAX_ANALYSIS_INPUT_BYTES,
    );
  });

  it("rejects input above the maximum size", () => {
    const input = "x".repeat(MAX_ANALYSIS_INPUT_BYTES + 1);
    expect(() => analyze(input, [])).toThrowError(AnalysisInputTooLargeError);
  });

  it("measures the input limit in UTF-8 bytes", () => {
    const input = "é".repeat(MAX_ANALYSIS_INPUT_BYTES / 2 + 1);
    expect(() => analyze(input, [])).toThrowError(AnalysisInputTooLargeError);
  });

  it("supports a lower caller-selected input limit", () => {
    expect(() => analyze("12345", [], { maxInputBytes: 4 })).toThrowError(
      new AnalysisInputTooLargeError(4),
    );
  });

  it("applies a lower caller limit at exact UTF-8 byte boundaries", () => {
    expect(analyze("éé", [], { maxInputBytes: 4 }).matches).toEqual([]);
    expect(() => analyze("ééa", [], { maxInputBytes: 4 })).toThrowError(
      new AnalysisInputTooLargeError(4),
    );
  });

  it("handles an extremely long line within the total input limit", () => {
    const detector = createTestDetector({
      id: "test/long-line",
      evidence: [substringEvidence("signal", "END", 50)],
    });
    const input = `${"x".repeat(100_000)}END`;

    expect(analyze(input, [detector]).matches).toHaveLength(1);
  });

  it("handles many lines within the input and work limits", () => {
    const detector = createTestDetector({
      id: "test/many-lines",
      evidence: [regexEvidence("signal", "^target$", 50, false, "line")],
    });
    const input = [
      ...Array.from({ length: 5_000 }, () => "line"),
      "target",
    ].join("\n");

    expect(analyze(input, [detector]).matches).toHaveLength(1);
  });

  it("stops when the pattern-evaluation budget is exhausted", () => {
    const detector = createTestDetector({
      id: "test/work-limit",
      evidence: [regexEvidence("signal", "missing", 50, false, "line")],
    });

    expect(() =>
      analyze("one\ntwo\nthree", [detector], { maxPatternEvaluations: 2 }),
    ).toThrowError(new AnalysisWorkLimitError(2));
  });

  it("accepts work at the exact pattern-evaluation boundary", () => {
    const detector = createTestDetector({
      id: "test/exact-work-limit",
      evidence: [regexEvidence("signal", "missing", 50, false, "line")],
    });

    expect(
      analyze("one\ntwo", [detector], { maxPatternEvaluations: 2 }).matches,
    ).toEqual([]);
  });

  it("reports work-limit exhaustion deterministically", () => {
    const detector = createTestDetector({
      id: "test/deterministic-work-limit",
      evidence: [regexEvidence("signal", "missing", 50, false, "line")],
    });
    const run = (): Error => {
      try {
        analyze("one\ntwo\nthree", [detector], { maxPatternEvaluations: 2 });
      } catch (error) {
        return error as Error;
      }
      throw new Error("Expected analysis to exceed its work limit");
    };

    const first = run();
    const second = run();
    expect({ name: second.name, message: second.message }).toEqual({
      name: first.name,
      message: first.message,
    });
  });
});

describe("analysis option validation", () => {
  it.each([0, -1, 1.5, MAX_ANALYSIS_RESULTS + 1, 1_000_000])(
    "rejects invalid maxResults value %s",
    (maxResults) => {
      expect(() => analyze("input", [], { maxResults })).toThrowError(
        AnalysisOptionsError,
      );
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, "10"])(
    "rejects non-finite or non-number maxResults value %s",
    (maxResults) => {
      expect(() =>
        analyze("input", [], {
          maxResults: maxResults as number,
        }),
      ).toThrowError(AnalysisOptionsError);
    },
  );

  it.each([0, -1, 1.5, MAX_ANALYSIS_INPUT_BYTES + 1])(
    "rejects invalid maxInputBytes value %s",
    (maxInputBytes) => {
      expect(() => analyze("input", [], { maxInputBytes })).toThrowError(
        AnalysisOptionsError,
      );
    },
  );

  it.each([0, -1, 1.5, MAX_ANALYSIS_PATTERN_EVALUATIONS + 1])(
    "rejects invalid maxPatternEvaluations value %s",
    (maxPatternEvaluations) => {
      expect(() =>
        analyze("input", [], { maxPatternEvaluations }),
      ).toThrowError(AnalysisOptionsError);
    },
  );

  it("rejects unknown option fields", () => {
    expect(() =>
      analyze("input", [], { unknown: true } as unknown as AnalysisOptions),
    ).toThrowError('Analysis option "unknown" is not supported.');
  });

  it("rejects option accessors without invoking them", () => {
    let invoked = false;
    const options = Object.defineProperty({}, "maxResults", {
      enumerable: true,
      get() {
        invoked = true;
        return 1;
      },
    });

    expect(() => analyze("input", [], options)).toThrowError(
      'Analysis option "maxResults" must be a data property.',
    );
    expect(invoked).toBe(false);
  });

  it("preserves stable error names and inheritance", () => {
    const inputError = new AnalysisInputError("invalid input");
    const tooLargeError = new AnalysisInputTooLargeError(10);
    const optionsError = new AnalysisOptionsError("invalid options");
    const workError = new AnalysisWorkLimitError(10);
    const collectionError = new DetectorCollectionError("invalid detectors");

    expect(inputError).toBeInstanceOf(AnalysisError);
    expect(tooLargeError).toBeInstanceOf(AnalysisInputError);
    expect(optionsError).toBeInstanceOf(AnalysisError);
    expect(workError).toBeInstanceOf(AnalysisError);
    expect(collectionError).toBeInstanceOf(AnalysisError);
    expect([
      inputError.name,
      tooLargeError.name,
      optionsError.name,
      workError.name,
      collectionError.name,
    ]).toEqual([
      "AnalysisInputError",
      "AnalysisInputTooLargeError",
      "AnalysisOptionsError",
      "AnalysisWorkLimitError",
      "DetectorCollectionError",
    ]);
    expect(tooLargeError.maxInputBytes).toBe(10);
    expect(workError.maxPatternEvaluations).toBe(10);
  });
});
