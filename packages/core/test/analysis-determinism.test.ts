import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_RESULTS,
  DetectorCollectionError,
  MAX_ANALYSIS_DETECTORS,
  MAX_ANALYSIS_PATTERNS_PER_DETECTOR,
  MAX_ANALYSIS_RESULTS,
  analyze,
  type DetectorDefinition,
} from "@oss-error-registry/core";

import {
  createTestDetector,
  substringEvidence,
} from "./fixtures/test-detector.js";

function createRankedDetector(id: string, score: number): DetectorDefinition {
  return createTestDetector({
    id,
    threshold: score,
    evidence: [substringEvidence("signal", "shared signal", score)],
  });
}

describe("deterministic result ordering", () => {
  it("sorts matches by score descending", () => {
    const low = createRankedDetector("test/low-score", 20);
    const high = createRankedDetector("test/high-score", 90);

    expect(
      analyze("shared signal", [low, high]).matches.map(
        ({ detectorId }) => detectorId,
      ),
    ).toEqual(["test/high-score", "test/low-score"]);
  });

  it("breaks equal-score ties by detector ID ascending", () => {
    const later = createRankedDetector("test/z-detector", 50);
    const earlier = createRankedDetector("test/a-detector", 50);

    expect(
      analyze("shared signal", [later, earlier]).matches.map(
        ({ detectorId }) => detectorId,
      ),
    ).toEqual(["test/a-detector", "test/z-detector"]);
  });

  it("returns the same structured result for repeated analysis", () => {
    const detector = createRankedDetector("test/repeatable", 50);

    const first = analyze("shared signal", [detector]);
    const second = analyze("shared signal", [detector]);

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("does not depend on detector input order", () => {
    const first = createRankedDetector("test/first", 50);
    const second = createRankedDetector("test/second", 80);
    const forward = analyze("shared signal", [first, second]);
    const reverse = analyze("shared signal", [second, first]);

    expect(reverse).toEqual(forward);
  });

  it("orders several equal-score detectors from a shuffled input", () => {
    const ids = ["test/kilo-7", "test/alpha-2", "test/zulu-9", "test/bravo-4"];
    const detectors = ids.map((id) => createRankedDetector(id, 50));

    expect(
      analyze("shared signal", detectors).matches.map(
        ({ detectorId }) => detectorId,
      ),
    ).toEqual([...ids].sort());
  });

  it("returns only deterministic documented fields", () => {
    const detector = createRankedDetector("test/fields", 50);
    const result = analyze("shared signal", [detector]);

    expect(Object.keys(result)).toEqual(["normalizedInputLength", "matches"]);
    expect(Object.keys(result.matches[0] ?? {})).toEqual([
      "detectorId",
      "ecosystem",
      "title",
      "score",
      "matchedEvidenceIds",
    ]);
  });
});

describe("bounded and immutable results", () => {
  it("uses the default result limit", () => {
    const detectors = Array.from(
      { length: DEFAULT_MAX_RESULTS + 2 },
      (_, index) =>
        createRankedDetector(
          `test/detector-${String(index).padStart(2, "0")}`,
          50,
        ),
    );

    expect(analyze("shared signal", detectors).matches).toHaveLength(
      DEFAULT_MAX_RESULTS,
    );
  });

  it("honors a lower valid result limit after deterministic ranking", () => {
    const detectors = [
      createRankedDetector("test/low", 20),
      createRankedDetector("test/high", 90),
      createRankedDetector("test/middle", 50),
    ];

    expect(
      analyze("shared signal", detectors, { maxResults: 2 }).matches.map(
        ({ detectorId }) => detectorId,
      ),
    ).toEqual(["test/high", "test/middle"]);
  });

  it("supports a result limit of one without stopping before a later winner", () => {
    const detectors = [
      createRankedDetector("test/early-low", 20),
      createRankedDetector("test/later-high", 90),
    ];

    expect(
      analyze("shared signal", detectors, { maxResults: 1 }).matches[0]
        ?.detectorId,
    ).toBe("test/later-high");
  });

  it("accepts the exact maximum supported result limit", () => {
    const detectors = Array.from({ length: MAX_ANALYSIS_RESULTS }, (_, index) =>
      createRankedDetector(`test/limit-${String(index).padStart(3, "0")}`, 50),
    );

    expect(
      analyze("shared signal", detectors, {
        maxResults: MAX_ANALYSIS_RESULTS,
      }).matches,
    ).toHaveLength(MAX_ANALYSIS_RESULTS);
  });

  it("freezes structured results and nested evidence ID arrays", () => {
    const detector = createRankedDetector("test/frozen-result", 50);
    const result = analyze("shared signal", [detector]);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.matches)).toBe(true);
    expect(Object.isFrozen(result.matches[0])).toBe(true);
    expect(Object.isFrozen(result.matches[0]?.matchedEvidenceIds)).toBe(true);
    expect(Reflect.set(result, "matches", [])).toBe(false);
    expect(Reflect.set(result.matches, "0", undefined)).toBe(false);
    expect(Reflect.set(result.matches[0] ?? {}, "score", 0)).toBe(false);
    expect(
      Reflect.set(result.matches[0]?.matchedEvidenceIds ?? [], "0", "changed"),
    ).toBe(false);
  });
});

describe("analysis side-effect safety", () => {
  it("does not mutate detector definitions or caller input", () => {
    const detector = createRankedDetector("test/unchanged", 50);
    const before = JSON.stringify(detector);
    const input = "shared signal";

    analyze(input, [detector]);

    expect(JSON.stringify(detector)).toBe(before);
    expect(input).toBe("shared signal");
  });

  it("does not mutate or reorder a mutable detector array", () => {
    const detectors = [
      createRankedDetector("test/array-low", 20),
      createRankedDetector("test/array-high", 90),
    ];
    const before = [...detectors];

    analyze("shared signal", detectors);

    expect(detectors).toEqual(before);
  });

  it("accepts empty, frozen, and manually constructed detector collections", () => {
    expect(analyze("shared signal", []).matches).toEqual([]);

    const defined = createRankedDetector("test/frozen-array", 50);
    expect(
      analyze("shared signal", Object.freeze([defined])).matches,
    ).toHaveLength(1);

    const manual = structuredClone(
      createRankedDetector("test/manual-definition", 50),
    );
    expect(analyze("shared signal", [manual]).matches).toHaveLength(1);
  });

  it("rejects a non-array detector collection", () => {
    expect(() =>
      analyze("shared signal", null as unknown as DetectorDefinition[]),
    ).toThrowError("Detectors must be provided as an array.");
  });

  it("keeps diagnostic and remediation commands inert", () => {
    const detector = createTestDetector({
      id: "test/inert-commands",
      evidence: [substringEvidence("signal", "shared signal", 50)],
      diagnosticCommand: "process.exit(91)",
      remediationCommand: "throw new Error('must not execute')",
    });

    expect(analyze("shared signal", [detector]).matches).toHaveLength(1);
  });

  it("rejects duplicate detector IDs to preserve unambiguous ordering", () => {
    const detector = createRankedDetector("test/duplicate", 50);

    expect(() => analyze("shared signal", [detector, detector])).toThrowError(
      new DetectorCollectionError(
        'Detector collection contains duplicate detector ID "test/duplicate".',
      ),
    );
  });

  it("rejects detector collection accessors without invoking them", () => {
    let invoked = false;
    const detectors: DetectorDefinition[] = [];
    Object.defineProperty(detectors, "0", {
      configurable: true,
      enumerable: true,
      get() {
        invoked = true;
        return createRankedDetector("test/accessor", 50);
      },
    });

    expect(() => analyze("shared signal", detectors)).toThrowError(
      'Detector collection field "0" must be a data property.',
    );
    expect(invoked).toBe(false);
  });

  it("rejects detector collections above the hard count limit", () => {
    const detector = createRankedDetector("test/count-limit", 50);
    const detectors = Array.from(
      { length: MAX_ANALYSIS_DETECTORS + 1 },
      () => detector,
    );

    expect(() => analyze("shared signal", detectors)).toThrowError(
      `Detector collection must not contain more than ${MAX_ANALYSIS_DETECTORS} detectors.`,
    );
  });

  it("rejects oversized evidence and exclusion collections before validation", () => {
    const base = createRankedDetector("test/pattern-count", 50);
    const evidence = Array.from(
      { length: MAX_ANALYSIS_PATTERNS_PER_DETECTOR + 1 },
      (_, index) => substringEvidence(`signal-${index}`, "shared signal", 1),
    );
    const detector = {
      ...base,
      match: { ...base.match, evidence },
    } as unknown as DetectorDefinition;

    expect(() => analyze("shared signal", [detector])).toThrowError(
      `Detector at index 0 must not contain more than ${MAX_ANALYSIS_PATTERNS_PER_DETECTOR} evidence and exclusion patterns in total.`,
    );
  });
});
