import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@oss-error-registry/cli": fromRoot("./packages/cli/src/index.ts"),
      "@oss-error-registry/core": fromRoot("./packages/core/src/index.ts"),
      "@oss-error-registry/registry": fromRoot(
        "./packages/registry/src/index.ts",
      ),
      "@oss-error-registry/reporter": fromRoot(
        "./packages/reporter/src/index.ts",
      ),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
