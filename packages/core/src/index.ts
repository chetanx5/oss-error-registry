/** A minimal package descriptor used only to verify workspace wiring. */
export interface WorkspacePackageDescriptor {
  readonly name: string;
}

export const corePackage = {
  name: "@oss-error-registry/core",
} as const satisfies WorkspacePackageDescriptor;
