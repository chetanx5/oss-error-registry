export const cliPackage = {
  name: "@oss-error-registry/cli",
} as const;

export const cliWorkspaceDependencies = [
  "@oss-error-registry/core",
  "@oss-error-registry/registry",
  "@oss-error-registry/reporter",
] as const;
