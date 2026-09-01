import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import {
  CLI_EXIT_CODE,
  runCli,
  type CliRuntime,
} from "@oss-error-registry/cli";
import { MAX_ANALYSIS_INPUT_BYTES, analyze } from "@oss-error-registry/core";
import { builtInDetectors } from "@oss-error-registry/registry";
import { formatJson, formatPretty } from "@oss-error-registry/reporter";

import {
  CliInputError,
  readInputFile,
  readStandardInput,
} from "../src/input.js";

const POSITIVE_INPUT = [
  "npm ERR! code ERESOLVE",
  "npm ERR! ERESOLVE unable to resolve dependency tree",
].join("\n");

interface RuntimeOptions {
  readonly stdin?: string;
  readonly stdinIsTTY?: boolean;
  readonly readFile?: (filePath: string) => Promise<string>;
  readonly readStdin?: () => Promise<string>;
}

interface RuntimeCapture {
  readonly runtime: CliRuntime;
  readonly output: {
    stderr: string;
    stdout: string;
  };
  readonly calls: {
    files: string[];
    stdin: number;
  };
}

function createRuntime(options: RuntimeOptions = {}): RuntimeCapture {
  const output = { stderr: "", stdout: "" };
  const calls = { files: [] as string[], stdin: 0 };

  return {
    output,
    calls,
    runtime: {
      stdinIsTTY: options.stdinIsTTY ?? false,
      readFile: async (filePath) => {
        calls.files.push(filePath);
        if (options.readFile !== undefined) {
          return options.readFile(filePath);
        }
        throw new CliInputError("Input file does not exist.");
      },
      readStdin: async () => {
        calls.stdin += 1;
        return options.readStdin === undefined
          ? (options.stdin ?? "")
          : options.readStdin();
      },
      writeStdout: (value) => {
        output.stdout += value;
      },
      writeStderr: (value) => {
        output.stderr += value;
      },
    },
  };
}

const temporaryRoots: string[] = [];

async function createTemporaryFile(
  contents: string | Uint8Array,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "oss-error-registry-cli-"));
  temporaryRoots.push(root);
  const filePath = path.join(root, "input.log");
  await writeFile(filePath, contents);
  return filePath;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true });
    }),
  );
});

describe("CLI metadata", () => {
  it.each(["--help", "-h"])("renders help for %s", async (option) => {
    const capture = createRuntime({ stdinIsTTY: true });

    expect(await runCli([option], capture.runtime)).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(capture.output.stdout).toContain(
      "Usage: oss-error-registry [options] [file]",
    );
    expect(capture.output.stdout).toContain("--format <format>");
    expect(capture.output.stdout).toContain("Exit codes:");
    expect(capture.output.stdout.endsWith("\n")).toBe(true);
    expect(capture.output.stderr).toBe("");
    expect(capture.calls).toEqual({ files: [], stdin: 0 });
  });

  it.each(["--version", "-V"])("renders version for %s", async (option) => {
    const capture = createRuntime({ stdinIsTTY: true });

    expect(await runCli([option], capture.runtime)).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(capture.output).toEqual({
      stdout: "oss-error-registry 0.1.1\n",
      stderr: "",
    });
  });

  it("exports the documented frozen exit-code contract", () => {
    expect(CLI_EXIT_CODE).toEqual({
      SUCCESS: 0,
      INTERNAL_ERROR: 1,
      USAGE_ERROR: 2,
      INPUT_ERROR: 3,
    });
    expect(Object.isFrozen(CLI_EXIT_CODE)).toBe(true);
  });
});

describe("CLI analysis composition", () => {
  it("reads an explicit file and uses pretty output by default", async () => {
    const filePath = await createTemporaryFile(POSITIVE_INPUT);
    const capture = createRuntime({ readFile: readInputFile });

    expect(await runCli([filePath], capture.runtime)).toBe(
      CLI_EXIT_CODE.SUCCESS,
    );
    expect(capture.output.stdout).toBe(
      `${formatPretty(analyze(POSITIVE_INPUT, builtInDetectors))}\n`,
    );
    expect(capture.output.stderr).toBe("");
    expect(capture.calls.files).toEqual([filePath]);
    expect(capture.calls.stdin).toBe(0);
  });

  it("reads standard input when no file is provided", async () => {
    const capture = createRuntime({ stdin: POSITIVE_INPUT });

    expect(await runCli([], capture.runtime)).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(capture.output.stdout).toBe(
      `${formatPretty(analyze(POSITIVE_INPUT, builtInDetectors))}\n`,
    );
    expect(capture.output.stderr).toBe("");
    expect(capture.calls).toEqual({ files: [], stdin: 1 });
  });

  it("accepts the explicit stdin marker", async () => {
    const capture = createRuntime({ stdin: POSITIVE_INPUT, stdinIsTTY: true });

    expect(await runCli(["-"], capture.runtime)).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(capture.output.stdout).toContain(
      "Detector ID: npm/eresolve-peer-dependency",
    );
    expect(capture.calls.stdin).toBe(1);
  });

  it("selects stable JSON output", async () => {
    const capture = createRuntime({ stdin: POSITIVE_INPUT });

    expect(await runCli(["--format", "json"], capture.runtime)).toBe(
      CLI_EXIT_CODE.SUCCESS,
    );
    expect(capture.output.stdout).toBe(
      `${formatJson(analyze(POSITIVE_INPUT, builtInDetectors))}\n`,
    );
    expect(JSON.parse(capture.output.stdout)).toMatchObject({
      schemaVersion: 1,
      status: "matches",
      matchCount: 1,
      matches: [{ detectorId: "npm/eresolve-peer-dependency", score: 90 }],
    });
    expect(capture.output.stderr).toBe("");
  });

  it("accepts the equals form of the format option", async () => {
    const capture = createRuntime({ stdin: "unrelated Unicode text: Ошибка" });

    expect(await runCli(["--format=json"], capture.runtime)).toBe(
      CLI_EXIT_CODE.SUCCESS,
    );
    expect(JSON.parse(capture.output.stdout)).toMatchObject({
      status: "no-match",
      matchCount: 0,
    });
  });

  it("returns a successful explicit no-match report", async () => {
    const capture = createRuntime({ stdin: "unrelated diagnostic output" });

    expect(await runCli([], capture.runtime)).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(capture.output.stdout).toContain("Status: no-match");
    expect(capture.output.stdout).toContain("Matches: 0");
    expect(capture.output.stderr).toBe("");
  });

  it("normalizes CRLF through the existing analyzer", async () => {
    const crlfInput = POSITIVE_INPUT.replaceAll("\n", "\r\n");
    const capture = createRuntime({ stdin: crlfInput });

    expect(await runCli([], capture.runtime)).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(capture.output.stdout).toContain("Evidence score: 90/100");
  });

  it("preserves Unicode input as data without mutating the source string", async () => {
    const input = "Ошибка сборки 🚨 — unrelated to known detectors";
    const before = input;
    const capture = createRuntime({ stdin: input });

    expect(await runCli([], capture.runtime)).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(input).toBe(before);
    expect(capture.output.stdout).toContain("Status: no-match");
  });

  it("produces byte-identical output for repeated execution", async () => {
    const first = createRuntime({ stdin: POSITIVE_INPUT });
    const second = createRuntime({ stdin: POSITIVE_INPUT });

    expect(await runCli(["--format=json"], first.runtime)).toBe(0);
    expect(await runCli(["--format=json"], second.runtime)).toBe(0);
    expect(second.output).toEqual(first.output);
  });

  it("keeps command-looking input inert", async () => {
    const marker = "__cli_command_marker__";
    const globalRecord = globalThis as Record<string, unknown>;
    delete globalRecord[marker];
    const capture = createRuntime({
      stdin: `globalThis.${marker} = true; process.exit(91); curl https://example.invalid`,
    });

    expect(await runCli([], capture.runtime)).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(globalRecord[marker]).toBeUndefined();
    expect(capture.output.stdout).toContain("Status: no-match");
  });
});

describe("CLI errors and exit codes", () => {
  it("rejects an interactive invocation with no input", async () => {
    const capture = createRuntime({ stdinIsTTY: true });

    expect(await runCli([], capture.runtime)).toBe(CLI_EXIT_CODE.USAGE_ERROR);
    expect(capture.output.stdout).toBe("");
    expect(capture.output.stderr).toContain(
      "Usage error: Provide an input file or pipe diagnostic text",
    );
    expect(capture.calls.stdin).toBe(0);
  });

  it("rejects unknown options", async () => {
    const capture = createRuntime();

    expect(await runCli(["--unknown"], capture.runtime)).toBe(
      CLI_EXIT_CODE.USAGE_ERROR,
    );
    expect(capture.output.stdout).toBe("");
    expect(capture.output.stderr).toContain("Usage error: Unknown option.");
  });

  it("does not echo control-bearing unknown options to stderr", async () => {
    const capture = createRuntime();

    expect(
      await runCli(["--unknown\u001B]0;changed\u0007"], capture.runtime),
    ).toBe(CLI_EXIT_CODE.USAGE_ERROR);
    expect(capture.output.stderr).toBe(
      'Usage error: Unknown option.\nRun "oss-error-registry --help" for usage.\n',
    );
    expect(capture.output.stderr).not.toContain("\u001B");
    expect(capture.output.stderr).not.toContain("\u0007");
  });

  it.each([
    {
      args: ["--format"],
      message: 'Option "--format" requires a value.',
    },
    {
      args: ["--format", "yaml"],
      message: "Unsupported format; expected",
    },
    {
      args: ["--format", "json", "--format=pretty"],
      message: 'Option "--format" may only be provided once.',
    },
    {
      args: ["first.log", "-"],
      message: "Only one input file or stdin marker is allowed.",
    },
    {
      args: ["--help", "input.log"],
      message: 'Option "--help" cannot be combined',
    },
  ])("rejects invalid usage: $message", async ({ args, message }) => {
    const capture = createRuntime();

    expect(await runCli(args, capture.runtime)).toBe(CLI_EXIT_CODE.USAGE_ERROR);
    expect(capture.output.stderr).toContain(message);
    expect(capture.output.stdout).toBe("");
  });

  it("supports a filename beginning with a hyphen after --", async () => {
    const capture = createRuntime({
      readFile: async (filePath) => {
        expect(filePath).toBe("--input.log");
        return "unrelated diagnostic output";
      },
    });

    expect(await runCli(["--", "--input.log"], capture.runtime)).toBe(
      CLI_EXIT_CODE.SUCCESS,
    );
    expect(capture.calls.files).toEqual(["--input.log"]);
  });

  it("reports a missing file as an input failure", async () => {
    const capture = createRuntime();

    expect(await runCli(["missing.log"], capture.runtime)).toBe(
      CLI_EXIT_CODE.INPUT_ERROR,
    );
    expect(capture.output).toEqual({
      stdout: "",
      stderr: "Input error: Input file does not exist.\n",
    });
  });

  it("reports an invalid directory path without platform-specific text", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "oss-error-registry-cli-directory-"),
    );
    temporaryRoots.push(root);
    const capture = createRuntime({ readFile: readInputFile });

    expect(await runCli([root], capture.runtime)).toBe(
      CLI_EXIT_CODE.INPUT_ERROR,
    );
    expect(capture.output.stderr).toBe(
      "Input error: Input path must be a regular file.\n",
    );
    expect(capture.output.stderr).not.toContain(root);
  });

  it("reports oversized stdin before analysis", async () => {
    const capture = createRuntime({
      readStdin: async () =>
        readStandardInput(
          Readable.from([Buffer.alloc(MAX_ANALYSIS_INPUT_BYTES + 1, 0x78)]),
        ),
    });

    expect(await runCli([], capture.runtime)).toBe(CLI_EXIT_CODE.INPUT_ERROR);
    expect(capture.output.stderr).toBe(
      `Input error: Input exceeds the maximum size of ${MAX_ANALYSIS_INPUT_BYTES} UTF-8 bytes.\n`,
    );
  });

  it("reports empty input through the core input contract", async () => {
    const capture = createRuntime({ stdin: "\r\n\t  " });

    expect(await runCli([], capture.runtime)).toBe(CLI_EXIT_CODE.INPUT_ERROR);
    expect(capture.output.stdout).toBe("");
    expect(capture.output.stderr).toContain(
      "Input error: Analysis input must contain non-whitespace text",
    );
  });

  it("keeps unexpected failures generic and on stderr", async () => {
    const capture = createRuntime({
      readStdin: async () => {
        throw new Error("platform-specific secret detail");
      },
    });

    expect(await runCli([], capture.runtime)).toBe(
      CLI_EXIT_CODE.INTERNAL_ERROR,
    );
    expect(capture.output).toEqual({
      stdout: "",
      stderr: "Internal error: CLI execution failed.\n",
    });
  });
});
