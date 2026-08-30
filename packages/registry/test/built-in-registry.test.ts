import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MAX_ANALYSIS_INPUT_BYTES, analyze } from "@oss-error-registry/core";
import * as registry from "@oss-error-registry/registry";

import {
  MAX_FIXTURE_BYTES,
  validateLoadedDetectorCollection,
  validateRegistryFilesystem,
} from "../scripts/registry-tooling.mjs";

const detectorsRoot = fileURLToPath(
  new URL("../src/detectors/", import.meta.url),
);
const registryEntries = await validateRegistryFilesystem(detectorsRoot);
validateLoadedDetectorCollection(registryEntries, registry.builtInDetectors);

describe("built-in registry public API", () => {
  it("exports only the intentional runtime surface", () => {
    expect(Object.keys(registry)).toEqual(["builtInDetectors"]);
  });

  it("exports a deeply immutable detector collection", () => {
    expect(Object.isFrozen(registry.builtInDetectors)).toBe(true);
    expect(registry.builtInDetectors.every(Object.isFrozen)).toBe(true);
    expect(
      registry.builtInDetectors.every((detector) =>
        Object.isFrozen(detector.match.evidence),
      ),
    ).toBe(true);
    expect(Reflect.set(registry.builtInDetectors, "0", undefined)).toBe(false);
    expect(Reflect.set(registry.builtInDetectors, "length", 0)).toBe(false);
    expect(Reflect.set(registry.builtInDetectors[0]!, "title", "mutated")).toBe(
      false,
    );
  });

  it("orders unique detector IDs using deterministic lexical order", () => {
    const detectorIds = registry.builtInDetectors.map(({ id }) => id);
    expect(detectorIds).toEqual([...detectorIds].sort());
    expect(new Set(detectorIds).size).toBe(detectorIds.length);
  });

  it("keeps the fixture and analysis input limits aligned", () => {
    expect(MAX_FIXTURE_BYTES).toBe(MAX_ANALYSIS_INPUT_BYTES);
  });

  it("is accepted directly by the core analysis engine", () => {
    const result = analyze(
      "unrelated plain-text diagnostic output",
      registry.builtInDetectors,
    );
    expect(result.matches).toEqual([]);
  });

  it("keeps the runtime registry import graph filesystem-free and static", async () => {
    const runtimeFiles = [
      fileURLToPath(new URL("../src/index.ts", import.meta.url)),
      fileURLToPath(new URL("../src/generated/detectors.ts", import.meta.url)),
      ...registryEntries.map((entry) =>
        path.join(entry.directory, "detector.ts"),
      ),
    ];
    const forbiddenRuntimeCode =
      /from\s+["']node:(?:child_process|dns|fs|http|https|net)["']|\b(?:eval|fetch)\s*\(|\bimport\s*\(|new\s+Function\b|process\.cwd\s*\(/u;

    for (const runtimeFile of runtimeFiles) {
      const source = await readFile(runtimeFile, "utf8");
      expect(source, runtimeFile).not.toMatch(forbiddenRuntimeCode);
    }
  });
});

describe("generic built-in detector case harness", () => {
  it("automatically validates every detector case and expected score", () => {
    const detectorsById = new Map(
      registry.builtInDetectors.map((detector) => [detector.id, detector]),
    );
    expect(detectorsById.size).toBe(registryEntries.length);

    for (const entry of registryEntries) {
      const detector = detectorsById.get(entry.detectorId);
      expect(
        detector,
        `missing generated detector ${entry.detectorId}`,
      ).toBeDefined();
      expect(
        detector?.ecosystem,
        `${entry.detectorId}: ecosystem must match directory ${entry.ecosystem}`,
      ).toBe(entry.ecosystem);
      expect(
        entry.cases.some(({ expect }) => expect.match),
        `${entry.detectorId}: must include a positive case`,
      ).toBe(true);
      expect(
        entry.cases.some(({ expect }) => !expect.match),
        `${entry.detectorId}: must include a negative case`,
      ).toBe(true);

      for (const caseDefinition of entry.cases) {
        const result = analyze(caseDefinition.fixtureText, [detector!]);
        const repeatedResult = analyze(caseDefinition.fixtureText, [detector!]);
        expect(
          repeatedResult,
          `${entry.detectorId}: case "${caseDefinition.name}" must be deterministic`,
        ).toEqual(result);
        const match = result.matches.find(
          ({ detectorId }) => detectorId === entry.detectorId,
        );
        if (caseDefinition.expect.match) {
          expect(
            match,
            `${entry.detectorId}: case "${caseDefinition.name}" should match`,
          ).toBeDefined();
          expect(match?.score).toBe(caseDefinition.expect.score);
        } else {
          expect(
            match,
            `${entry.detectorId}: case "${caseDefinition.name}" should not match`,
          ).toBeUndefined();
        }
      }
    }
  });
});
