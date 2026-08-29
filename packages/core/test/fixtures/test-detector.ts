import {
  defineDetector,
  type DetectorDefinition,
  type EvidenceRule,
  type NonEmptyArray,
  type TextPattern,
} from "@oss-error-registry/core";

interface TestDetectorOptions {
  readonly id: string;
  readonly title?: string;
  readonly threshold?: number;
  readonly evidence: NonEmptyArray<EvidenceRule>;
  readonly exclusions?: readonly TextPattern[];
  readonly diagnosticCommand?: string;
  readonly remediationCommand?: string;
}

export function createTestDetector(
  options: TestDetectorOptions,
): DetectorDefinition {
  const separatorIndex = options.id.indexOf("/");
  const ecosystem = options.id.slice(0, separatorIndex);

  return defineDetector({
    schemaVersion: 1,
    id: options.id,
    ecosystem,
    title: options.title ?? `Test detector ${options.id}`,
    explanation: "A test-only detector used to exercise matching semantics.",
    match: {
      threshold: options.threshold ?? 1,
      evidence: options.evidence,
      exclusions: options.exclusions ?? [],
    },
    likelyCauses: ["A test-only cause."],
    diagnosticSteps: [
      {
        description: "Inspect the test input.",
        ...(options.diagnosticCommand === undefined
          ? {}
          : { command: options.diagnosticCommand }),
      },
    ],
    remediation: [
      {
        description: "Review the test-only remediation.",
        safety: "review",
        ...(options.remediationCommand === undefined
          ? {}
          : { command: options.remediationCommand }),
      },
    ],
    documentation: [
      {
        title: "Test-only documentation",
        url: "https://example.com/test-detector",
      },
    ],
  });
}

export function substringEvidence(
  id: string,
  value: string,
  weight: number,
  required = false,
  caseSensitive = true,
): EvidenceRule {
  return {
    id,
    description: `Test evidence ${id}.`,
    weight,
    required,
    pattern: { kind: "substring", value, caseSensitive },
  };
}

export function regexEvidence(
  id: string,
  source: string,
  weight: number,
  required = false,
  scope: "line" | "input" = "input",
  flags?: string,
): EvidenceRule {
  return {
    id,
    description: `Test evidence ${id}.`,
    weight,
    required,
    pattern: {
      kind: "regex",
      source,
      scope,
      ...(flags === undefined ? {} : { flags }),
    },
  };
}
