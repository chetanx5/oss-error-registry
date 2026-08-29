import { describe, expect, it } from "vitest";

import { cliPackage, cliWorkspaceDependencies } from "@oss-error-registry/cli";
import * as core from "@oss-error-registry/core";
import {
  registryPackage,
  registryWorkspaceDependencies,
} from "@oss-error-registry/registry";
import {
  reporterPackage,
  reporterWorkspaceDependencies,
} from "@oss-error-registry/reporter";

describe("workspace foundation", () => {
  it("imports every package through its workspace name", () => {
    expect([
      registryPackage.name,
      reporterPackage.name,
      cliPackage.name,
    ]).toEqual([
      "@oss-error-registry/registry",
      "@oss-error-registry/reporter",
      "@oss-error-registry/cli",
    ]);
    expect(core.analyze).toBeTypeOf("function");
    expect(core.defineDetector).toBeTypeOf("function");
    expect(core.definePlugin).toBeTypeOf("function");
    expect(Object.keys(core).sort()).toEqual([
      "AnalysisError",
      "AnalysisInputError",
      "AnalysisInputTooLargeError",
      "AnalysisOptionsError",
      "AnalysisWorkLimitError",
      "DEFAULT_MAX_PATTERN_EVALUATIONS",
      "DEFAULT_MAX_RESULTS",
      "DetectorCollectionError",
      "MAX_ANALYSIS_DETECTORS",
      "MAX_ANALYSIS_INPUT_BYTES",
      "MAX_ANALYSIS_PATTERNS_PER_DETECTOR",
      "MAX_ANALYSIS_PATTERN_EVALUATIONS",
      "MAX_ANALYSIS_RESULTS",
      "analyze",
      "defineDetector",
      "definePlugin",
    ]);
  });

  it("preserves the planned dependency direction", () => {
    expect(registryWorkspaceDependencies).toEqual(["@oss-error-registry/core"]);
    expect(reporterWorkspaceDependencies).toEqual(["@oss-error-registry/core"]);
    expect(cliWorkspaceDependencies).toEqual([
      "@oss-error-registry/core",
      "@oss-error-registry/registry",
      "@oss-error-registry/reporter",
    ]);
  });
});
