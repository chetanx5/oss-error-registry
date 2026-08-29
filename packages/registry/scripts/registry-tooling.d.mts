export const MAX_CASES_FILE_BYTES: number;
export const MAX_DETECTOR_SOURCE_BYTES: number;
export const MAX_FIXTURE_BYTES: number;

export class RegistryValidationError extends Error {}

export type RegistryCaseExpectation =
  | { readonly match: true; readonly score: number }
  | { readonly match: false };

export interface RegistryCase {
  readonly name: string;
  readonly fixture: string;
  readonly expect: RegistryCaseExpectation;
  readonly fixtureText: string;
}

export interface RegistryDetectorEntry {
  readonly ecosystem: string;
  readonly detectorName: string;
  readonly detectorId: string;
  readonly directory: string;
  readonly cases: readonly RegistryCase[];
}

export function compareAscii(left: string, right: string): number;
export function validateDetectorModuleSource(
  source: string,
  context?: string,
): void;
export function validateFixturePath(
  fixture: unknown,
  expectedMatch: boolean,
  context: string,
): string;
export function validateCasesDocument(
  value: unknown,
  options?: {
    readonly expectedDetectorId?: string;
    readonly fileLabel?: string;
  },
): {
  readonly detectorId: string;
  readonly cases: readonly Omit<RegistryCase, "fixtureText">[];
};
export function discoverDetectorDirectories(
  detectorsRoot: string,
): Promise<readonly Omit<RegistryDetectorEntry, "cases">[]>;
export function validateRegistryFilesystem(
  detectorsRoot: string,
): Promise<readonly RegistryDetectorEntry[]>;
export function validateLoadedDetectorCollection(
  entries: readonly Omit<RegistryDetectorEntry, "cases">[],
  detectors: readonly unknown[],
): void;
export function renderRegistryIndex(
  entries: readonly Omit<RegistryDetectorEntry, "cases">[],
): string;
export function generateRegistryIndex(options: {
  readonly detectorsRoot: string;
  readonly generatedFile: string;
  readonly check: boolean;
}): Promise<{
  readonly changed: boolean;
  readonly entries: readonly RegistryDetectorEntry[];
  readonly output: string;
}>;
