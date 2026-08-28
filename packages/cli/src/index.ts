import {
  corePackage,
  type WorkspacePackageDescriptor,
} from "@oss-error-registry/core";
import { registryPackage } from "@oss-error-registry/registry";
import { reporterPackage } from "@oss-error-registry/reporter";

export const cliPackage = {
  name: "@oss-error-registry/cli",
} as const satisfies WorkspacePackageDescriptor;

export const cliWorkspaceDependencies = [
  corePackage.name,
  registryPackage.name,
  reporterPackage.name,
] as const;
