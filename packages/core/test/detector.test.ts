import { describe, expect, expectTypeOf, it } from "vitest";

import {
  defineDetector,
  type DetectorDefinition,
} from "@oss-error-registry/core";

import { npmEresolvePeerDependencyExample } from "./fixtures/npm-eresolve-peer-dependency.js";

const detectorContext = 'Detector "npm/eresolve-peer-dependency"';

function validateUnknown(value: unknown): void {
  defineDetector(value as DetectorDefinition);
}

function withEvidence(evidence: readonly unknown[]): unknown {
  return {
    ...npmEresolvePeerDependencyExample,
    match: {
      ...npmEresolvePeerDependencyExample.match,
      evidence,
    },
  };
}

function withFirstEvidence(changes: Record<string, unknown>): unknown {
  return withEvidence([
    {
      ...npmEresolvePeerDependencyExample.match.evidence[0],
      ...changes,
    },
    npmEresolvePeerDependencyExample.match.evidence[1],
  ]);
}

function withRegexPattern(changes: Record<string, unknown>): unknown {
  return withEvidence([
    npmEresolvePeerDependencyExample.match.evidence[0],
    {
      ...npmEresolvePeerDependencyExample.match.evidence[1],
      pattern: {
        ...npmEresolvePeerDependencyExample.match.evidence[1].pattern,
        ...changes,
      },
    },
  ]);
}

function withoutDetectorField(field: string): unknown {
  const candidate = structuredClone(
    npmEresolvePeerDependencyExample,
  ) as unknown as Record<string, unknown>;
  delete candidate[field];
  return candidate;
}

function withoutMatchField(field: string): unknown {
  const candidate = structuredClone(
    npmEresolvePeerDependencyExample,
  ) as unknown as Record<string, unknown>;
  const match = candidate["match"];
  if (match === null || typeof match !== "object" || Array.isArray(match)) {
    throw new TypeError("The test fixture must contain a match object");
  }
  delete (match as Record<string, unknown>)[field];
  return candidate;
}

describe("defineDetector", () => {
  it("accepts the complete test-only detector example", () => {
    const input = structuredClone(npmEresolvePeerDependencyExample);
    const detector = defineDetector(input);

    expect(detector.id).toBe("npm/eresolve-peer-dependency");
    expect(detector.match.evidence[0].pattern.kind).toBe("substring");
    expect(detector.match.evidence[1].pattern.kind).toBe("regex");
    expect(detector.match.exclusions).toHaveLength(1);
    expect(detector.diagnosticSteps[0].command).toBe(
      "npm explain <package-name>",
    );
    expect(detector.remediation.map(({ safety }) => safety)).toEqual([
      "safe",
      "review",
    ]);
    expect(detector.documentation[0].url).toMatch(/^https:\/\//u);
    expectTypeOf(detector.id).toEqualTypeOf<"npm/eresolve-peer-dependency">();
    expectTypeOf(detector.schemaVersion).toEqualTypeOf<1>();
  });

  it("deep-freezes validated detector configuration", () => {
    const detector = defineDetector(
      structuredClone(npmEresolvePeerDependencyExample),
    );

    expect(Object.isFrozen(detector)).toBe(true);
    expect(Object.isFrozen(detector.match)).toBe(true);

    const collections: readonly (readonly unknown[])[] = [
      detector.match.evidence,
      detector.match.exclusions,
      detector.likelyCauses,
      detector.diagnosticSteps,
      detector.remediation,
      detector.documentation,
    ];
    for (const collection of collections) {
      expect(Object.isFrozen(collection)).toBe(true);
      expect(Reflect.set(collection, "0", undefined)).toBe(false);
    }

    expect(Object.isFrozen(detector.match.evidence[0])).toBe(true);
    expect(Object.isFrozen(detector.match.evidence[0].pattern)).toBe(true);
    expect(Object.isFrozen(detector.match.exclusions[0])).toBe(true);
    expect(Object.isFrozen(detector.diagnosticSteps[0])).toBe(true);
    expect(Object.isFrozen(detector.remediation[0])).toBe(true);
    expect(Object.isFrozen(detector.documentation[0])).toBe(true);
    expect(Reflect.set(detector, "title", "Changed")).toBe(false);
  });

  it("keeps commands as inert text", () => {
    const commandWasExecuted = false;
    const detector = defineDetector({
      ...npmEresolvePeerDependencyExample,
      diagnosticSteps: [
        {
          description: "An informational command.",
          command: "this string must never be executed",
        },
      ],
    });

    expect(detector.diagnosticSteps[0].command).toBe(
      "this string must never be executed",
    );
    expect(commandWasExecuted).toBe(false);
  });

  it("accepts new lowercase ecosystems without a core enum", () => {
    const detector = defineDetector({
      ...npmEresolvePeerDependencyExample,
      id: "future-build-tool/example-error",
      ecosystem: "future-build-tool",
    });

    expect(detector.ecosystem).toBe("future-build-tool");
  });

  it.each([
    ["NPM/eresolve", "NPM/eresolve"],
    ["npm/peer_dependency", "npm/peer_dependency"],
    ["npm", "npm"],
  ])("rejects malformed detector ID %s", (id, displayedId) => {
    expect(() =>
      validateUnknown({ ...npmEresolvePeerDependencyExample, id }),
    ).toThrowError(
      `Detector "${displayedId}": id must use lowercase kebab-case in the form "<ecosystem>/<detector-name>"`,
    );
  });

  it("rejects an ecosystem that differs from the detector ID prefix", () => {
    expect(() =>
      validateUnknown({
        ...npmEresolvePeerDependencyExample,
        ecosystem: "node",
      }),
    ).toThrowError(`${detectorContext}: ecosystem must match ID prefix "npm"`);
  });

  it("rejects duplicate evidence IDs with an indexed field path", () => {
    expect(() =>
      validateUnknown(
        withEvidence([
          npmEresolvePeerDependencyExample.match.evidence[0],
          {
            ...npmEresolvePeerDependencyExample.match.evidence[1],
            id: "npm-eresolve-code",
          },
        ]),
      ),
    ).toThrowError(
      `${detectorContext}: match.evidence[1].id must be unique; duplicate "npm-eresolve-code"`,
    );
  });

  it.each([
    ["title", { ...npmEresolvePeerDependencyExample, title: " " }],
    ["explanation", { ...npmEresolvePeerDependencyExample, explanation: "" }],
  ])("rejects an empty %s", (field, value) => {
    expect(() => validateUnknown(value)).toThrowError(
      `${detectorContext}: ${field} must be a non-empty string`,
    );
  });

  it("rejects an empty evidence ID", () => {
    expect(() => validateUnknown(withFirstEvidence({ id: "" }))).toThrowError(
      `${detectorContext}: match.evidence[0].id must be a non-empty string`,
    );
  });

  it("rejects an empty substring", () => {
    expect(() =>
      validateUnknown(
        withFirstEvidence({ pattern: { kind: "substring", value: "" } }),
      ),
    ).toThrowError(
      `${detectorContext}: match.evidence[0].pattern.value must be a non-empty string`,
    );
  });

  it("rejects RegExp objects in serializable pattern fields", () => {
    expect(() =>
      validateUnknown(withFirstEvidence({ pattern: /ERESOLVE/iu })),
    ).toThrowError(
      `${detectorContext}: match.evidence[0].pattern must be a plain object`,
    );
  });

  it.each([0, 101, 1.5])("rejects threshold %s", (threshold) => {
    expect(() =>
      validateUnknown({
        ...npmEresolvePeerDependencyExample,
        match: { ...npmEresolvePeerDependencyExample.match, threshold },
      }),
    ).toThrowError(
      `${detectorContext}: match.threshold must be an integer between 1 and 100`,
    );
  });

  it.each([0, 101, 1.5])("rejects evidence weight %s", (weight) => {
    expect(() => validateUnknown(withFirstEvidence({ weight }))).toThrowError(
      `${detectorContext}: match.evidence[0].weight must be an integer between 1 and 100`,
    );
  });

  it("requires evidence.required to be a boolean", () => {
    expect(() =>
      validateUnknown(withFirstEvidence({ required: "yes" })),
    ).toThrowError(
      `${detectorContext}: match.evidence[0].required must be a boolean`,
    );
  });

  it("rejects an invalid regular expression", () => {
    expect(() =>
      validateUnknown(withRegexPattern({ source: "(" })),
    ).toThrowError(
      `${detectorContext}: match.evidence[1].pattern.source must be a valid regular expression`,
    );
  });

  it("rejects a regular expression source above the length limit", () => {
    expect(() =>
      validateUnknown(withRegexPattern({ source: "a".repeat(1_001) })),
    ).toThrowError(
      `${detectorContext}: match.evidence[1].pattern.source must not exceed 1000 characters`,
    );
  });

  it("rejects unsupported regular expression flags", () => {
    expect(() =>
      validateUnknown(withRegexPattern({ flags: "g" })),
    ).toThrowError(
      `${detectorContext}: match.evidence[1].pattern.flags contains unsupported flag "g"; supported flags are "i", "m", and "u"`,
    );
  });

  it("rejects duplicate regular expression flags", () => {
    expect(() =>
      validateUnknown(withRegexPattern({ flags: "ii" })),
    ).toThrowError(
      `${detectorContext}: match.evidence[1].pattern.flags must not contain duplicate flag "i"`,
    );
  });

  it("rejects explicitly undefined regular expression flags", () => {
    expect(() =>
      validateUnknown(withRegexPattern({ flags: undefined })),
    ).toThrowError(
      `${detectorContext}: match.evidence[1].pattern.flags must be a string`,
    );
  });

  it("rejects unsupported regular expression scopes", () => {
    expect(() =>
      validateUnknown(withRegexPattern({ scope: "stream" })),
    ).toThrowError(
      `${detectorContext}: match.evidence[1].pattern.scope must be either "line" or "input"`,
    );
  });

  it.each([
    [
      "nested quantifier",
      "(a+)+$",
      "contains a potentially unsafe nested quantifier",
    ],
    [
      "numeric backreference",
      "(error)\\1",
      "must not contain numeric backreferences",
    ],
  ])("rejects a potentially unsafe %s", (_name, source, message) => {
    expect(() => validateUnknown(withRegexPattern({ source }))).toThrowError(
      `${detectorContext}: match.evidence[1].pattern.source ${message}`,
    );
  });

  it("rejects non-HTTPS documentation URLs", () => {
    expect(() =>
      validateUnknown({
        ...npmEresolvePeerDependencyExample,
        documentation: [
          {
            title: "Insecure documentation",
            url: "http://example.com/docs",
          },
        ],
      }),
    ).toThrowError(
      `${detectorContext}: documentation[0].url must be a valid HTTPS URL`,
    );
  });

  it("rejects malformed documentation URLs", () => {
    expect(() =>
      validateUnknown({
        ...npmEresolvePeerDependencyExample,
        documentation: [
          {
            title: "Malformed documentation",
            url: "not a URL",
          },
        ],
      }),
    ).toThrowError(
      `${detectorContext}: documentation[0].url must be a valid HTTPS URL`,
    );
  });

  it.each([
    ["match.evidence", withEvidence([])],
    ["likelyCauses", { ...npmEresolvePeerDependencyExample, likelyCauses: [] }],
    [
      "diagnosticSteps",
      { ...npmEresolvePeerDependencyExample, diagnosticSteps: [] },
    ],
    ["remediation", { ...npmEresolvePeerDependencyExample, remediation: [] }],
    [
      "documentation",
      { ...npmEresolvePeerDependencyExample, documentation: [] },
    ],
  ])("rejects an empty required array at %s", (path, value) => {
    expect(() => validateUnknown(value)).toThrowError(
      `${detectorContext}: ${path} must be a non-empty array`,
    );
  });

  it.each([
    ["match.evidence", withoutMatchField("evidence")],
    ["likelyCauses", withoutDetectorField("likelyCauses")],
    ["diagnosticSteps", withoutDetectorField("diagnosticSteps")],
    ["remediation", withoutDetectorField("remediation")],
    ["documentation", withoutDetectorField("documentation")],
  ])("rejects a missing required array at %s", (path, value) => {
    expect(() => validateUnknown(value)).toThrowError(
      `${detectorContext}: ${path} must be an array`,
    );
  });

  it("rejects unsupported detector schema versions", () => {
    expect(() =>
      validateUnknown({
        ...npmEresolvePeerDependencyExample,
        schemaVersion: 2,
      }),
    ).toThrowError(
      `${detectorContext}: schemaVersion must be the supported version 1`,
    );
  });

  it("rejects executable or unknown detector fields without invoking them", () => {
    let callbackWasInvoked = false;
    const callback = (): void => {
      callbackWasInvoked = true;
    };

    expect(() =>
      validateUnknown({
        ...npmEresolvePeerDependencyExample,
        callback,
      }),
    ).toThrowError(`${detectorContext}: callback is not supported`);
    expect(callbackWasInvoked).toBe(false);
  });

  it("rejects non-enumerable executable fields without invoking them", () => {
    let callbackWasInvoked = false;
    const candidate = { ...npmEresolvePeerDependencyExample };
    Object.defineProperty(candidate, "callback", {
      enumerable: false,
      value: (): void => {
        callbackWasInvoked = true;
      },
    });

    expect(() => validateUnknown(candidate)).toThrowError(
      `${detectorContext}: callback is not supported`,
    );
    expect(callbackWasInvoked).toBe(false);
  });

  it("rejects executable properties attached to configuration arrays", () => {
    let callbackWasInvoked = false;
    const evidence: unknown[] = [
      ...npmEresolvePeerDependencyExample.match.evidence,
    ];
    Object.defineProperty(evidence, "onMatch", {
      enumerable: false,
      value: (): void => {
        callbackWasInvoked = true;
      },
    });

    expect(() => validateUnknown(withEvidence(evidence))).toThrowError(
      `${detectorContext}: match.evidence.onMatch is not supported`,
    );
    expect(callbackWasInvoked).toBe(false);
  });

  it("rejects accessor properties without invoking their getters", () => {
    let getterWasInvoked = false;
    const candidate = { ...npmEresolvePeerDependencyExample };
    Object.defineProperty(candidate, "title", {
      enumerable: true,
      get: () => {
        getterWasInvoked = true;
        return "Unexpected title";
      },
    });

    expect(() => validateUnknown(candidate)).toThrowError(
      'Detector "<unknown>": definition.title must be a data property',
    );
    expect(getterWasInvoked).toBe(false);
  });

  it("rejects definitions with custom prototypes", () => {
    const candidate = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      npmEresolvePeerDependencyExample,
    );

    expect(() => validateUnknown(candidate)).toThrowError(
      'Detector "<unknown>": definition must be a plain object',
    );
  });
});
