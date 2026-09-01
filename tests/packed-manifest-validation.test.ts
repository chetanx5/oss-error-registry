import { describe, expect, it } from "vitest";

import {
  assertPackedManifest,
  findWorkspaceProtocolPaths,
} from "../scripts/packed-manifest-validation.mjs";

const version = "0.1.1";

describe("packed manifest validation", () => {
  it("accepts pnpm-rewritten exact lockstep dependencies", () => {
    expect(() =>
      assertPackedManifest(
        {
          name: "@oss-error-registry/core",
          version,
        },
        {
          name: "@oss-error-registry/core",
          version,
          dependencyNames: [],
        },
      ),
    ).not.toThrow();

    expect(() =>
      assertPackedManifest(
        {
          name: "@oss-error-registry/cli",
          version,
          dependencies: {
            "@oss-error-registry/core": version,
            "@oss-error-registry/registry": version,
            "@oss-error-registry/reporter": version,
          },
        },
        {
          name: "@oss-error-registry/cli",
          version,
          dependencyNames: [
            "@oss-error-registry/core",
            "@oss-error-registry/registry",
            "@oss-error-registry/reporter",
          ],
        },
      ),
    ).not.toThrow();
  });

  it("rejects a source workspace protocol in packed dependencies", () => {
    expect(() =>
      assertPackedManifest(
        {
          name: "@oss-error-registry/registry",
          version,
          dependencies: {
            "@oss-error-registry/core": "workspace:*",
          },
        },
        {
          name: "@oss-error-registry/registry",
          version,
          dependencyNames: ["@oss-error-registry/core"],
        },
      ),
    ).toThrow(
      'forbidden workspace: protocol at $["dependencies"]["@oss-error-registry/core"]',
    );
  });

  it("finds workspace protocols anywhere in a packed manifest", () => {
    expect(
      findWorkspaceProtocolPaths({
        optionalDependencies: { optional: "workspace:^" },
        peerDependencies: { peer: "workspace:~" },
      }),
    ).toEqual([
      '$["optionalDependencies"]["optional"]',
      '$["peerDependencies"]["peer"]',
    ]);
  });

  it("rejects non-exact or incomplete internal dependency versions", () => {
    expect(() =>
      assertPackedManifest(
        {
          name: "@oss-error-registry/cli",
          version,
          dependencies: {
            "@oss-error-registry/core": "^0.1.1",
          },
        },
        {
          name: "@oss-error-registry/cli",
          version,
          dependencyNames: [
            "@oss-error-registry/core",
            "@oss-error-registry/registry",
          ],
        },
      ),
    ).toThrow("dependencies must be exact lockstep versions");
  });
});
