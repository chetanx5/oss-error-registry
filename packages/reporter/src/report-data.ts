import type {
  AnalysisResult,
  DiagnosticStep,
  DocumentationReference,
  RemediationSuggestion,
} from "@oss-error-registry/core";

export interface ReportDiagnosticStep {
  readonly description: string;
  readonly command?: string;
}

export interface ReportRemediationSuggestion {
  readonly description: string;
  readonly safety: "safe" | "review";
  readonly command?: string;
}

export interface ReportDocumentationReference {
  readonly title: string;
  readonly url: string;
}

export interface ReportMatch {
  readonly detectorId: string;
  readonly ecosystem: string;
  readonly title: string;
  readonly score: number;
  readonly matchedEvidenceIds: readonly string[];
  readonly explanation: string;
  readonly likelyCauses: readonly string[];
  readonly diagnosticSteps: readonly ReportDiagnosticStep[];
  readonly remediation: readonly ReportRemediationSuggestion[];
  readonly documentation: readonly ReportDocumentationReference[];
}

export interface ReportData {
  readonly schemaVersion: 1;
  readonly status: "no-match" | "matches";
  readonly matchCount: number;
  readonly normalizedInputLength: number;
  readonly matches: readonly ReportMatch[];
}

function copyDiagnosticStep(step: DiagnosticStep): ReportDiagnosticStep {
  return {
    description: step.description,
    ...(step.command === undefined ? {} : { command: step.command }),
  };
}

function copyRemediationSuggestion(
  suggestion: RemediationSuggestion,
): ReportRemediationSuggestion {
  return {
    description: suggestion.description,
    safety: suggestion.safety,
    ...(suggestion.command === undefined
      ? {}
      : { command: suggestion.command }),
  };
}

function copyDocumentationReference(
  reference: DocumentationReference,
): ReportDocumentationReference {
  return {
    title: reference.title,
    url: reference.url,
  };
}

export function createReportData(result: AnalysisResult): ReportData {
  const matches = result.matches.map(
    (match): ReportMatch => ({
      detectorId: match.detectorId,
      ecosystem: match.ecosystem,
      title: match.title,
      score: match.score,
      matchedEvidenceIds: [...match.matchedEvidenceIds],
      explanation: match.explanation,
      likelyCauses: [...match.likelyCauses],
      diagnosticSteps: match.diagnosticSteps.map(copyDiagnosticStep),
      remediation: match.remediation.map(copyRemediationSuggestion),
      documentation: match.documentation.map(copyDocumentationReference),
    }),
  );

  return {
    schemaVersion: 1,
    status: matches.length === 0 ? "no-match" : "matches",
    matchCount: matches.length,
    normalizedInputLength: result.normalizedInputLength,
    matches,
  };
}
