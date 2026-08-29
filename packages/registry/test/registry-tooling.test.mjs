import { Buffer } from "node:buffer";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  MAX_CASES_FILE_BYTES,
  MAX_FIXTURE_BYTES,
  RegistryValidationError,
  discoverDetectorDirectories,
  generateRegistryIndex,
  renderRegistryIndex,
  validateCasesDocument,
  validateDetectorModuleSource,
  validateLoadedDetectorCollection,
  validateRegistryFilesystem,
} from "../scripts/registry-tooling.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createTemporaryRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "oss-error-registry-"));
  temporaryDirectories.push(root);
  return root;
}

function defaultCases(detectorId) {
  return {
    detectorId,
    cases: [
      {
        name: "positive",
        fixture: "fixtures/positive/basic.log",
        expect: { match: true, score: 50 },
      },
    ],
  };
}

async function createDetectorTree(root, detectorId, options = {}) {
  const [ecosystem, detectorName] = detectorId.split("/");
  const detectorDirectory = path.join(root, ecosystem, detectorName);
  await mkdir(path.join(detectorDirectory, "fixtures", "positive"), {
    recursive: true,
  });
  await mkdir(path.join(detectorDirectory, "fixtures", "negative"), {
    recursive: true,
  });
  if (options.includeDetector !== false) {
    await writeFile(
      path.join(detectorDirectory, "detector.ts"),
      'import { defineDetector } from "@oss-error-registry/core";\n\nexport default defineDetector({});\n',
      "utf8",
    );
  }
  const casesSource =
    options.casesSource ??
    `${JSON.stringify(options.cases ?? defaultCases(detectorId), null, 2)}\n`;
  await writeFile(
    path.join(detectorDirectory, "cases.json"),
    casesSource,
    "utf8",
  );

  const fixtureEntries = options.fixtures ?? {
    "fixtures/positive/basic.log": "error text\n",
  };
  for (const [relativePath, contents] of Object.entries(fixtureEntries)) {
    const fixturePath = path.join(
      detectorDirectory,
      ...relativePath.split("/"),
    );
    await mkdir(path.dirname(fixturePath), { recursive: true });
    await writeFile(fixturePath, contents);
  }
  return detectorDirectory;
}

describe("registry discovery and generation", () => {
  it("accepts the documented declarative detector module form", () => {
    expect(() =>
      validateDetectorModuleSource(
        'import { defineDetector } from "@oss-error-registry/core";\nexport default defineDetector({ id: "npm/example", values: [true, 1] });\n',
      ),
    ).not.toThrow();
  });

  it.each([
    [
      "missing default export",
      'import { defineDetector } from "@oss-error-registry/core";\n',
    ],
    [
      "additional named export",
      'import { defineDetector } from "@oss-error-registry/core";\nexport const extra = 1;\nexport default defineDetector({});\n',
    ],
    [
      "non-detector default export",
      'import { defineDetector } from "@oss-error-registry/core";\nexport default {};\n',
    ],
    [
      "wrong import",
      'import { defineDetector } from "untrusted-package";\nexport default defineDetector({});\n',
    ],
    [
      "invalid TypeScript",
      'import { defineDetector } from "@oss-error-registry/core";\nexport default defineDetector({\n',
    ],
    [
      "top-level throw",
      'import { defineDetector } from "@oss-error-registry/core";\nthrow new Error("boom");\nexport default defineDetector({});\n',
    ],
    [
      "callback value",
      'import { defineDetector } from "@oss-error-registry/core";\nexport default defineDetector({ callback: () => true });\n',
    ],
    [
      "executable value",
      'import { defineDetector } from "@oss-error-registry/core";\nexport default defineDetector({ title: process.cwd() });\n',
    ],
  ])("rejects detector module with %s", (_description, source) => {
    expect(() => validateDetectorModuleSource(source)).toThrowError(
      RegistryValidationError,
    );
  });

  it("discovers detector directories in deterministic detector-ID order", async () => {
    const root = await createTemporaryRoot();
    await createDetectorTree(root, "npm/z-last");
    await createDetectorTree(root, "docker/a-first");

    const entries = await discoverDetectorDirectories(root);
    expect(entries.map(({ detectorId }) => detectorId)).toEqual([
      "docker/a-first",
      "npm/z-last",
    ]);
  });

  it("renders deterministic static imports and a manual-edit warning", () => {
    const entries = [
      {
        ecosystem: "npm",
        detectorName: "z-last",
        detectorId: "npm/z-last",
        directory: "ignored",
      },
      {
        ecosystem: "docker",
        detectorName: "a-first",
        detectorId: "docker/a-first",
        directory: "ignored",
      },
    ];

    const first = renderRegistryIndex(entries);
    const second = renderRegistryIndex([...entries].reverse());
    expect(second).toBe(first);
    expect(first).toContain("DO NOT EDIT MANUALLY");
    expect(first).toContain(
      'import detector_docker__a_first from "../detectors/docker/a-first/detector.js";',
    );
    expect(first.indexOf("docker/a-first")).toBeLessThan(
      first.indexOf("npm/z-last"),
    );
    expect(first).not.toMatch(/[A-Z]:\\|\/Users\/|\/home\//u);
    expect(first).not.toContain("\\");
    expect(first).not.toContain("import(");
  });

  it("creates distinct import aliases for otherwise similar IDs", () => {
    const output = renderRegistryIndex([
      {
        ecosystem: "a-b",
        detectorName: "c",
        detectorId: "a-b/c",
        directory: "ignored",
      },
      {
        ecosystem: "a",
        detectorName: "b-c",
        detectorId: "a/b-c",
        directory: "ignored",
      },
    ]);

    expect(output).toContain("detector_a_b__c");
    expect(output).toContain("detector_a__b_c");
  });

  it("produces identical output on repeated generation", async () => {
    const root = await createTemporaryRoot();
    const detectorsRoot = path.join(root, "detectors");
    await createDetectorTree(detectorsRoot, "npm/example");
    const generatedFile = path.join(root, "generated", "detectors.ts");

    const first = await generateRegistryIndex({
      detectorsRoot,
      generatedFile,
      check: false,
    });
    const second = await generateRegistryIndex({
      detectorsRoot,
      generatedFile,
      check: false,
    });

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(await readFile(generatedFile, "utf8")).toBe(first.output);
  });

  it("detects generated-file drift without rewriting it", async () => {
    const root = await createTemporaryRoot();
    const detectorsRoot = path.join(root, "detectors");
    await createDetectorTree(detectorsRoot, "npm/example");
    const generatedFile = path.join(root, "generated", "detectors.ts");
    await mkdir(path.dirname(generatedFile), { recursive: true });
    await writeFile(generatedFile, "manually changed\n", "utf8");

    await expect(
      generateRegistryIndex({
        detectorsRoot,
        generatedFile,
        check: true,
      }),
    ).rejects.toThrowError('run "pnpm registry:generate"');
    expect(await readFile(generatedFile, "utf8")).toBe("manually changed\n");
  });

  it("passes check mode for a current generated file", async () => {
    const root = await createTemporaryRoot();
    const detectorsRoot = path.join(root, "detectors");
    await createDetectorTree(detectorsRoot, "npm/example");
    const generatedFile = path.join(root, "generated", "detectors.ts");
    await generateRegistryIndex({
      detectorsRoot,
      generatedFile,
      check: false,
    });

    const result = await generateRegistryIndex({
      detectorsRoot,
      generatedFile,
      check: true,
    });
    expect(result.changed).toBe(false);
  });

  it("fails predictably when the generated file is missing without creating it", async () => {
    const root = await createTemporaryRoot();
    const detectorsRoot = path.join(root, "detectors");
    await createDetectorTree(detectorsRoot, "npm/example");
    const generatedFile = path.join(root, "generated", "detectors.ts");

    await expect(
      generateRegistryIndex({
        detectorsRoot,
        generatedFile,
        check: true,
      }),
    ).rejects.toThrowError('run "pnpm registry:generate"');
    await expect(readFile(generatedFile, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects duplicate detector IDs before rendering", () => {
    const entry = {
      ecosystem: "npm",
      detectorName: "example",
      detectorId: "npm/example",
      directory: "ignored",
    };
    expect(() => renderRegistryIndex([entry, entry])).toThrowError(
      'duplicate detector ID "npm/example"',
    );
  });

  it("rejects a loaded detector ID that differs from its directory", () => {
    expect(() =>
      validateLoadedDetectorCollection(
        [
          {
            ecosystem: "npm",
            detectorName: "example",
            detectorId: "npm/example",
            directory: "ignored",
          },
        ],
        [{ id: "npm/wrong", ecosystem: "npm" }],
      ),
    ).toThrowError(
      'default export ID "npm/wrong" must equal directory ID "npm/example"',
    );
  });

  it("rejects duplicate loaded detector IDs", () => {
    expect(() =>
      validateLoadedDetectorCollection(
        [
          {
            ecosystem: "npm",
            detectorName: "first",
            detectorId: "npm/first",
            directory: "ignored",
          },
          {
            ecosystem: "npm",
            detectorName: "second",
            detectorId: "npm/second",
            directory: "ignored",
          },
        ],
        [
          { id: "npm/first", ecosystem: "npm" },
          { id: "npm/first", ecosystem: "npm" },
        ],
      ),
    ).toThrowError('duplicates loaded detector ID "npm/first"');
  });

  it("rejects a loaded detector ecosystem that differs from its directory", () => {
    expect(() =>
      validateLoadedDetectorCollection(
        [
          {
            ecosystem: "npm",
            detectorName: "example",
            detectorId: "npm/example",
            directory: "ignored",
          },
        ],
        [{ id: "npm/example", ecosystem: "yarn" }],
      ),
    ).toThrowError('ecosystem "yarn" must equal directory ecosystem "npm"');
  });

  it.each(["Npm/example", "bad_name/example"])(
    "rejects invalid ecosystem directory %s",
    async (detectorId) => {
      const root = await createTemporaryRoot();
      await createDetectorTree(root, detectorId);
      await expect(discoverDetectorDirectories(root)).rejects.toBeInstanceOf(
        RegistryValidationError,
      );
    },
  );

  it("rejects uppercase detector directory names", async () => {
    const root = await createTemporaryRoot();
    await createDetectorTree(root, "npm/Example");
    await expect(discoverDetectorDirectories(root)).rejects.toThrowError(
      "must use lowercase kebab-case",
    );
  });

  it.each([undefined, null, "not a detector", 42, {}])(
    "rejects malformed loaded detector value %s",
    (detector) => {
      expect(() =>
        validateLoadedDetectorCollection(
          [
            {
              ecosystem: "npm",
              detectorName: "example",
              detectorId: "npm/example",
              directory: "ignored",
            },
          ],
          [detector],
        ),
      ).toThrowError(RegistryValidationError);
    },
  );

  it("rejects a detector directory missing detector.ts", async () => {
    const root = await createTemporaryRoot();
    await createDetectorTree(root, "npm/example", { includeDetector: false });
    await expect(discoverDetectorDirectories(root)).rejects.toThrowError(
      "detector.ts: required file is missing",
    );
  });
});

describe("cases.json and fixture validation", () => {
  it("accepts strict positive and negative case definitions", () => {
    const document = validateCasesDocument({
      detectorId: "npm/example",
      cases: [
        {
          name: "positive",
          fixture: "fixtures/positive/basic.log",
          expect: { match: true, score: 80 },
        },
        {
          name: "negative",
          fixture: "fixtures/negative/other.log",
          expect: { match: false },
        },
      ],
    });
    expect(document.cases).toHaveLength(2);
  });

  it.each([undefined, null, [], "invalid"])(
    "requires cases.json to be an object: %s",
    (value) => {
      expect(() => validateCasesDocument(value)).toThrowError(
        "must be a plain object",
      );
    },
  );

  it("requires detectorId, cases, case fields, and expected match", () => {
    expect(() => validateCasesDocument({ cases: [] })).toThrowError(
      "detectorId: must be a non-empty string",
    );
    expect(() =>
      validateCasesDocument({ detectorId: "npm/example" }),
    ).toThrowError("cases: must be a non-empty array");
    expect(() =>
      validateCasesDocument({
        detectorId: "npm/example",
        cases: [null],
      }),
    ).toThrowError("cases[0]: must be a plain object");
    expect(() =>
      validateCasesDocument({
        detectorId: "npm/example",
        cases: [
          {
            name: "   ",
            fixture: "fixtures/positive/basic.log",
            expect: { match: true, score: 50 },
          },
        ],
      }),
    ).toThrowError("name: must be a non-empty string");
    expect(() =>
      validateCasesDocument({
        detectorId: "npm/example",
        cases: [{ name: "missing fields" }],
      }),
    ).toThrowError("expect: must be a plain object");
    expect(() =>
      validateCasesDocument({
        detectorId: "npm/example",
        cases: [
          {
            name: "missing match",
            fixture: "fixtures/positive/basic.log",
            expect: {},
          },
        ],
      }),
    ).toThrowError("expect.match: must be a boolean");
  });

  it.each([0, 101, 1.5, "80"])("rejects invalid positive score %s", (score) => {
    const value = defaultCases("npm/example");
    value.cases[0].expect.score = score;
    expect(() => validateCasesDocument(value)).toThrowError(
      "must be an integer between 1 and 100",
    );
  });

  it("requires scores only for positive cases", () => {
    const positive = defaultCases("npm/example");
    delete positive.cases[0].expect.score;
    expect(() => validateCasesDocument(positive)).toThrowError(
      "is required when match is true",
    );

    const negative = defaultCases("npm/example");
    negative.cases[0] = {
      name: "negative",
      fixture: "fixtures/negative/basic.log",
      expect: { match: false, score: 0 },
    };
    expect(() => validateCasesDocument(negative)).toThrowError(
      "must be omitted when match is false",
    );
  });

  it("rejects fixture path traversal", () => {
    const value = defaultCases("npm/example");
    value.cases[0].fixture = "fixtures/positive/../secret.log";
    expect(() => validateCasesDocument(value)).toThrowError(
      "must not contain empty, current, or parent path segments",
    );
  });

  it.each([
    "../secret.txt",
    "../../secret.txt",
    "fixtures/positive/../../../secret.txt",
    "/absolute/path.log",
    "C:\\absolute\\path.log",
    "C:/absolute/path.log",
    "\\\\server\\share\\file.log",
    "//server/share/file.log",
    "fixtures\\positive\\..\\..\\secret.log",
    "fixtures/positive/./secret.log",
    "fixtures//positive/basic.log",
  ])("rejects hostile POSIX or Windows fixture path %s", (fixture) => {
    const value = defaultCases("npm/example");
    value.cases[0].fixture = fixture;
    expect(() => validateCasesDocument(value)).toThrowError(
      RegistryValidationError,
    );
  });

  it.each(["/tmp/error.log", "C:/temp/error.log"])(
    "rejects absolute fixture path %s",
    (fixture) => {
      const value = defaultCases("npm/example");
      value.cases[0].fixture = fixture;
      expect(() => validateCasesDocument(value)).toThrowError(
        "must be a relative path",
      );
    },
  );

  it("rejects empty cases arrays and unexpected fields", () => {
    expect(() =>
      validateCasesDocument({ detectorId: "npm/example", cases: [] }),
    ).toThrowError("must be a non-empty array");
    expect(() =>
      validateCasesDocument({
        ...defaultCases("npm/example"),
        executableHook: "do not run",
      }),
    ).toThrowError('field "executableHook" is not supported');
    const unexpectedCaseField = defaultCases("npm/example");
    unexpectedCaseField.cases[0].command = "do not run";
    expect(() => validateCasesDocument(unexpectedCaseField)).toThrowError(
      'field "command" is not supported',
    );
    const unexpectedExpectationField = defaultCases("npm/example");
    unexpectedExpectationField.cases[0].expect.callback = "do not run";
    expect(() =>
      validateCasesDocument(unexpectedExpectationField),
    ).toThrowError('field "callback" is not supported');
  });

  it("enforces positive and negative fixture locations", () => {
    const positive = defaultCases("npm/example");
    positive.cases[0].fixture = "fixtures/negative/basic.log";
    expect(() => validateCasesDocument(positive)).toThrowError(
      'must use "fixtures/positive/',
    );

    const negative = defaultCases("npm/example");
    negative.cases[0] = {
      name: "negative",
      fixture: "fixtures/positive/basic.log",
      expect: { match: false },
    };
    expect(() => validateCasesDocument(negative)).toThrowError(
      'must use "fixtures/negative/',
    );
  });

  it.each([
    "fixtures/positive/nested/basic.log",
    "fixtures/positive/%2e%2e.log",
    "fixtures/positive/C:secret.log",
    "fixtures/positive/con.log",
    "fixtures/positive/Uppercase.log",
  ])("rejects non-portable or nested fixture path %s", (fixture) => {
    const value = defaultCases("npm/example");
    value.cases[0].fixture = fixture;
    expect(() => validateCasesDocument(value)).toThrowError(
      RegistryValidationError,
    );
  });

  it("rejects duplicate case names and fixture references", () => {
    const duplicateName = defaultCases("npm/example");
    duplicateName.cases.push({
      ...duplicateName.cases[0],
      fixture: "fixtures/positive/second.log",
    });
    expect(() => validateCasesDocument(duplicateName)).toThrowError(
      'duplicates case name "positive"',
    );

    const duplicateFixture = defaultCases("npm/example");
    duplicateFixture.cases.push({
      ...duplicateFixture.cases[0],
      name: "second",
    });
    expect(() => validateCasesDocument(duplicateFixture)).toThrowError(
      "duplicates fixture reference",
    );
  });

  it("rejects detector ID mismatches", () => {
    expect(() =>
      validateCasesDocument(defaultCases("npm/wrong"), {
        expectedDetectorId: "npm/example",
        fileLabel: "npm/example/cases.json",
      }),
    ).toThrowError('must equal detector directory ID "npm/example"');
  });

  it("rejects malformed cases JSON", async () => {
    const root = await createTemporaryRoot();
    await createDetectorTree(root, "npm/example", { casesSource: "{nope\n" });
    await expect(validateRegistryFilesystem(root)).rejects.toThrowError(
      "must contain valid JSON",
    );
  });

  it("rejects oversized cases.json before parsing", async () => {
    const root = await createTemporaryRoot();
    await createDetectorTree(root, "npm/example", {
      casesSource: Buffer.alloc(MAX_CASES_FILE_BYTES + 1, 120),
    });
    await expect(validateRegistryFilesystem(root)).rejects.toThrowError(
      `must not exceed ${MAX_CASES_FILE_BYTES} bytes`,
    );
  });

  it("rejects missing fixtures", async () => {
    const root = await createTemporaryRoot();
    await createDetectorTree(root, "npm/example", { fixtures: {} });
    await expect(validateRegistryFilesystem(root)).rejects.toThrowError(
      "required file is missing",
    );
  });

  it("rejects oversized fixtures before reading them", async () => {
    const root = await createTemporaryRoot();
    await createDetectorTree(root, "npm/example", {
      fixtures: {
        "fixtures/positive/basic.log": Buffer.alloc(MAX_FIXTURE_BYTES + 1, 120),
      },
    });
    await expect(validateRegistryFilesystem(root)).rejects.toThrowError(
      `must not exceed ${MAX_FIXTURE_BYTES} bytes`,
    );
  });

  it("accepts a regular UTF-8 fixture at the exact byte limit", async () => {
    const root = await createTemporaryRoot();
    const fixture = "é".repeat(MAX_FIXTURE_BYTES / 2);
    expect(Buffer.byteLength(fixture, "utf8")).toBe(MAX_FIXTURE_BYTES);
    await createDetectorTree(root, "npm/example", {
      fixtures: { "fixtures/positive/basic.log": fixture },
    });

    const entries = await validateRegistryFilesystem(root);
    expect(Buffer.byteLength(entries[0].cases[0].fixtureText, "utf8")).toBe(
      MAX_FIXTURE_BYTES,
    );
  });

  it("uses UTF-8 byte size rather than JavaScript string length", async () => {
    const root = await createTemporaryRoot();
    const fixture = "é".repeat(MAX_FIXTURE_BYTES / 2 + 1);
    expect(fixture.length).toBeLessThan(MAX_FIXTURE_BYTES);
    expect(Buffer.byteLength(fixture, "utf8")).toBeGreaterThan(
      MAX_FIXTURE_BYTES,
    );
    await createDetectorTree(root, "npm/example", {
      fixtures: { "fixtures/positive/basic.log": fixture },
    });

    await expect(validateRegistryFilesystem(root)).rejects.toThrowError(
      `must not exceed ${MAX_FIXTURE_BYTES} bytes`,
    );
  });

  it("rejects empty, whitespace-only, and invalid UTF-8 fixtures", async () => {
    for (const fixture of ["", " \r\n\t", Buffer.from([0xff, 0xfe])]) {
      const root = await createTemporaryRoot();
      await createDetectorTree(root, "npm/example", {
        fixtures: { "fixtures/positive/basic.log": fixture },
      });
      await expect(validateRegistryFilesystem(root)).rejects.toThrowError(
        RegistryValidationError,
      );
    }
  });

  it("rejects a directory used as a fixture", async () => {
    const root = await createTemporaryRoot();
    const detectorDirectory = await createDetectorTree(root, "npm/example", {
      fixtures: {},
    });
    await mkdir(
      path.join(detectorDirectory, "fixtures", "positive", "basic.log"),
    );

    await expect(validateRegistryFilesystem(root)).rejects.toThrowError(
      "must be a regular file",
    );
  });

  it("rejects a symbolic-link fixture without following it", async () => {
    const workspaceRoot = await createTemporaryRoot();
    const detectorsRoot = path.join(workspaceRoot, "detectors");
    const detectorDirectory = await createDetectorTree(
      detectorsRoot,
      "npm/example",
      { fixtures: {} },
    );
    const outsideFixture = path.join(workspaceRoot, "outside.log");
    const linkedFixture = path.join(
      detectorDirectory,
      "fixtures",
      "positive",
      "basic.log",
    );
    await writeFile(outsideFixture, "outside detector tree\n", "utf8");
    try {
      await symlink(outsideFixture, linkedFixture, "file");
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        ["EACCES", "ENOSYS", "EPERM"].includes(error.code)
      ) {
        return;
      }
      throw error;
    }

    await expect(
      validateRegistryFilesystem(detectorsRoot),
    ).rejects.toThrowError("must be a regular file");
  });

  it("reports a symlink entry type before validating its directory name", async () => {
    const workspaceRoot = await createTemporaryRoot();
    const detectorsRoot = path.join(workspaceRoot, "detectors");
    const outsideFixture = path.join(workspaceRoot, "outside.log");
    const linkedEntry = path.join(detectorsRoot, "Outside.log");
    await mkdir(detectorsRoot);
    await writeFile(outsideFixture, "outside detector tree\n", "utf8");
    try {
      await symlink(outsideFixture, linkedEntry, "file");
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        ["EACCES", "ENOSYS", "EPERM"].includes(error.code)
      ) {
        return;
      }
      throw error;
    }

    await expect(
      discoverDetectorDirectories(detectorsRoot),
    ).rejects.toThrowError(
      'Ecosystem directory "Outside.log": must be a real directory',
    );
  });
});
