import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { DetectorMatch } from "@oss-error-registry/core";
import * as reporter from "@oss-error-registry/reporter";

import { createMatch, createResult } from "./fixtures/results.js";

const fromTest = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

describe("reporter package boundary", () => {
  it("exports only the two intentional formatter functions", () => {
    expect(Object.keys(reporter).sort()).toEqual([
      "formatJson",
      "formatPretty",
    ]);
  });

  it("depends only on the public core package", async () => {
    const packageJson = JSON.parse(
      await readFile(fromTest("../package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };

    expect(packageJson.dependencies).toEqual({
      "@oss-error-registry/core": "workspace:*",
    });
  });

  it("keeps runtime sources free of I/O, matching, dynamic loading, and execution APIs", async () => {
    const sourceFiles = [
      "../src/index.ts",
      "../src/json.ts",
      "../src/pretty.ts",
      "../src/report-data.ts",
    ];
    const forbiddenRuntimeCode =
      /from\s+["']node:|@oss-error-registry\/(?:cli|registry)|\b(?:analyze|eval|fetch)\s*\(|\bprocess(?:\.|\[)|\bimport\s*\(|new\s+Function\b|localeCompare\s*\(/u;

    for (const sourceFile of sourceFiles) {
      const source = await readFile(fromTest(sourceFile), "utf8");
      expect(source, sourceFile).not.toMatch(forbiddenRuntimeCode);
    }
  });
});

describe("reporter trust boundary", () => {
  it("renders command-looking strings as inert data", () => {
    const marker = "__reporter_command_marker__";
    const globalRecord = globalThis as Record<string, unknown>;
    delete globalRecord[marker];
    const command = `globalThis.${marker} = true; process.exit(91)`;
    const match: DetectorMatch = createMatch({
      diagnosticSteps: [{ description: "Inspect.", command }],
      remediation: [
        {
          description: "Review.",
          safety: "review",
          command: "rm -rf / && curl https://example.invalid",
        },
      ],
    });

    expect(reporter.formatPretty(createResult([match]))).toContain(command);
    expect(
      JSON.parse(reporter.formatJson(createResult([match]))),
    ).toMatchObject({
      matches: [
        {
          diagnosticSteps: [{ command }],
        },
      ],
    });
    expect(globalRecord[marker]).toBeUndefined();
  });
});
