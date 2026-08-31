# Command-line interface

`@oss-error-registry/cli` exposes the existing offline diagnostic pipeline as a
small Node.js command:

```text
explicit file or stdin
        |
        v
builtInDetectors -> analyze() -> formatPretty() or formatJson() -> stdout
```

The CLI owns argument parsing and bounded input reads only. It does not
duplicate detector discovery, matching, scoring, or report formatting.

## Installation and development invocation

Version `0.1.1` is prepared as an installability hotfix but has not been
published. Version `0.1.0` exposed unresolved workspace dependency
specifications and must not be used. After an explicitly authorized `0.1.1`
publication, the package is configured for:

```sh
npx @oss-error-registry/cli --help
npx @oss-error-registry/cli error.log
```

These commands document the prepared `0.1.1` package interface rather than its
current npm availability. From a repository checkout today, install
dependencies, build, and invoke the local command:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm cli --help
```

The package manifest declares the executable name `oss-error-registry`, while
the root `pnpm cli` script runs the built local entry point during development.

## Usage

```text
Usage: oss-error-registry [options] [file]
```

Supported arguments and options:

- `file` reads diagnostic text from one explicitly named file.
- `-` explicitly reads diagnostic text from standard input.
- Omitting `file` reads standard input when it is redirected or piped.
- `--format pretty` selects the default human-readable report.
- `--format json` selects the stable versioned JSON report.
- `--help` or `-h` writes help to stdout.
- `--version` or `-V` writes the package's current version to stdout.
- `--` ends option parsing, allowing a file name beginning with `-`.

Exactly one explicit input path or stdin marker is accepted. A positional file
selects file input and stdin is not consumed. Multiple input arguments, repeated
format options, unknown options, and help/version combined with other arguments
are usage errors.

An invocation with neither a file nor redirected stdin returns a usage error
instead of waiting on an interactive terminal. An explicit `-` requests stdin
even when the stream is attached to a terminal.

## File input

```sh
pnpm cli error.log
pnpm cli --format json error.log
```

The CLI opens only the supplied path and requires it to resolve to a regular
file. It does not discover files, scan directories, expand globs, follow URLs,
or search parent directories. Relative and absolute paths use normal operating
system file resolution.

Missing, unreadable, non-file, oversized, and invalid UTF-8 inputs produce
stable input errors on stderr without exposing platform-specific filesystem
messages.

## Standard input

```sh
some-command 2>&1 | pnpm cli
some-command 2>&1 | pnpm cli --format json
pnpm cli -
```

Stdin is consumed as bytes, bounded before decoding, decoded once as strict
UTF-8, and then passed directly to core. Shell syntax, commands, JavaScript,
URLs, and module-like text in the stream remain inert data.

## Output formats

Pretty output is the default:

```sh
pnpm cli error.log
```

It is produced exclusively by `formatPretty()` from the reporter package. JSON
output is selected explicitly:

```sh
pnpm cli --format json error.log
```

It is produced exclusively by `formatJson()`. Both formats preserve the
reporter's deterministic ordering, escaping, and security guarantees. The CLI
adds one final LF newline for conventional terminal and pipeline behavior.

Successful analysis output, including a valid no-match report, is written only
to stdout. Usage, input, and internal errors are written only to stderr.

## Exit codes

The exit-code contract is intentionally small:

| Code | Meaning                                            |
| ---: | -------------------------------------------------- |
|  `0` | Successful execution, including a no-match result. |
|  `1` | Unexpected internal CLI or analysis failure.       |
|  `2` | Invalid command-line usage.                        |
|  `3` | Input, decoding, size, or file-read failure.       |

The CLI does not use match presence as an exit code. Consumers that need match
details should select JSON and inspect the stable report.

## Input bounds

File and stdin reads share core's `MAX_ANALYSIS_INPUT_BYTES` limit: 1,048,576
UTF-8 bytes (1 MiB). File size is checked before reading and again on the opened
handle; the bounded reader also stops if a file grows. Stdin stops after the
accumulated byte count exceeds the limit. The complete bounded byte sequence is
decoded with fatal UTF-8 semantics, so malformed encodings are rejected rather
than replaced.

Core then applies its existing normalization and validation. Empty or
whitespace-only input after normalization is an input failure. ANSI stripping,
line-ending normalization, detector validation, work limits, matching, scoring,
and ordering remain core responsibilities.

## Safety model

Input and detector guidance are data. The CLI never:

- invokes a shell or child process;
- executes diagnostic or remediation commands;
- evaluates JavaScript or constructs functions from text;
- dynamically imports user input;
- accesses URLs or networks;
- loads arbitrary detector modules;
- sends telemetry or analytics;
- creates temporary files; or
- scans directories.

The only product-runtime filesystem operation is reading the exact file path the
user requested. Registry loading remains the static filesystem-free runtime API
described in [`registry-architecture.md`](registry-architecture.md).
