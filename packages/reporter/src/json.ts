import type { AnalysisResult } from "@oss-error-registry/core";

import { createReportData } from "./report-data.js";

function escapeRawJsonTerminalControls(value: string): string {
  let escaped = "";

  for (const character of value) {
    const code = character.charCodeAt(0);
    escaped +=
      code >= 0x7f && code <= 0x9f
        ? `\\u${code.toString(16).padStart(4, "0")}`
        : character;
  }

  return escaped;
}

export function formatJson(result: AnalysisResult): string {
  return escapeRawJsonTerminalControls(
    JSON.stringify(createReportData(result), null, 2),
  );
}
