import { describe, expect, it } from "vitest";

import { cliPackage, cliWorkspaceDependencies } from "@oss-error-registry/cli";
import { corePackage } from "@oss-error-registry/core";
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
      corePackage.name,
      registryPackage.name,
      reporterPackage.name,
      cliPackage.name,
    ]).toEqual([
      "@oss-error-registry/core",
      "@oss-error-registry/registry",
      "@oss-error-registry/reporter",
      "@oss-error-registry/cli",
    ]);
  });

  it("preserves the planned dependency direction", () => {
    expect(registryWorkspaceDependencies).toEqual([corePackage.name]);
    expect(reporterWorkspaceDependencies).toEqual([corePackage.name]);
    expect(cliWorkspaceDependencies).toEqual([
      corePackage.name,
      registryPackage.name,
      reporterPackage.name,
    ]);
  });
});
