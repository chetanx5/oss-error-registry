import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import { generateRegistryIndex } from "./registry-tooling.mjs";

const registryRoot = fileURLToPath(new URL("../", import.meta.url));
const detectorsRoot = fileURLToPath(
  new URL("../src/detectors/", import.meta.url),
);
const generatedFile = fileURLToPath(
  new URL("../src/generated/detectors.ts", import.meta.url),
);

const arguments_ = process.argv.slice(2);
if (arguments_.some((argument) => argument !== "--check")) {
  process.stderr.write(
    "Usage: node packages/registry/scripts/generate-registry-index.mjs [--check]\n",
  );
  process.exitCode = 1;
} else {
  try {
    const result = await generateRegistryIndex({
      detectorsRoot,
      generatedFile,
      check: arguments_.includes("--check"),
    });
    const relativeGeneratedFile = generatedFile
      .slice(registryRoot.length)
      .replaceAll("\\", "/");
    process.stdout.write(
      arguments_.includes("--check")
        ? `Registry index is current: ${relativeGeneratedFile}\n`
        : result.changed
          ? `Generated registry index: ${relativeGeneratedFile}\n`
          : `Registry index already current: ${relativeGeneratedFile}\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
