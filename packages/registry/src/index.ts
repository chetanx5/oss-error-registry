import {
  corePackage,
  type WorkspacePackageDescriptor,
} from "@oss-error-registry/core";

export const registryPackage = {
  name: "@oss-error-registry/registry",
} as const satisfies WorkspacePackageDescriptor;

export const registryWorkspaceDependencies = [corePackage.name] as const;
