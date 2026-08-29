import { Buffer } from "node:buffer";
import { stripVTControlCharacters } from "node:util";

import {
  AnalysisInputError,
  AnalysisInputTooLargeError,
  AnalysisOptionsError,
  AnalysisWorkLimitError,
  DEFAULT_MAX_PATTERN_EVALUATIONS,
  DEFAULT_MAX_RESULTS,
  DetectorCollectionError,
  MAX_ANALYSIS_DETECTORS,
  MAX_ANALYSIS_INPUT_BYTES,
  MAX_ANALYSIS_PATTERN_EVALUATIONS,
  MAX_ANALYSIS_PATTERNS_PER_DETECTOR,
  MAX_ANALYSIS_RESULTS,
  type AnalysisOptions,
  type AnalysisResult,
  type DetectorMatch,
} from "./analysis.js";
import type {
  DetectorDefinition,
  EvidenceRule,
  TextPattern,
} from "./detector.js";
import { assertDetectorDefinition } from "./validation.js";

interface ResolvedAnalysisOptions {
  readonly maxInputBytes: number;
  readonly maxResults: number;
  readonly maxPatternEvaluations: number;
}

interface MatchingContext {
  readonly input: string;
  readonly maxPatternEvaluations: number;
  lines: readonly string[] | undefined;
  patternEvaluations: number;
}

const ARRAY_INDEX_PATTERN = /^(?:0|[1-9]\d*)$/u;
const LINE_ENDING_PATTERN = /\r\n?/gu;
const ANALYSIS_OPTION_NAMES = new Set([
  "maxInputBytes",
  "maxResults",
  "maxPatternEvaluations",
]);

function hasOwn(record: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function assertBoundedInteger(
  value: unknown,
  optionName: string,
  maximum: number,
): asserts value is number {
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > maximum
  ) {
    throw new AnalysisOptionsError(
      `Analysis option "${optionName}" must be an integer between 1 and ${maximum}.`,
    );
  }
}

function resolveOptions(
  options: AnalysisOptions | undefined,
): ResolvedAnalysisOptions {
  if (options === undefined) {
    return {
      maxInputBytes: MAX_ANALYSIS_INPUT_BYTES,
      maxResults: DEFAULT_MAX_RESULTS,
      maxPatternEvaluations: DEFAULT_MAX_PATTERN_EVALUATIONS,
    };
  }

  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new AnalysisOptionsError("Analysis options must be a plain object.");
  }

  const prototype = Object.getPrototypeOf(options);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new AnalysisOptionsError("Analysis options must be a plain object.");
  }

  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== "string") {
      throw new AnalysisOptionsError(
        "Analysis options must not use symbol-keyed fields.",
      );
    }
    if (!ANALYSIS_OPTION_NAMES.has(key)) {
      throw new AnalysisOptionsError(
        `Analysis option "${key}" is not supported.`,
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (descriptor !== undefined && !("value" in descriptor)) {
      throw new AnalysisOptionsError(
        `Analysis option "${key}" must be a data property.`,
      );
    }
  }

  const maxInputBytes = hasOwn(options, "maxInputBytes")
    ? options.maxInputBytes
    : MAX_ANALYSIS_INPUT_BYTES;
  const maxResults = hasOwn(options, "maxResults")
    ? options.maxResults
    : DEFAULT_MAX_RESULTS;
  const maxPatternEvaluations = hasOwn(options, "maxPatternEvaluations")
    ? options.maxPatternEvaluations
    : DEFAULT_MAX_PATTERN_EVALUATIONS;

  assertBoundedInteger(
    maxInputBytes,
    "maxInputBytes",
    MAX_ANALYSIS_INPUT_BYTES,
  );
  assertBoundedInteger(maxResults, "maxResults", MAX_ANALYSIS_RESULTS);
  assertBoundedInteger(
    maxPatternEvaluations,
    "maxPatternEvaluations",
    MAX_ANALYSIS_PATTERN_EVALUATIONS,
  );

  return { maxInputBytes, maxResults, maxPatternEvaluations };
}

function assertDataOnlyArray(value: readonly unknown[]): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new DetectorCollectionError(
        "Detector collection must not use symbol-keyed fields.",
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && !("value" in descriptor)) {
      throw new DetectorCollectionError(
        `Detector collection field "${key}" must be a data property.`,
      );
    }
    if (
      key !== "length" &&
      (!ARRAY_INDEX_PATTERN.test(key) || Number(key) >= value.length)
    ) {
      throw new DetectorCollectionError(
        `Detector collection field "${key}" is not supported.`,
      );
    }
  }
}

function getDataProperty(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function assertDetectorPatternCount(
  detector: unknown,
  detectorIndex: number,
): void {
  const match = getDataProperty(detector, "match");
  const evidence = getDataProperty(match, "evidence");
  const exclusions = getDataProperty(match, "exclusions");

  if (!Array.isArray(evidence) || !Array.isArray(exclusions)) {
    return;
  }

  const patternCount = evidence.length + exclusions.length;
  if (patternCount > MAX_ANALYSIS_PATTERNS_PER_DETECTOR) {
    throw new DetectorCollectionError(
      `Detector at index ${detectorIndex} must not contain more than ${MAX_ANALYSIS_PATTERNS_PER_DETECTOR} evidence and exclusion patterns in total.`,
    );
  }
}

function validateDetectorCollection(
  detectors: readonly DetectorDefinition[],
): void {
  if (!Array.isArray(detectors)) {
    throw new DetectorCollectionError(
      "Detectors must be provided as an array.",
    );
  }
  if (detectors.length > MAX_ANALYSIS_DETECTORS) {
    throw new DetectorCollectionError(
      `Detector collection must not contain more than ${MAX_ANALYSIS_DETECTORS} detectors.`,
    );
  }

  assertDataOnlyArray(detectors);
  const detectorIds = new Set<string>();

  for (let index = 0; index < detectors.length; index += 1) {
    if (!hasOwn(detectors, String(index))) {
      throw new DetectorCollectionError(
        `Detector collection must not contain an empty slot at index ${index}.`,
      );
    }

    const detector = detectors[index];
    assertDetectorPatternCount(detector, index);
    assertDetectorDefinition(detector);
    if (detectorIds.has(detector.id)) {
      throw new DetectorCollectionError(
        `Detector collection contains duplicate detector ID "${detector.id}".`,
      );
    }
    detectorIds.add(detector.id);
  }
}

function normalizeInput(input: string, maxInputBytes: number): string {
  if (typeof input !== "string") {
    throw new AnalysisInputError("Analysis input must be a string.");
  }

  if (
    input.length > maxInputBytes ||
    Buffer.byteLength(input, "utf8") > maxInputBytes
  ) {
    throw new AnalysisInputTooLargeError(maxInputBytes);
  }

  const normalized = stripVTControlCharacters(input).replace(
    LINE_ENDING_PATTERN,
    "\n",
  );
  if (normalized.trim().length === 0) {
    throw new AnalysisInputError(
      "Analysis input must contain non-whitespace text after normalization.",
    );
  }

  return normalized;
}

function consumePatternEvaluation(context: MatchingContext): void {
  if (context.patternEvaluations >= context.maxPatternEvaluations) {
    throw new AnalysisWorkLimitError(context.maxPatternEvaluations);
  }
  context.patternEvaluations += 1;
}

function getLines(context: MatchingContext): readonly string[] {
  context.lines ??= context.input.split("\n");
  return context.lines;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function matchesSubstring(
  pattern: Extract<TextPattern, { readonly kind: "substring" }>,
  context: MatchingContext,
): boolean {
  consumePatternEvaluation(context);
  if (pattern.caseSensitive === true) {
    return context.input.includes(pattern.value);
  }

  return new RegExp(escapeRegularExpression(pattern.value), "iu").test(
    context.input,
  );
}

function matchesRegex(
  pattern: Extract<TextPattern, { readonly kind: "regex" }>,
  context: MatchingContext,
): boolean {
  const expression = new RegExp(pattern.source, pattern.flags ?? "");

  if ((pattern.scope ?? "input") === "input") {
    consumePatternEvaluation(context);
    expression.lastIndex = 0;
    return expression.test(context.input);
  }

  for (const line of getLines(context)) {
    consumePatternEvaluation(context);
    expression.lastIndex = 0;
    if (expression.test(line)) {
      return true;
    }
  }
  return false;
}

function matchesPattern(
  pattern: TextPattern,
  context: MatchingContext,
): boolean {
  return pattern.kind === "substring"
    ? matchesSubstring(pattern, context)
    : matchesRegex(pattern, context);
}

function evaluateEvidence(
  evidence: EvidenceRule,
  context: MatchingContext,
): boolean {
  return matchesPattern(evidence.pattern, context);
}

function evaluateDetector(
  detector: DetectorDefinition,
  context: MatchingContext,
): DetectorMatch | undefined {
  let exclusionMatched = false;
  for (const exclusion of detector.match.exclusions) {
    if (matchesPattern(exclusion, context)) {
      exclusionMatched = true;
    }
  }
  if (exclusionMatched) {
    return undefined;
  }

  let score = 0;
  let requiredEvidenceMissing = false;
  const matchedEvidenceIds: string[] = [];

  for (const evidence of detector.match.evidence) {
    const matched = evaluateEvidence(evidence, context);
    if (!matched) {
      if (evidence.required) {
        requiredEvidenceMissing = true;
      }
      continue;
    }

    matchedEvidenceIds.push(evidence.id);
    score = Math.min(100, score + evidence.weight);
  }

  if (requiredEvidenceMissing || score < detector.match.threshold) {
    return undefined;
  }

  return Object.freeze({
    detectorId: detector.id,
    ecosystem: detector.ecosystem,
    title: detector.title,
    score,
    matchedEvidenceIds: Object.freeze(matchedEvidenceIds),
  });
}

function compareMatches(left: DetectorMatch, right: DetectorMatch): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.detectorId < right.detectorId) {
    return -1;
  }
  if (left.detectorId > right.detectorId) {
    return 1;
  }
  return 0;
}

function addRankedMatch(
  matches: DetectorMatch[],
  match: DetectorMatch,
  maxResults: number,
): void {
  matches.push(match);
  matches.sort(compareMatches);
  if (matches.length > maxResults) {
    matches.pop();
  }
}

export function analyze(
  input: string,
  detectors: readonly DetectorDefinition[],
  options?: AnalysisOptions,
): AnalysisResult {
  const resolvedOptions = resolveOptions(options);
  const normalizedInput = normalizeInput(input, resolvedOptions.maxInputBytes);
  validateDetectorCollection(detectors);

  const context: MatchingContext = {
    input: normalizedInput,
    lines: undefined,
    patternEvaluations: 0,
    maxPatternEvaluations: resolvedOptions.maxPatternEvaluations,
  };
  const matches: DetectorMatch[] = [];

  for (const detector of detectors) {
    const match = evaluateDetector(detector, context);
    if (match !== undefined) {
      addRankedMatch(matches, match, resolvedOptions.maxResults);
    }
  }

  return Object.freeze({
    normalizedInputLength: normalizedInput.length,
    matches: Object.freeze(matches),
  });
}
