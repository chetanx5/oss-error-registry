import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const rootLicensePath = path.join(repositoryRoot, "LICENSE");
const packageVersion = "0.0.0";
const repositoryUrl = "git+https://github.com/chetanx5/oss-error-registry.git";
const packageDefinitions = Object.freeze([
  Object.freeze({
    directory: "core",
    name: "@oss-error-registry/core",
    dependencies: Object.freeze({}),
  }),
  Object.freeze({
    directory: "registry",
    name: "@oss-error-registry/registry",
    dependencies: Object.freeze({
      "@oss-error-registry/core": "workspace:*",
    }),
  }),
  Object.freeze({
    directory: "reporter",
    name: "@oss-error-registry/reporter",
    dependencies: Object.freeze({
      "@oss-error-registry/core": "workspace:*",
    }),
  }),
  Object.freeze({
    directory: "cli",
    name: "@oss-error-registry/cli",
    dependencies: Object.freeze({
      "@oss-error-registry/core": "workspace:*",
      "@oss-error-registry/registry": "workspace:*",
      "@oss-error-registry/reporter": "workspace:*",
    }),
  }),
]);

const expectedExport = Object.freeze({
  types: "./dist/index.d.ts",
  import: "./dist/index.js",
  default: "./dist/index.js",
});
const knownDiagnostic = `npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! While resolving: example-app@1.0.0
npm ERR! Found: react@18.3.1
npm ERR! Could not resolve dependency: peer react@"^17.0.0" from example-plugin@2.0.0
`;

const childEnvironment = { ...process.env };
for (const name of Object.keys(childEnvironment)) {
  if (
    /(?:^|_)(?:node_auth_token|npm_token|token|_auth|auth_token)$/iu.test(
      name,
    ) ||
    /^(?:npm_config_userconfig|npm_config_globalconfig)$/iu.test(name)
  ) {
    delete childEnvironment[name];
  }
}
childEnvironment.npm_config_audit = "false";
childEnvironment.npm_config_fund = "false";
childEnvironment.npm_config_ignore_scripts = "true";
childEnvironment.npm_config_offline = "true";
delete childEnvironment.NODE_OPTIONS;
delete childEnvironment.NODE_PATH;

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(message) {
  throw new Error(`Package check failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareAscii(left, right))
        .map(([key, entry]) => [key, canonicalizeJson(entry)]),
    );
  }
  return value;
}

function assertJsonEqual(actual, expected, message) {
  assert(
    JSON.stringify(canonicalizeJson(actual)) ===
      JSON.stringify(canonicalizeJson(expected)),
    message,
  );
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`could not read JSON ${path.basename(filePath)}: ${detail}`);
  }
}

async function assertRegularFile(filePath, label) {
  const stats = await lstat(filePath).catch(() => undefined);
  assert(
    stats?.isFile() === true && !stats.isSymbolicLink(),
    `${label} must be a regular file and not a symbolic link`,
  );
}

function runFixed(executable, arguments_, options) {
  const result = spawnSync(executable, arguments_, {
    cwd: options.cwd,
    encoding: "utf8",
    env: childEnvironment,
    input: options.input,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });

  if (result.error !== undefined) {
    fail(`${options.label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    fail(
      `${options.label} exited with ${String(result.status)}${stderr.length > 0 ? `: ${stderr}` : stdout.length > 0 ? `: ${stdout}` : ""}`,
    );
  }

  return Object.freeze({ stdout: result.stdout, stderr: result.stderr });
}

async function getPnpmCli() {
  const executable = process.env.npm_execpath;
  assert(
    typeof executable === "string" && path.isAbsolute(executable),
    "run this command through pnpm so its local executable is known",
  );
  assert(
    /^pnpm\.(?:cjs|mjs)$/u.test(path.basename(executable).toLowerCase()),
    `npm_execpath must identify the pnpm JavaScript CLI (received ${path.basename(executable)})`,
  );
  await assertRegularFile(executable, "pnpm CLI");
  return executable;
}

function runPnpm(pnpmCli, arguments_, options) {
  return runFixed(process.execPath, [pnpmCli, ...arguments_], options);
}

async function walkRegularFiles(rootDirectory) {
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareAscii(left.name, right.name));

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        fail(`symbolic link is not allowed in package content: ${entry.name}`);
      }
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile()) {
        files.push(
          path.relative(rootDirectory, entryPath).replaceAll("\\", "/"),
        );
      } else {
        fail(`non-regular package content is not allowed: ${entry.name}`);
      }
    }
  }

  await visit(rootDirectory);
  return Object.freeze(files);
}

async function validateSourceMetadata() {
  const rootManifestPath = path.join(repositoryRoot, "package.json");
  await assertRegularFile(rootManifestPath, "workspace package.json");
  await assertRegularFile(rootLicensePath, "workspace LICENSE");
  const rootManifest = await readJson(rootManifestPath);
  assert(rootManifest.private === true, "workspace root must remain private");
  assert(
    rootManifest.packageManager === "pnpm@11.22.0",
    "workspace packageManager must remain pinned",
  );
  assert(
    rootManifest.scripts?.["package:check"] ===
      "node scripts/package-check.mjs",
    "workspace package:check script is missing",
  );
  assert(
    rootManifest.scripts?.["release:check"] ===
      "pnpm run check && pnpm run package:check",
    "workspace release:check script is missing",
  );

  const rootLicense = await readFile(rootLicensePath, "utf8");
  const sourceManifests = new Map();

  for (const definition of packageDefinitions) {
    const packageRoot = path.join(
      repositoryRoot,
      "packages",
      definition.directory,
    );
    const manifestPath = path.join(packageRoot, "package.json");
    const licensePath = path.join(packageRoot, "LICENSE");
    const readmePath = path.join(packageRoot, "README.md");
    await assertRegularFile(manifestPath, `${definition.name} package.json`);
    await assertRegularFile(licensePath, `${definition.name} LICENSE`);
    await assertRegularFile(readmePath, `${definition.name} README`);
    const manifest = await readJson(manifestPath);
    sourceManifests.set(definition.name, manifest);

    assert(
      manifest.name === definition.name,
      `${definition.name} has wrong name`,
    );
    assert(
      manifest.version === packageVersion,
      `${definition.name} must use lockstep version ${packageVersion}`,
    );
    assert(
      manifest.private !== true,
      `${definition.name} must be eligible for an explicit public release`,
    );
    assert(
      typeof manifest.description === "string" &&
        manifest.description.length > 0,
      `${definition.name} must have a description`,
    );
    assert(manifest.license === "MIT", `${definition.name} must declare MIT`);
    assert(
      manifest.author === "Chetan Narayana",
      `${definition.name} has unexpected author metadata`,
    );
    assert(
      manifest.repository?.type === "git" &&
        manifest.repository.url === repositoryUrl &&
        manifest.repository.directory === `packages/${definition.directory}`,
      `${definition.name} has invalid repository metadata`,
    );
    assert(
      typeof manifest.homepage === "string" &&
        manifest.homepage.startsWith(
          "https://github.com/chetanx5/oss-error-registry/",
        ),
      `${definition.name} has invalid homepage metadata`,
    );
    assert(
      manifest.bugs?.url ===
        "https://github.com/chetanx5/oss-error-registry/issues",
      `${definition.name} has invalid issue metadata`,
    );
    assert(
      Array.isArray(manifest.keywords) && manifest.keywords.length >= 3,
      `${definition.name} must have useful keywords`,
    );
    assert(manifest.type === "module", `${definition.name} must be ESM`);
    assert(
      manifest.main === "./dist/index.js" &&
        manifest.types === "./dist/index.d.ts",
      `${definition.name} has invalid root entry points`,
    );
    assertJsonEqual(
      manifest.files,
      ["dist", "LICENSE", "README.md"],
      `${definition.name} has an unexpected files allowlist`,
    );
    assertJsonEqual(
      manifest.exports,
      { ".": expectedExport },
      `${definition.name} has an unexpected export map`,
    );
    assert(
      manifest.engines?.node === ">=22.13.0",
      `${definition.name} has an unexpected Node engine`,
    );
    assert(
      manifest.publishConfig?.access === "public" &&
        Object.keys(manifest.publishConfig).length === 1,
      `${definition.name} must declare only public scoped access`,
    );
    assert(
      manifest.scripts === undefined,
      `${definition.name} must not contain lifecycle or package scripts`,
    );
    assert(
      manifest.devDependencies === undefined &&
        manifest.peerDependencies === undefined &&
        manifest.optionalDependencies === undefined,
      `${definition.name} leaks development, peer, or optional dependencies`,
    );
    assertJsonEqual(
      manifest.dependencies ?? {},
      definition.dependencies,
      `${definition.name} has invalid package dependencies`,
    );

    const packageLicense = await readFile(licensePath, "utf8");
    assert(
      packageLicense === rootLicense,
      `${definition.name} LICENSE differs from the repository license`,
    );
    const packageReadme = await readFile(readmePath, "utf8");
    assert(
      packageReadme.startsWith(`# \`${definition.name}\``),
      `${definition.name} README has an unexpected title`,
    );
  }

  const cliMetadata = await readFile(
    path.join(repositoryRoot, "packages", "cli", "src", "metadata.ts"),
    "utf8",
  );
  assert(
    cliMetadata.includes(`CLI_VERSION = "${packageVersion}"`),
    "CLI version output differs from package versions",
  );

  return sourceManifests;
}

function archiveNameFor(packageName) {
  return `${packageName.slice(1).replaceAll("/", "-")}-${packageVersion}.tgz`;
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function listArchiveEntries(archivePath) {
  const result = runFixed("tar", ["-tf", archivePath], {
    cwd: repositoryRoot,
    label: "tarball content inspection",
  });
  return Object.freeze(
    result.stdout
      .split(/\r?\n/u)
      .filter((entry) => entry.length > 0 && !entry.endsWith("/"))
      .map((entry) => entry.replaceAll("\\", "/")),
  );
}

function readArchiveEntry(archivePath, entry) {
  return runFixed("tar", ["-xOf", archivePath, entry], {
    cwd: repositoryRoot,
    label: "tarball entry inspection",
  }).stdout;
}

async function expectedArchiveEntries(definition) {
  const distRoot = path.join(
    repositoryRoot,
    "packages",
    definition.directory,
    "dist",
  );
  const stats = await lstat(distRoot).catch(() => undefined);
  assert(
    stats?.isDirectory() === true,
    `${definition.name} must be built first`,
  );
  assert(
    !stats.isSymbolicLink(),
    `${definition.name} dist must not be a symlink`,
  );

  const distFiles = await walkRegularFiles(distRoot);
  assert(distFiles.length > 0, `${definition.name} dist is empty`);
  for (const file of distFiles) {
    assert(
      /(?:\.js|\.js\.map|\.d\.ts|\.d\.ts\.map)$/u.test(file),
      `${definition.name} contains forbidden build output: ${file}`,
    );
  }

  return Object.freeze(
    [
      "package/LICENSE",
      "package/README.md",
      "package/package.json",
      ...distFiles.map((file) => `package/dist/${file}`),
    ].sort(compareAscii),
  );
}

async function packAll(pnpmCli, destination) {
  await mkdir(destination, { recursive: true });
  const archives = new Map();

  for (const definition of packageDefinitions) {
    const packageRoot = path.join(
      repositoryRoot,
      "packages",
      definition.directory,
    );
    runPnpm(pnpmCli, ["pack", "--pack-destination", destination], {
      cwd: packageRoot,
      label: `packing ${definition.name}`,
    });
    const archivePath = path.join(destination, archiveNameFor(definition.name));
    const archiveStats = await lstat(archivePath).catch(() => undefined);
    assert(
      archiveStats?.isFile() === true && !archiveStats.isSymbolicLink(),
      `${definition.name} did not produce the expected regular tarball`,
    );
    archives.set(definition.name, archivePath);
  }

  return archives;
}

async function validateArchives(firstArchives, secondArchives) {
  for (const definition of packageDefinitions) {
    const firstPath = firstArchives.get(definition.name);
    const secondPath = secondArchives.get(definition.name);
    assert(
      firstPath !== undefined && secondPath !== undefined,
      "missing tarball",
    );

    const firstContents = await readFile(firstPath);
    const secondContents = await readFile(secondPath);
    const firstEntries = [...listArchiveEntries(firstPath)].sort(compareAscii);
    const secondEntries = [...listArchiveEntries(secondPath)].sort(
      compareAscii,
    );
    assert(
      new Set(firstEntries).size === firstEntries.length,
      `${definition.name} tarball contains duplicate entries`,
    );
    assertJsonEqual(
      firstEntries,
      await expectedArchiveEntries(definition),
      `${definition.name} tarball content differs from its allowlist`,
    );
    assertJsonEqual(
      secondEntries,
      firstEntries,
      `${definition.name} repeated tarball has different entries`,
    );

    if (sha256(firstContents) !== sha256(secondContents)) {
      for (const entry of firstEntries) {
        const firstEntry = readArchiveEntry(firstPath, entry);
        const secondEntry = readArchiveEntry(secondPath, entry);
        if (entry === "package/package.json") {
          assertJsonEqual(
            JSON.parse(firstEntry),
            JSON.parse(secondEntry),
            `${definition.name} repeated packed manifest changed semantically`,
          );
        } else {
          assert(
            firstEntry === secondEntry,
            `${definition.name} repeated tarball changed ${entry}`,
          );
        }
      }
    }
  }
}

async function validateInstalledManifests(consumerRoot, sourceManifests) {
  for (const definition of packageDefinitions) {
    const installedManifest = await readJson(
      path.join(
        consumerRoot,
        "node_modules",
        ...definition.name.split("/"),
        "package.json",
      ),
    );
    const sourceManifest = sourceManifests.get(definition.name);
    assert(
      sourceManifest !== undefined,
      `missing source manifest ${definition.name}`,
    );
    assert(
      installedManifest.name === definition.name &&
        installedManifest.version === packageVersion,
      `${definition.name} packed identity is invalid`,
    );
    assertJsonEqual(
      installedManifest.exports,
      sourceManifest.exports,
      `${definition.name} packed exports changed`,
    );
    assert(
      !JSON.stringify(installedManifest).includes("workspace:"),
      `${definition.name} retained a workspace dependency in its tarball`,
    );
    assertJsonEqual(
      installedManifest.dependencies ?? {},
      Object.fromEntries(
        Object.keys(definition.dependencies).map((dependency) => [
          dependency,
          packageVersion,
        ]),
      ),
      `${definition.name} packed dependencies are not exact lockstep versions`,
    );
    assert(
      installedManifest.scripts === undefined,
      `${definition.name} packed a lifecycle script`,
    );
  }
}

async function validateSourceMaps(consumerRoot) {
  for (const definition of packageDefinitions) {
    const packageRoot = path.join(
      consumerRoot,
      "node_modules",
      ...definition.name.split("/"),
    );
    const files = await walkRegularFiles(path.join(packageRoot, "dist"));
    for (const file of files.filter((entry) => entry.endsWith(".map"))) {
      const sourceMap = await readJson(path.join(packageRoot, "dist", file));
      assert(
        Array.isArray(sourceMap.sources),
        `${definition.name} has invalid map`,
      );
      for (const source of sourceMap.sources) {
        assert(
          typeof source === "string" &&
            !path.posix.isAbsolute(source) &&
            !path.win32.isAbsolute(source) &&
            !source.toLowerCase().includes("users/"),
          `${definition.name} source map leaks an absolute machine path`,
        );
      }
    }
  }
}

async function validateConsumer(
  pnpmCli,
  temporaryRoot,
  archives,
  sourceManifests,
) {
  const consumerRoot = path.join(temporaryRoot, "consumer");
  const storeRoot = path.join(temporaryRoot, "store");
  await mkdir(consumerRoot);

  const dependencies = Object.fromEntries(
    packageDefinitions.map((definition) => {
      const archive = archives.get(definition.name);
      assert(archive !== undefined, `missing archive ${definition.name}`);
      const relativeArchive = path
        .relative(consumerRoot, archive)
        .replaceAll("\\", "/");
      return [definition.name, `file:${relativeArchive}`];
    }),
  );
  await writeFile(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "release-readiness-consumer",
        version: "0.0.0",
        private: true,
        type: "module",
        dependencies,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const overrideLines = Object.entries(dependencies)
    .map(([name, specification]) => `  "${name}": "${specification}"`)
    .join("\n");
  await writeFile(
    path.join(consumerRoot, "pnpm-workspace.yaml"),
    `packages:\n  - .\noverrides:\n${overrideLines}\n`,
    "utf8",
  );

  runPnpm(
    pnpmCli,
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--lockfile=false",
      "--package-import-method=copy",
      "--store-dir",
      storeRoot,
    ],
    { cwd: consumerRoot, label: "offline clean consumer installation" },
  );

  await validateInstalledManifests(consumerRoot, sourceManifests);
  await validateSourceMaps(consumerRoot);

  const runtimeCheckPath = path.join(consumerRoot, "runtime-check.mjs");
  await writeFile(
    runtimeCheckPath,
    `import { strict as assert } from "node:assert";
import { runCli, CLI_EXIT_CODE } from "@oss-error-registry/cli";
import { analyze } from "@oss-error-registry/core";
import { builtInDetectors } from "@oss-error-registry/registry";
import { formatJson, formatPretty } from "@oss-error-registry/reporter";

const known = analyze(${JSON.stringify(knownDiagnostic)}, builtInDetectors);
assert.equal(known.matches[0]?.detectorId, "npm/eresolve-peer-dependency");
assert.ok(formatPretty(known).includes("Detector ID: npm/eresolve-peer-dependency"));
assert.equal(JSON.parse(formatJson(known)).matches[0]?.detectorId, "npm/eresolve-peer-dependency");
assert.equal(analyze("unrecognized failure", builtInDetectors).matches.length, 0);
assert.equal(typeof runCli, "function");
assert.equal(CLI_EXIT_CODE.SUCCESS, 0);
process.stdout.write("consumer-runtime-ok\\n");
`,
    "utf8",
  );
  const runtimeResult = runFixed(process.execPath, [runtimeCheckPath], {
    cwd: consumerRoot,
    label: "clean consumer runtime import",
  });
  assert(
    runtimeResult.stdout === "consumer-runtime-ok\n" &&
      runtimeResult.stderr === "",
    "clean consumer runtime emitted unexpected output",
  );

  const declarationCheckPath = path.join(consumerRoot, "declaration-check.ts");
  await writeFile(
    declarationCheckPath,
    `import { runCli, CLI_EXIT_CODE, type CliRuntime } from "@oss-error-registry/cli";
import { analyze, type AnalysisResult, type DetectorDefinition } from "@oss-error-registry/core";
import { builtInDetectors } from "@oss-error-registry/registry";
import { formatJson, formatPretty } from "@oss-error-registry/reporter";

const result: AnalysisResult = analyze("unrecognized failure", builtInDetectors);
const detector: DetectorDefinition | undefined = builtInDetectors[0];
const runtime: CliRuntime | undefined = undefined;
void [runCli, CLI_EXIT_CODE, formatJson(result), formatPretty(result), detector, runtime];
`,
    "utf8",
  );
  const typescriptCli = path.join(
    repositoryRoot,
    "node_modules",
    "typescript",
    "bin",
    "tsc",
  );
  runFixed(
    process.execPath,
    [
      typescriptCli,
      "--pretty",
      "false",
      "--strict",
      "--noEmit",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--types",
      "node",
      "--typeRoots",
      path.join(repositoryRoot, "node_modules", "@types"),
      declarationCheckPath,
    ],
    { cwd: consumerRoot, label: "clean consumer declaration check" },
  );

  const cliRoot = path.join(
    consumerRoot,
    "node_modules",
    "@oss-error-registry",
    "cli",
  );
  const cliBin = path.join(cliRoot, "dist", "bin.js");
  const binSource = await readFile(cliBin, "utf8");
  assert(
    binSource.startsWith("#!/usr/bin/env node\n"),
    "packed CLI is missing its portable Node shebang",
  );
  const binShim = path.join(
    consumerRoot,
    "node_modules",
    ".bin",
    process.platform === "win32"
      ? "oss-error-registry.cmd"
      : "oss-error-registry",
  );
  const shimStats = await lstat(binShim).catch(() => undefined);
  assert(
    shimStats !== undefined,
    "clean install did not create the CLI bin shim",
  );

  const help = runFixed(process.execPath, [cliBin, "--help"], {
    cwd: consumerRoot,
    label: "packaged CLI --help",
  });
  assert(
    help.stdout.startsWith("Usage: oss-error-registry") && help.stderr === "",
    "packaged CLI --help output is invalid",
  );
  const version = runFixed(process.execPath, [cliBin, "--version"], {
    cwd: consumerRoot,
    label: "packaged CLI --version",
  });
  assert(
    version.stdout === `oss-error-registry ${packageVersion}\n` &&
      version.stderr === "",
    "packaged CLI --version output is invalid",
  );

  const diagnosticPath = path.join(consumerRoot, "diagnostic.log");
  await writeFile(diagnosticPath, knownDiagnostic, "utf8");
  const pretty = runFixed(process.execPath, [cliBin, diagnosticPath], {
    cwd: consumerRoot,
    label: "packaged CLI file input",
  });
  assert(
    pretty.stdout.includes("Detector ID: npm/eresolve-peer-dependency") &&
      pretty.stderr === "",
    "packaged CLI pretty output is invalid",
  );
  assert(
    (await readFile(diagnosticPath, "utf8")) === knownDiagnostic,
    "packaged CLI mutated its source input",
  );

  const json = runFixed(process.execPath, [cliBin, "--format", "json", "-"], {
    cwd: consumerRoot,
    input: knownDiagnostic,
    label: "packaged CLI JSON stdin",
  });
  const jsonReport = JSON.parse(json.stdout);
  assert(
    jsonReport.matches?.[0]?.detectorId === "npm/eresolve-peer-dependency" &&
      json.stderr === "",
    "packaged CLI JSON output is invalid",
  );

  const noMatchFirst = runFixed(
    process.execPath,
    [cliBin, "--format", "json", "-"],
    {
      cwd: consumerRoot,
      input: "unrecognized failure",
      label: "packaged CLI no-match stdin",
    },
  );
  const noMatchSecond = runFixed(
    process.execPath,
    [cliBin, "--format", "json", "-"],
    {
      cwd: consumerRoot,
      input: "unrecognized failure",
      label: "repeated packaged CLI no-match stdin",
    },
  );
  assert(
    noMatchFirst.stdout === noMatchSecond.stdout &&
      JSON.parse(noMatchFirst.stdout).status === "no-match" &&
      noMatchFirst.stderr === "" &&
      noMatchSecond.stderr === "",
    "packaged CLI no-match output is not deterministic",
  );
}

async function main() {
  const sourceManifests = await validateSourceMetadata();
  const pnpmCli = await getPnpmCli();
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "oss-error-registry-package-check-"),
  );

  try {
    const isolatedNpmConfig = path.join(temporaryRoot, "empty-npmrc");
    await writeFile(isolatedNpmConfig, "", "utf8");
    childEnvironment.npm_config_userconfig = isolatedNpmConfig;
    childEnvironment.npm_config_globalconfig = isolatedNpmConfig;
    const firstArchives = await packAll(
      pnpmCli,
      path.join(temporaryRoot, "pack-one"),
    );
    const secondArchives = await packAll(
      pnpmCli,
      path.join(temporaryRoot, "pack-two"),
    );
    await validateArchives(firstArchives, secondArchives);
    await validateConsumer(
      pnpmCli,
      temporaryRoot,
      firstArchives,
      sourceManifests,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  process.stdout.write(
    "Release package check passed: 4 deterministic package content sets, offline clean install, runtime imports, declarations, and CLI.\n",
  );
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
