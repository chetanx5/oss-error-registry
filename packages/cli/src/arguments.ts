export type CliFormat = "json" | "pretty";

export type ParsedCliArguments =
  | { readonly action: "help" }
  | { readonly action: "version" }
  | {
      readonly action: "diagnose";
      readonly format: CliFormat;
      readonly inputPath?: string;
    };

export const HELP_TEXT = [
  "Usage: oss-error-registry [options] [file]",
  "",
  "Diagnose developer errors with the local deterministic registry.",
  "",
  "Arguments:",
  "  file                 Read diagnostic input from this file.",
  "  -                    Read diagnostic input from standard input.",
  "",
  "Options:",
  "  --format <format>    Output format: pretty (default) or json.",
  "  --help, -h           Show this help text.",
  "  --version, -V        Show the CLI version.",
  "",
  "When file is omitted, input is read from standard input.",
  "",
  "Exit codes:",
  "  0  Successful execution, including no-match results.",
  "  1  Internal analysis or CLI failure.",
  "  2  Invalid command-line usage.",
  "  3  Input or file-read failure.",
].join("\n");

export class CliUsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

function parseFormat(value: string): CliFormat {
  if (value !== "pretty" && value !== "json") {
    throw new CliUsageError('Unsupported format; expected "pretty" or "json".');
  }
  return value;
}

export function parseCliArguments(args: readonly string[]): ParsedCliArguments {
  let action: "help" | "version" | undefined;
  let actionOption: string | undefined;
  let endOfOptions = false;
  let format: CliFormat = "pretty";
  let formatProvided = false;
  let inputPath: string | undefined;

  const assertNoAction = (): void => {
    if (actionOption !== undefined) {
      throw new CliUsageError(
        `Option "${actionOption}" cannot be combined with other arguments.`,
      );
    }
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;

    if (!endOfOptions && argument === "--") {
      assertNoAction();
      endOfOptions = true;
      continue;
    }

    if (!endOfOptions && (argument === "--help" || argument === "-h")) {
      if (action !== undefined || formatProvided || inputPath !== undefined) {
        throw new CliUsageError(
          `Option "${argument}" cannot be combined with other arguments.`,
        );
      }
      action = "help";
      actionOption = argument;
      continue;
    }

    if (!endOfOptions && (argument === "--version" || argument === "-V")) {
      if (action !== undefined || formatProvided || inputPath !== undefined) {
        throw new CliUsageError(
          `Option "${argument}" cannot be combined with other arguments.`,
        );
      }
      action = "version";
      actionOption = argument;
      continue;
    }

    assertNoAction();

    if (!endOfOptions && argument === "--format") {
      if (formatProvided) {
        throw new CliUsageError('Option "--format" may only be provided once.');
      }
      const value = args[index + 1];
      if (value === undefined) {
        throw new CliUsageError('Option "--format" requires a value.');
      }
      format = parseFormat(value);
      formatProvided = true;
      index += 1;
      continue;
    }

    if (!endOfOptions && argument.startsWith("--format=")) {
      if (formatProvided) {
        throw new CliUsageError('Option "--format" may only be provided once.');
      }
      format = parseFormat(argument.slice("--format=".length));
      formatProvided = true;
      continue;
    }

    if (!endOfOptions && argument !== "-" && argument.startsWith("-")) {
      throw new CliUsageError("Unknown option.");
    }

    if (inputPath !== undefined) {
      throw new CliUsageError(
        "Only one input file or stdin marker is allowed.",
      );
    }
    inputPath = argument;
  }

  if (action !== undefined) {
    return { action };
  }

  return {
    action: "diagnose",
    format,
    ...(inputPath === undefined ? {} : { inputPath }),
  };
}
