import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as cli from "@oss-error-registry/cli";

import { CLI_VERSION } from "../src/metadata.js";

const fromTest = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

describe("CLI package boundary", () => {
  it("exports only the intentional programmatic surface", () => {
    expect(Object.keys(cli).sort()).toEqual(["CLI_EXIT_CODE", "runCli"]);
  });

  it("declares the expected bin and acyclic workspace dependencies", async () => {
    const packageJson = JSON.parse(
      await readFile(fromTest("../package.json"), "utf8"),
    ) as {
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
      version?: string;
    };

    expect(packageJson.bin).toEqual({
      "oss-error-registry": "./dist/bin.js",
    });
    expect(packageJson.dependencies).toEqual({
      "@oss-error-registry/core": "workspace:*",
      "@oss-error-registry/registry": "workspace:*",
      "@oss-error-registry/reporter": "workspace:*",
    });
    expect(CLI_VERSION).toBe(packageJson.version);
  });

  it("keeps the executable small and non-terminating", async () => {
    const source = await readFile(fromTest("../src/bin.ts"), "utf8");

    expect(source.startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(source).toContain("process.exitCode = await runCli(");
    expect(source).not.toMatch(/process\.exit\s*\(/u);
  });

  it("composes the existing registry, analyzer, and reporter APIs", async () => {
    const source = await readFile(fromTest("../src/run.ts"), "utf8");

    expect(source).toContain("analyze(input, builtInDetectors)");
    expect(source).toContain("formatJson(result)");
    expect(source).toContain("formatPretty(result)");
  });

  it("contains no shell, dynamic execution, network, telemetry, or directory scanning", async () => {
    const sourceFiles = [
      "../src/arguments.ts",
      "../src/bin.ts",
      "../src/index.ts",
      "../src/input.ts",
      "../src/metadata.ts",
      "../src/run.ts",
      "../src/runtime.ts",
    ];
    const forbiddenRuntimeCode =
      /node:(?:child_process|cluster|dgram|dns|http|https|module|net|tls|vm|worker_threads)|\b(?:eval|fetch|Function|require)\s*\(|\bimport\s*\(|\b(?:WebSocket|XMLHttpRequest)\b|sendBeacon\s*\(|createRequire\s*\(|\b(?:readdir|opendir|glob|mkdtemp)\s*\(|telemetry|analytics/u;

    for (const sourceFile of sourceFiles) {
      const source = await readFile(fromTest(sourceFile), "utf8");
      expect(source, sourceFile).not.toMatch(forbiddenRuntimeCode);
    }
  });

  it("limits filesystem APIs to the explicit input reader", async () => {
    const inputSource = await readFile(fromTest("../src/input.ts"), "utf8");
    const otherSources = await Promise.all(
      [
        "../src/arguments.ts",
        "../src/bin.ts",
        "../src/index.ts",
        "../src/metadata.ts",
        "../src/run.ts",
        "../src/runtime.ts",
      ].map(async (sourceFile) => readFile(fromTest(sourceFile), "utf8")),
    );

    expect(inputSource).toContain('from "node:fs/promises"');
    for (const source of otherSources) {
      expect(source).not.toContain("node:fs");
    }
  });
});
