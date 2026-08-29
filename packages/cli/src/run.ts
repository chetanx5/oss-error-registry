import {
  AnalysisError,
  AnalysisInputError,
  analyze,
} from "@oss-error-registry/core";
import { builtInDetectors } from "@oss-error-registry/registry";
import { formatJson, formatPretty } from "@oss-error-registry/reporter";

import { CliUsageError, HELP_TEXT, parseCliArguments } from "./arguments.js";
import { CliInputError } from "./input.js";
import { CLI_VERSION } from "./metadata.js";
import { createNodeCliRuntime, type CliRuntime } from "./runtime.js";

export const CLI_EXIT_CODE = Object.freeze({
  SUCCESS: 0,
  INTERNAL_ERROR: 1,
  USAGE_ERROR: 2,
  INPUT_ERROR: 3,
} as const);

export type CliExitCode = (typeof CLI_EXIT_CODE)[keyof typeof CLI_EXIT_CODE];

function writeLine(write: (output: string) => void, output: string): void {
  write(`${output}\n`);
}

export async function runCli(
  args: readonly string[],
  runtime: CliRuntime = createNodeCliRuntime(),
): Promise<CliExitCode> {
  try {
    const parsed = parseCliArguments(args);
    if (parsed.action === "help") {
      writeLine(runtime.writeStdout, HELP_TEXT);
      return CLI_EXIT_CODE.SUCCESS;
    }
    if (parsed.action === "version") {
      writeLine(runtime.writeStdout, `oss-error-registry ${CLI_VERSION}`);
      return CLI_EXIT_CODE.SUCCESS;
    }

    let input: string;
    if (parsed.inputPath === undefined || parsed.inputPath === "-") {
      if (parsed.inputPath === undefined && runtime.stdinIsTTY) {
        throw new CliUsageError(
          "Provide an input file or pipe diagnostic text to standard input.",
        );
      }
      input = await runtime.readStdin();
    } else {
      input = await runtime.readFile(parsed.inputPath);
    }

    const result = analyze(input, builtInDetectors);
    const output =
      parsed.format === "json" ? formatJson(result) : formatPretty(result);
    writeLine(runtime.writeStdout, output);
    return CLI_EXIT_CODE.SUCCESS;
  } catch (error) {
    if (error instanceof CliUsageError) {
      runtime.writeStderr(
        `Usage error: ${error.message}\nRun "oss-error-registry --help" for usage.\n`,
      );
      return CLI_EXIT_CODE.USAGE_ERROR;
    }
    if (error instanceof CliInputError || error instanceof AnalysisInputError) {
      writeLine(runtime.writeStderr, `Input error: ${error.message}`);
      return CLI_EXIT_CODE.INPUT_ERROR;
    }
    if (error instanceof AnalysisError) {
      writeLine(runtime.writeStderr, `Analysis error: ${error.message}`);
      return CLI_EXIT_CODE.INTERNAL_ERROR;
    }

    writeLine(runtime.writeStderr, "Internal error: CLI execution failed.");
    return CLI_EXIT_CODE.INTERNAL_ERROR;
  }
}
