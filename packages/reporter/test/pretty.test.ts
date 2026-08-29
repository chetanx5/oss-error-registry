import { describe, expect, it, vi } from "vitest";

import { formatPretty } from "@oss-error-registry/reporter";

import { createMatch, createResult, deepFreeze } from "./fixtures/results.js";

describe("formatPretty", () => {
  it("renders a clear zero-match result", () => {
    expect(formatPretty(createResult([], 41))).toBe(
      [
        "Status: no-match",
        "Matches: 0",
        "Normalized input length: 41",
        "",
        "No deterministic diagnosis matched the input.",
      ].join("\n"),
    );
  });

  it("renders one complete diagnosis in a stable layout", () => {
    expect(formatPretty(createResult())).toBe(
      [
        "Status: matches",
        "Matches: 1",
        "Normalized input length: 123",
        "",
        "Diagnosis 1",
        "  Detector ID: npm/eresolve-peer-dependency",
        "  Ecosystem: npm",
        "  Title: Peer dependency resolution conflict",
        "  Evidence score: 90/100",
        "  Matched evidence:",
        "    1. npm-eresolve-code",
        "    2. dependency-tree-message",
        "  Explanation:",
        "    npm could not construct a dependency tree that satisfies the declared peer dependency ranges.",
        "  Likely causes:",
        "    1. Two packages require incompatible peer dependency versions.",
        "    2. An installed version falls outside a declared peer range.",
        "  Diagnostic steps:",
        "    1. Inspect why npm selected the conflicting package.",
        "       Command: npm explain <package-name>",
        "    2. Compare the declared peer dependency ranges.",
        "  Remediation suggestions:",
        "    1. [safe] Review the conflicting peer dependency ranges.",
        "    2. [review] Align versions after reviewing compatibility notes.",
        "       Command: npm install <package-name>@<compatible-version>",
        "  Documentation:",
        "    1. npm peer dependency documentation",
        "       URL: https://docs.npmjs.com/files/package.json#peerdependencies",
      ].join("\n"),
    );
  });

  it("preserves engine-defined match and guidance ordering", () => {
    const output = formatPretty(
      createResult([
        createMatch({
          detectorId: "test/high-score",
          title: "High score",
          score: 100,
          likelyCauses: ["first cause", "second cause"],
        }),
        createMatch({
          detectorId: "test/low-score",
          title: "Low score",
          score: 1,
        }),
      ]),
    );

    expect(output).toContain("Matches: 2");
    expect(output).toContain("Evidence score: 100/100");
    expect(output).toContain("Evidence score: 1/100");
    expect(output.indexOf("test/high-score")).toBeLessThan(
      output.indexOf("test/low-score"),
    );
    expect(output.indexOf("first cause")).toBeLessThan(
      output.indexOf("second cause"),
    );
  });

  it("preserves Unicode and indents multiline data with canonical LF output", () => {
    const output = formatPretty(
      createResult([
        createMatch({
          title: "Ошибка сборки 🚨",
          explanation: "first line\r\nsecond line\rthird line\nfourth line",
          likelyCauses: ["原因一\n原因二"],
          diagnosticSteps: [
            {
              description: "Inspect windows\\work and posix/work",
              command: "printf 'hello'\nrm -rf /",
            },
          ],
        }),
      ]),
    );

    expect(output).toContain("  Title: Ошибка сборки 🚨");
    expect(output).toContain(
      "  Explanation:\n    first line\n    second line\n    third line\n    fourth line",
    );
    expect(output).toContain("    1. 原因一\n       原因二");
    expect(output).toContain("Inspect windows\\work and posix/work");
    expect(output).toContain("       Command: printf 'hello'\n");
    expect(output).toContain("                rm -rf /");
    expect(output).not.toContain("\r");
  });

  it("escapes terminal control characters instead of emitting them", () => {
    const output = formatPretty(
      createResult([
        createMatch({
          title: "\u001B]0;changed\u0007Title\ttext",
          explanation: "safe\u007Ftext",
        }),
      ]),
    );

    expect(output).toContain("Title: \\u001b]0;changed\\u0007Title\\u0009text");
    expect(output).toContain("safe\\u007ftext");
    expect(output).not.toContain("\u001B");
    expect(output).not.toContain("\u0007");
    expect(output).not.toContain("\t");
  });

  it("does not wrap or truncate long explanations", () => {
    const explanation = `begin-${"x".repeat(2_000)}-end`;
    const output = formatPretty(createResult([createMatch({ explanation })]));

    expect(output).toContain(`    ${explanation}`);
  });

  it("omits command labels when optional commands are absent", () => {
    const output = formatPretty(
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

    expect(output).not.toContain("Command:");
  });

  it("is byte-identical across repeated calls and does not use time or randomness", () => {
    const result = createResult();
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");

    const first = formatPretty(result);
    const second = formatPretty(result);

    expect(second).toBe(first);
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it("accepts a deeply frozen result without mutating it", () => {
    const result = deepFreeze(createResult());
    const before = JSON.stringify(result);

    expect(() => formatPretty(result)).not.toThrow();
    expect(JSON.stringify(result)).toBe(before);
  });
});
