import {
  corePackage,
  type WorkspacePackageDescriptor,
} from "@oss-error-registry/core";

export const reporterPackage = {
  name: "@oss-error-registry/reporter",
} as const satisfies WorkspacePackageDescriptor;

export const reporterWorkspaceDependencies = [corePackage.name] as const;
