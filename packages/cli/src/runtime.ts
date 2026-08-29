import { readInputFile, readStandardInput } from "./input.js";

export interface CliRuntime {
  readonly stdinIsTTY: boolean;
  readonly readFile: (filePath: string) => Promise<string>;
  readonly readStdin: () => Promise<string>;
  readonly writeStdout: (output: string) => void;
  readonly writeStderr: (output: string) => void;
}

export function createNodeCliRuntime(): CliRuntime {
  return {
    stdinIsTTY: process.stdin.isTTY === true,
    readFile: readInputFile,
    readStdin: async () => readStandardInput(process.stdin),
    writeStdout: (output) => {
      process.stdout.write(output);
    },
    writeStderr: (output) => {
      process.stderr.write(output);
    },
  };
}
