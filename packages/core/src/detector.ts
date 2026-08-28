export type NonEmptyArray<T> = readonly [T, ...T[]];

export interface SubstringPattern {
  readonly kind: "substring";
  readonly value: string;
  readonly caseSensitive?: boolean;
}

export interface RegexPattern {
  readonly kind: "regex";
  readonly source: string;
  readonly flags?: string;
  readonly scope?: "line" | "input";
}

export type TextPattern = SubstringPattern | RegexPattern;

export interface EvidenceRule {
  readonly id: string;
  readonly description: string;
  readonly weight: number;
  readonly required: boolean;
  readonly pattern: TextPattern;
}

export interface DiagnosticStep {
  readonly description: string;
  readonly command?: string;
}

export type RemediationSafety = "safe" | "review";

export interface RemediationSuggestion {
  readonly description: string;
  readonly safety: RemediationSafety;
  readonly command?: string;
}

export interface DocumentationReference {
  readonly title: string;
  readonly url: string;
}

export interface DetectorMatchDefinition {
  readonly threshold: number;
  readonly evidence: NonEmptyArray<EvidenceRule>;
  readonly exclusions: readonly TextPattern[];
}

export interface DetectorDefinition {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly ecosystem: string;
  readonly title: string;
  readonly explanation: string;
  readonly match: DetectorMatchDefinition;
  readonly likelyCauses: NonEmptyArray<string>;
  readonly diagnosticSteps: NonEmptyArray<DiagnosticStep>;
  readonly remediation: NonEmptyArray<RemediationSuggestion>;
  readonly documentation: NonEmptyArray<DocumentationReference>;
}

export interface DetectorPlugin {
  readonly apiVersion: 1;
  readonly id: string;
  readonly detectors: NonEmptyArray<DetectorDefinition>;
}
