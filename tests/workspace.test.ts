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
    expect(core.defineDetector).toBeTypeOf("function");
    expect(core.definePlugin).toBeTypeOf("function");
    expect(Object.keys(core).sort()).toEqual([
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
