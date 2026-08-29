import type { AnalysisResult } from "@oss-error-registry/core";

import {
  createReportData,
  type ReportDiagnosticStep,
  type ReportDocumentationReference,
  type ReportMatch,
  type ReportRemediationSuggestion,
} from "./report-data.js";

const CARRIAGE_RETURN_PATTERN = /\r\n?/gu;

function escapeNonPrintingControl(character: string): string {
  return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

function escapeNonPrintingControls(value: string): string {
  let escaped = "";

  for (const character of value) {
    const code = character.charCodeAt(0);
    const isControl =
      code <= 0x09 ||
      (code >= 0x0b && code <= 0x0c) ||
      (code >= 0x0e && code <= 0x1f) ||
      (code >= 0x7f && code <= 0x9f);
    escaped += isControl ? escapeNonPrintingControl(character) : character;
  }

  return escaped;
}

function toDisplayLines(value: string): readonly string[] {
  return value
    .replace(CARRIAGE_RETURN_PATTERN, "\n")
    .split("\n")
    .map(escapeNonPrintingControls);
}

function appendPrefixedText(
  lines: string[],
  prefix: string,
  value: string,
): void {
  const displayLines = toDisplayLines(value);
  const continuationPrefix = " ".repeat(prefix.length);

  lines.push(`${prefix}${displayLines[0] ?? ""}`);
  for (const line of displayLines.slice(1)) {
    lines.push(`${continuationPrefix}${line}`);
  }
}

function appendBlock(lines: string[], heading: string, value: string): void {
  lines.push(`  ${heading}:`);
  for (const line of toDisplayLines(value)) {
    lines.push(`    ${line}`);
  }
}

function appendStringList(
  lines: string[],
  heading: string,
  values: readonly string[],
): void {
  lines.push(`  ${heading}:`);
  if (values.length === 0) {
    lines.push("    (none)");
    return;
  }

  values.forEach((value, index) => {
    appendPrefixedText(lines, `    ${index + 1}. `, value);
  });
}

function appendDiagnosticSteps(
  lines: string[],
  steps: readonly ReportDiagnosticStep[],
): void {
  lines.push("  Diagnostic steps:");
  if (steps.length === 0) {
    lines.push("    (none)");
    return;
  }

  steps.forEach((step, index) => {
    appendPrefixedText(lines, `    ${index + 1}. `, step.description);
    if (step.command !== undefined) {
      appendPrefixedText(lines, "       Command: ", step.command);
    }
  });
}

function appendRemediation(
  lines: string[],
  suggestions: readonly ReportRemediationSuggestion[],
): void {
  lines.push("  Remediation suggestions:");
  if (suggestions.length === 0) {
    lines.push("    (none)");
    return;
  }

  suggestions.forEach((suggestion, index) => {
    appendPrefixedText(
      lines,
      `    ${index + 1}. [${suggestion.safety}] `,
      suggestion.description,
    );
    if (suggestion.command !== undefined) {
      appendPrefixedText(lines, "       Command: ", suggestion.command);
    }
  });
}

function appendDocumentation(
  lines: string[],
  references: readonly ReportDocumentationReference[],
): void {
  lines.push("  Documentation:");
  if (references.length === 0) {
    lines.push("    (none)");
    return;
  }

  references.forEach((reference, index) => {
    appendPrefixedText(lines, `    ${index + 1}. `, reference.title);
    appendPrefixedText(lines, "       URL: ", reference.url);
  });
}

function appendMatch(lines: string[], match: ReportMatch, index: number): void {
  lines.push(`Diagnosis ${index + 1}`);
  appendPrefixedText(lines, "  Detector ID: ", match.detectorId);
  appendPrefixedText(lines, "  Ecosystem: ", match.ecosystem);
  appendPrefixedText(lines, "  Title: ", match.title);
  lines.push(`  Evidence score: ${match.score}/100`);
  appendStringList(lines, "Matched evidence", match.matchedEvidenceIds);
  appendBlock(lines, "Explanation", match.explanation);
  appendStringList(lines, "Likely causes", match.likelyCauses);
  appendDiagnosticSteps(lines, match.diagnosticSteps);
  appendRemediation(lines, match.remediation);
  appendDocumentation(lines, match.documentation);
}

export function formatPretty(result: AnalysisResult): string {
  const report = createReportData(result);
  const lines = [
    `Status: ${report.status}`,
    `Matches: ${report.matchCount}`,
    `Normalized input length: ${report.normalizedInputLength}`,
  ];

  if (report.matches.length === 0) {
    lines.push("", "No deterministic diagnosis matched the input.");
    return lines.join("\n");
  }

  for (const [index, match] of report.matches.entries()) {
    lines.push("");
    appendMatch(lines, match, index);
  }

  return lines.join("\n");
}
