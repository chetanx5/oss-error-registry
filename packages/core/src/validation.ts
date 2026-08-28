import type {
  DetectorDefinition,
  DetectorPlugin,
  TextPattern,
} from "./detector.js";

type UnknownRecord = Record<string, unknown>;

const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ARRAY_INDEX_PATTERN = /^(?:0|[1-9]\d*)$/u;
const DETECTOR_ID_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SUPPORTED_REGEX_FLAGS = new Set(["i", "m", "u"]);
const MAX_REGEX_SOURCE_LENGTH = 1_000;
const BACKREFERENCE_PATTERN = /\\[1-9]/u;
const NESTED_QUANTIFIER_PATTERN =
  /\((?:[^()\\]|\\.)*[*+](?:[^()\\]|\\.)*\)\s*(?:[*+]|\{\d+(?:,\d*)?\})/u;

function fail(context: string, path: string, message: string): never {
  throw new TypeError(`${context}: ${path} ${message}`);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function assertDataPropertiesOnly(
  value: object,
  context: string,
  path: string,
): void {
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && !("value" in descriptor)) {
      const fieldPath =
        typeof key === "string" && key !== "length" ? `${path}.${key}` : path;
      fail(context, fieldPath, "must be a data property");
    }
  }
}

function assertPlainObject(
  value: unknown,
  context: string,
  path: string,
): asserts value is UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(context, path, "must be a plain object");
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(context, path, "must be a plain object");
  }

  assertDataPropertiesOnly(value, context, path);
}

function assertOnlyKeys(
  record: UnknownRecord,
  allowedKeys: readonly string[],
  context: string,
  path: string,
): void {
  const allowed = new Set(allowedKeys);

  for (const key of Object.getOwnPropertyNames(record)) {
    if (!allowed.has(key)) {
      const fieldPath = path.length > 0 ? `${path}.${key}` : key;
      fail(context, fieldPath, "is not supported");
    }
  }

  if (Object.getOwnPropertySymbols(record).length > 0) {
    fail(context, path || "definition", "must not use symbol-keyed fields");
  }
}

function assertNonEmptyString(
  value: unknown,
  context: string,
  path: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(context, path, "must be a non-empty string");
  }
}

function assertOptionalNonEmptyString(
  record: UnknownRecord,
  key: string,
  context: string,
  path: string,
): void {
  if (hasOwn(record, key)) {
    assertNonEmptyString(record[key], context, `${path}.${key}`);
  }
}

function assertBoolean(
  value: unknown,
  context: string,
  path: string,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    fail(context, path, "must be a boolean");
  }
}

function assertIntegerInRange(
  value: unknown,
  context: string,
  path: string,
): asserts value is number {
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > 100
  ) {
    fail(context, path, "must be an integer between 1 and 100");
  }
}

function assertArray(
  value: unknown,
  context: string,
  path: string,
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    fail(context, path, "must be an array");
  }
  assertDataPropertiesOnly(value, context, path);

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      fail(context, path, "must not use symbol-keyed fields");
    }
    if (key === "length") {
      continue;
    }
    if (!ARRAY_INDEX_PATTERN.test(key) || Number(key) >= value.length) {
      fail(context, `${path}.${key}`, "is not supported");
    }
  }
}

function assertNonEmptyArray(
  value: unknown,
  context: string,
  path: string,
): asserts value is [unknown, ...unknown[]] {
  assertArray(value, context, path);
  if (value.length === 0) {
    fail(context, path, "must be a non-empty array");
  }
}

function assertStringList(value: unknown, context: string, path: string): void {
  assertNonEmptyArray(value, context, path);
  for (let index = 0; index < value.length; index += 1) {
    assertNonEmptyString(value[index], context, `${path}[${index}]`);
  }
}

function validateRegexFlags(
  flags: unknown,
  context: string,
  path: string,
): string {
  if (typeof flags !== "string") {
    fail(context, path, "must be a string");
  }

  const seen = new Set<string>();
  for (const flag of flags) {
    if (!SUPPORTED_REGEX_FLAGS.has(flag)) {
      fail(
        context,
        path,
        `contains unsupported flag "${flag}"; supported flags are "i", "m", and "u"`,
      );
    }
    if (seen.has(flag)) {
      fail(context, path, `must not contain duplicate flag "${flag}"`);
    }
    seen.add(flag);
  }

  return flags;
}

function assertReasonablySafeRegex(
  source: string,
  context: string,
  path: string,
): void {
  if (source.length > MAX_REGEX_SOURCE_LENGTH) {
    fail(
      context,
      path,
      `must not exceed ${MAX_REGEX_SOURCE_LENGTH} characters`,
    );
  }

  if (BACKREFERENCE_PATTERN.test(source)) {
    fail(context, path, "must not contain numeric backreferences");
  }

  if (NESTED_QUANTIFIER_PATTERN.test(source)) {
    fail(context, path, "contains a potentially unsafe nested quantifier");
  }
}

function assertTextPattern(
  value: unknown,
  context: string,
  path: string,
): asserts value is TextPattern {
  assertPlainObject(value, context, path);

  if (value["kind"] === "substring") {
    assertOnlyKeys(value, ["kind", "value", "caseSensitive"], context, path);
    assertNonEmptyString(value["value"], context, `${path}.value`);
    if (hasOwn(value, "caseSensitive")) {
      assertBoolean(value["caseSensitive"], context, `${path}.caseSensitive`);
    }
    return;
  }

  if (value["kind"] === "regex") {
    assertOnlyKeys(value, ["kind", "source", "flags", "scope"], context, path);
    assertNonEmptyString(value["source"], context, `${path}.source`);
    const flags = hasOwn(value, "flags")
      ? validateRegexFlags(value["flags"], context, `${path}.flags`)
      : "";

    if (
      hasOwn(value, "scope") &&
      value["scope"] !== "line" &&
      value["scope"] !== "input"
    ) {
      fail(context, `${path}.scope`, 'must be either "line" or "input"');
    }

    assertReasonablySafeRegex(value["source"], context, `${path}.source`);

    try {
      RegExp(value["source"], flags);
    } catch {
      fail(context, `${path}.source`, "must be a valid regular expression");
    }
    return;
  }

  fail(context, `${path}.kind`, 'must be either "substring" or "regex"');
}

function assertEvidence(value: unknown, context: string, path: string): string {
  assertPlainObject(value, context, path);
  assertOnlyKeys(
    value,
    ["id", "description", "weight", "required", "pattern"],
    context,
    path,
  );
  assertNonEmptyString(value["id"], context, `${path}.id`);
  assertNonEmptyString(value["description"], context, `${path}.description`);
  assertIntegerInRange(value["weight"], context, `${path}.weight`);
  assertBoolean(value["required"], context, `${path}.required`);
  assertTextPattern(value["pattern"], context, `${path}.pattern`);
  return value["id"];
}

function assertDiagnosticSteps(
  value: unknown,
  context: string,
  path: string,
): void {
  assertNonEmptyArray(value, context, path);
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}[${index}]`;
    const step = value[index];
    assertPlainObject(step, context, itemPath);
    assertOnlyKeys(step, ["description", "command"], context, itemPath);
    assertNonEmptyString(
      step["description"],
      context,
      `${itemPath}.description`,
    );
    assertOptionalNonEmptyString(step, "command", context, itemPath);
  }
}

function assertRemediation(
  value: unknown,
  context: string,
  path: string,
): void {
  assertNonEmptyArray(value, context, path);
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}[${index}]`;
    const suggestion = value[index];
    assertPlainObject(suggestion, context, itemPath);
    assertOnlyKeys(
      suggestion,
      ["description", "safety", "command"],
      context,
      itemPath,
    );
    assertNonEmptyString(
      suggestion["description"],
      context,
      `${itemPath}.description`,
    );
    if (suggestion["safety"] !== "safe" && suggestion["safety"] !== "review") {
      fail(context, `${itemPath}.safety`, 'must be either "safe" or "review"');
    }
    assertOptionalNonEmptyString(suggestion, "command", context, itemPath);
  }
}

function assertDocumentation(
  value: unknown,
  context: string,
  path: string,
): void {
  assertNonEmptyArray(value, context, path);
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}[${index}]`;
    const reference = value[index];
    assertPlainObject(reference, context, itemPath);
    assertOnlyKeys(reference, ["title", "url"], context, itemPath);
    assertNonEmptyString(reference["title"], context, `${itemPath}.title`);
    assertNonEmptyString(reference["url"], context, `${itemPath}.url`);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(reference["url"]);
    } catch {
      fail(context, `${itemPath}.url`, "must be a valid HTTPS URL");
    }

    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname.length === 0) {
      fail(context, `${itemPath}.url`, "must be a valid HTTPS URL");
    }
  }
}

export function assertDetectorDefinition(
  value: unknown,
): asserts value is DetectorDefinition {
  assertPlainObject(value, 'Detector "<unknown>"', "definition");

  const detectorId =
    typeof value["id"] === "string" && value["id"].length > 0
      ? value["id"]
      : "<unknown>";
  const context = `Detector "${detectorId}"`;

  assertOnlyKeys(
    value,
    [
      "schemaVersion",
      "id",
      "ecosystem",
      "title",
      "explanation",
      "match",
      "likelyCauses",
      "diagnosticSteps",
      "remediation",
      "documentation",
    ],
    context,
    "",
  );

  if (value["schemaVersion"] !== 1) {
    fail(context, "schemaVersion", "must be the supported version 1");
  }

  assertNonEmptyString(value["id"], context, "id");
  if (!DETECTOR_ID_PATTERN.test(value["id"])) {
    fail(
      context,
      "id",
      'must use lowercase kebab-case in the form "<ecosystem>/<detector-name>"',
    );
  }

  assertNonEmptyString(value["ecosystem"], context, "ecosystem");
  if (!KEBAB_CASE_PATTERN.test(value["ecosystem"])) {
    fail(context, "ecosystem", "must use lowercase kebab-case");
  }

  const ecosystemPrefix = value["id"].split("/", 1)[0];
  if (value["ecosystem"] !== ecosystemPrefix) {
    fail(context, "ecosystem", `must match ID prefix "${ecosystemPrefix}"`);
  }

  assertNonEmptyString(value["title"], context, "title");
  assertNonEmptyString(value["explanation"], context, "explanation");

  assertPlainObject(value["match"], context, "match");
  assertOnlyKeys(
    value["match"],
    ["threshold", "evidence", "exclusions"],
    context,
    "match",
  );
  assertIntegerInRange(value["match"]["threshold"], context, "match.threshold");
  assertNonEmptyArray(value["match"]["evidence"], context, "match.evidence");

  const evidenceIds = new Set<string>();
  for (let index = 0; index < value["match"]["evidence"].length; index += 1) {
    const evidenceId = assertEvidence(
      value["match"]["evidence"][index],
      context,
      `match.evidence[${index}]`,
    );
    if (evidenceIds.has(evidenceId)) {
      fail(
        context,
        `match.evidence[${index}].id`,
        `must be unique; duplicate "${evidenceId}"`,
      );
    }
    evidenceIds.add(evidenceId);
  }

  assertArray(value["match"]["exclusions"], context, "match.exclusions");
  for (let index = 0; index < value["match"]["exclusions"].length; index += 1) {
    assertTextPattern(
      value["match"]["exclusions"][index],
      context,
      `match.exclusions[${index}]`,
    );
  }

  assertStringList(value["likelyCauses"], context, "likelyCauses");
  assertDiagnosticSteps(value["diagnosticSteps"], context, "diagnosticSteps");
  assertRemediation(value["remediation"], context, "remediation");
  assertDocumentation(value["documentation"], context, "documentation");
}

export function assertDetectorPlugin(
  value: unknown,
): asserts value is DetectorPlugin {
  assertPlainObject(value, 'Plugin "<unknown>"', "definition");

  const pluginId =
    typeof value["id"] === "string" && value["id"].length > 0
      ? value["id"]
      : "<unknown>";
  const context = `Plugin "${pluginId}"`;

  assertOnlyKeys(value, ["apiVersion", "id", "detectors"], context, "");
  if (value["apiVersion"] !== 1) {
    fail(context, "apiVersion", "must be the supported version 1");
  }
  assertNonEmptyString(value["id"], context, "id");
  assertNonEmptyArray(value["detectors"], context, "detectors");

  const detectorIds = new Set<string>();
  for (let index = 0; index < value["detectors"].length; index += 1) {
    const detector = value["detectors"][index];
    assertDetectorDefinition(detector);
    if (detectorIds.has(detector.id)) {
      fail(
        context,
        `detectors[${index}].id`,
        `must be unique; duplicate "${detector.id}"`,
      );
    }
    detectorIds.add(detector.id);
  }
}
