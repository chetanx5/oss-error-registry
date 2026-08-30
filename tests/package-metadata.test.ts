import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

interface PackageManifest {
  readonly name?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly description?: string;
  readonly license?: string;
  readonly author?: string;
  readonly repository?: {
    readonly type?: string;
    readonly url?: string;
    readonly directory?: string;
  };
  readonly homepage?: string;
  readonly bugs?: { readonly url?: string };
  readonly keywords?: readonly string[];
  readonly type?: string;
  readonly sideEffects?: boolean | readonly string[];
  readonly main?: string;
  readonly types?: string;
  readonly files?: readonly string[];
  readonly exports?: Record<string, unknown>;
  readonly engines?: Record<string, string>;
  readonly publishConfig?: Record<string, string>;
  readonly bin?: Record<string, string>;
  readonly scripts?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly packageManager?: string;
}

const fromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

const packageDefinitions = [
  {
    directory: "core",
    name: "@oss-error-registry/core",
    dependencies: {},
  },
  {
    directory: "registry",
    name: "@oss-error-registry/registry",
    dependencies: { "@oss-error-registry/core": "workspace:*" },
  },
  {
    directory: "reporter",
    name: "@oss-error-registry/reporter",
    dependencies: { "@oss-error-registry/core": "workspace:*" },
  },
  {
    directory: "cli",
    name: "@oss-error-registry/cli",
    dependencies: {
      "@oss-error-registry/core": "workspace:*",
      "@oss-error-registry/registry": "workspace:*",
      "@oss-error-registry/reporter": "workspace:*",
    },
  },
] as const;

async function readManifest(relativePath: string): Promise<PackageManifest> {
  return JSON.parse(
    await readFile(fromRoot(relativePath), "utf8"),
  ) as PackageManifest;
}

describe("release package metadata", () => {
  it("keeps only the workspace root private", async () => {
    const root = await readManifest("package.json");
    expect(root.private).toBe(true);
    expect(root.packageManager).toBe("pnpm@11.22.0");

    for (const definition of packageDefinitions) {
      const manifest = await readManifest(
        `packages/${definition.directory}/package.json`,
      );
      expect(manifest.private, definition.name).not.toBe(true);
    }
  });

  it("uses complete, package-correct public metadata", async () => {
    for (const definition of packageDefinitions) {
      const manifest = await readManifest(
        `packages/${definition.directory}/package.json`,
      );
      expect(manifest.name).toBe(definition.name);
      expect(manifest.version).toBe("0.0.0");
      expect(manifest.description).toBeTypeOf("string");
      expect(manifest.license).toBe("MIT");
      expect(manifest.author).toBe("Chetan Narayana");
      expect(manifest.repository).toEqual({
        type: "git",
        url: "git+https://github.com/chetanx5/oss-error-registry.git",
        directory: `packages/${definition.directory}`,
      });
      expect(manifest.homepage).toBe(
        `https://github.com/chetanx5/oss-error-registry/tree/main/packages/${definition.directory}#readme`,
      );
      expect(manifest.bugs).toEqual({
        url: "https://github.com/chetanx5/oss-error-registry/issues",
      });
      expect(manifest.keywords?.length).toBeGreaterThanOrEqual(3);
      expect(manifest.engines).toEqual({ node: ">=22.13.0" });
      expect(manifest.publishConfig).toEqual({ access: "public" });
    }
  });

  it("publishes one ESM root entry and no internal subpaths", async () => {
    for (const definition of packageDefinitions) {
      const manifest = await readManifest(
        `packages/${definition.directory}/package.json`,
      );
      expect(manifest.type).toBe("module");
      expect(manifest.main).toBe("./dist/index.js");
      expect(manifest.types).toBe("./dist/index.d.ts");
      expect(manifest.exports).toEqual({
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
          default: "./dist/index.js",
        },
      });
      expect(Object.keys(manifest.exports ?? {})).toEqual(["."]);
    }
  });

  it("uses explicit package file allowlists", async () => {
    const rootLicense = await readFile(fromRoot("LICENSE"), "utf8");

    for (const definition of packageDefinitions) {
      const packageRoot = `packages/${definition.directory}`;
      const manifest = await readManifest(`${packageRoot}/package.json`);
      expect(manifest.files).toEqual(["dist", "LICENSE", "README.md"]);
      expect(await readFile(fromRoot(`${packageRoot}/LICENSE`), "utf8")).toBe(
        rootLicense,
      );
      const packageReadme = await readFile(
        fromRoot(`${packageRoot}/README.md`),
        "utf8",
      );
      expect(packageReadme.startsWith(`# \`${definition.name}\`\n`)).toBe(true);
    }
  });

  it("keeps package dependencies acyclic and publish-rewritable", async () => {
    for (const definition of packageDefinitions) {
      const manifest = await readManifest(
        `packages/${definition.directory}/package.json`,
      );
      expect(manifest.dependencies ?? {}).toEqual(definition.dependencies);
      expect(manifest.devDependencies).toBeUndefined();
      expect(manifest.peerDependencies).toBeUndefined();
      expect(manifest.optionalDependencies).toBeUndefined();
    }
  });

  it("contains no public package lifecycle hooks", async () => {
    const lifecycleNames = [
      "preinstall",
      "install",
      "postinstall",
      "prepare",
      "prepack",
      "postpack",
      "prepublish",
      "prepublishOnly",
      "postpublish",
    ];

    for (const definition of packageDefinitions) {
      const manifest = await readManifest(
        `packages/${definition.directory}/package.json`,
      );
      expect(manifest.scripts, definition.name).toBeUndefined();
      for (const lifecycleName of lifecycleNames) {
        expect(
          manifest.scripts?.[lifecycleName],
          definition.name,
        ).toBeUndefined();
      }
    }
  });

  it("keeps build metadata outside publishable dist directories", async () => {
    for (const definition of packageDefinitions) {
      const tsconfig = JSON.parse(
        await readFile(
          fromRoot(`packages/${definition.directory}/tsconfig.json`),
          "utf8",
        ),
      ) as { compilerOptions?: { tsBuildInfoFile?: string } };
      expect(tsconfig.compilerOptions?.tsBuildInfoFile).toBe(".tsbuildinfo");
    }
  });

  it("keeps the CLI version and executable aligned with its package", async () => {
    const cliManifest = await readManifest("packages/cli/package.json");
    const metadata = await readFile(
      fromRoot("packages/cli/src/metadata.ts"),
      "utf8",
    );
    const bin = await readFile(fromRoot("packages/cli/src/bin.ts"), "utf8");

    expect(cliManifest.bin).toEqual({
      "oss-error-registry": "./dist/bin.js",
    });
    expect(metadata).toContain(`CLI_VERSION = "${cliManifest.version}"`);
    expect(bin.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });

  it("wires release validation into the root scripts and CI", async () => {
    const root = await readManifest("package.json");
    const ci = await readFile(fromRoot(".github/workflows/ci.yml"), "utf8");

    expect(root.scripts?.["package:check"]).toBe(
      "node scripts/package-check.mjs",
    );
    expect(root.scripts?.["release:check"]).toBe(
      "pnpm run check && pnpm run package:check",
    );
    expect(ci).toContain("run: pnpm package:check");
    expect(ci).not.toMatch(/npm[_-]?token|npm publish|pnpm publish/iu);
  });

  it("keeps release tooling isolated, offline, and non-publishing", async () => {
    const source = await readFile(
      fromRoot("scripts/package-check.mjs"),
      "utf8",
    );

    expect(source).toContain("shell: false");
    expect(source).toContain('"--offline"');
    expect(source).toContain('"--ignore-scripts"');
    expect(source).toContain('npm_config_offline = "true"');
    expect(source).toContain('npm_config_ignore_scripts = "true"');
    expect(source).toContain("childEnvironment.npm_config_userconfig =");
    expect(source).toContain("childEnvironment.npm_config_globalconfig =");
    expect(source).toContain("await mkdtemp(");
    expect(source).toContain(
      "await rm(temporaryRoot, { recursive: true, force: true })",
    );
    expect(source).not.toMatch(/node:(?:http|https|net|tls|dns)/u);
    expect(source).not.toMatch(/\b(?:npm|pnpm)\s+publish\b/u);
  });
});
