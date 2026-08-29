export const MAX_ANALYSIS_INPUT_BYTES = 1_048_576;
export const DEFAULT_MAX_RESULTS = 10;
export const MAX_ANALYSIS_RESULTS = 100;
export const DEFAULT_MAX_PATTERN_EVALUATIONS = 100_000;
export const MAX_ANALYSIS_PATTERN_EVALUATIONS = 1_000_000;
export const MAX_ANALYSIS_DETECTORS = 1_000;
export const MAX_ANALYSIS_PATTERNS_PER_DETECTOR = 100;

export interface AnalysisOptions {
  readonly maxInputBytes?: number;
  readonly maxResults?: number;
  readonly maxPatternEvaluations?: number;
}

export interface DetectorMatch {
  readonly detectorId: string;
  readonly ecosystem: string;
  readonly title: string;
  readonly score: number;
  readonly matchedEvidenceIds: readonly string[];
}

export interface AnalysisResult {
  readonly normalizedInputLength: number;
  readonly matches: readonly DetectorMatch[];
}

export class AnalysisError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

export class AnalysisInputError extends AnalysisError {
  public constructor(message: string) {
    super(message);
    this.name = "AnalysisInputError";
  }
}

export class AnalysisInputTooLargeError extends AnalysisInputError {
  public readonly maxInputBytes: number;

  public constructor(maxInputBytes: number) {
    super(
      `Analysis input exceeds the maximum size of ${maxInputBytes} UTF-8 bytes.`,
    );
    this.name = "AnalysisInputTooLargeError";
    this.maxInputBytes = maxInputBytes;
  }
}

export class AnalysisOptionsError extends AnalysisError {
  public constructor(message: string) {
    super(message);
    this.name = "AnalysisOptionsError";
  }
}

export class AnalysisWorkLimitError extends AnalysisError {
  public readonly maxPatternEvaluations: number;

  public constructor(maxPatternEvaluations: number) {
    super(
      `Analysis exceeded the maximum of ${maxPatternEvaluations} pattern evaluations.`,
    );
    this.name = "AnalysisWorkLimitError";
    this.maxPatternEvaluations = maxPatternEvaluations;
  }
}

export class DetectorCollectionError extends AnalysisError {
  public constructor(message: string) {
    super(message);
    this.name = "DetectorCollectionError";
  }
}
