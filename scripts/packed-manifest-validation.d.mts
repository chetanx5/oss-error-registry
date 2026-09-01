export interface PackedManifestExpectation {
  readonly name: string;
  readonly version: string;
  readonly dependencyNames: readonly string[];
}

export function findWorkspaceProtocolPaths(value: unknown): readonly string[];

export function assertPackedManifest(
  manifest: unknown,
  expectation: PackedManifestExpectation,
): asserts manifest is Readonly<Record<string, unknown>>;
