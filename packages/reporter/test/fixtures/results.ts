import type { AnalysisResult, DetectorMatch } from "@oss-error-registry/core";

export function createMatch(
  overrides: Partial<DetectorMatch> = {},
): DetectorMatch {
  return {
    detectorId: "npm/eresolve-peer-dependency",
    ecosystem: "npm",
    title: "Peer dependency resolution conflict",
    score: 90,
    matchedEvidenceIds: ["npm-eresolve-code", "dependency-tree-message"],
    explanation:
      "npm could not construct a dependency tree that satisfies the declared peer dependency ranges.",
    likelyCauses: [
      "Two packages require incompatible peer dependency versions.",
      "An installed version falls outside a declared peer range.",
    ],
    diagnosticSteps: [
      {
        description: "Inspect why npm selected the conflicting package.",
        command: "npm explain <package-name>",
      },
      {
        description: "Compare the declared peer dependency ranges.",
      },
    ],
    remediation: [
      {
        description: "Review the conflicting peer dependency ranges.",
        safety: "safe",
      },
      {
        description: "Align versions after reviewing compatibility notes.",
        safety: "review",
        command: "npm install <package-name>@<compatible-version>",
      },
    ],
    documentation: [
      {
        title: "npm peer dependency documentation",
        url: "https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependencies",
      },
    ],
    ...overrides,
  };
}

export function createResult(
  matches: readonly DetectorMatch[] = [createMatch()],
  normalizedInputLength = 123,
): AnalysisResult {
  return { normalizedInputLength, matches };
}

export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }

  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
  }

  return Object.freeze(value);
}
