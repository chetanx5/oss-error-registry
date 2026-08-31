# `@oss-error-registry/cli`

The offline deterministic command-line interface for OSS Error Registry. It
composes the bounded analyzer, static production registry, and reporter behind
the `oss-error-registry` executable.

> Version `0.1.0` is prepared but has not yet been published to npm. Requires
> Node.js 22.13.0 or newer and uses ESM.

## Run

After publication:

```sh
npx @oss-error-registry/cli error.log
some-command 2>&1 | npx @oss-error-registry/cli
npx @oss-error-registry/cli --format json error.log
```

From a repository checkout today:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm cli --help
pnpm cli error.log
```

Pretty output is the default. The CLI supports `--format pretty`,
`--format json`, `--help`, `--version`, explicit `-` stdin, and `--` option
termination. Exit codes are `0` for successful analysis including no-match, `1`
for an unexpected internal failure, `2` for invalid usage, and `3` for an input
failure.

The package root also exports the supported programmatic `runCli()` boundary,
`CLI_EXIT_CODE`, and their TypeScript types:

```ts
import { CLI_EXIT_CODE, runCli } from "@oss-error-registry/cli";

const exitCode = await runCli(["--format", "json", "error.log"]);
if (exitCode !== CLI_EXIT_CODE.SUCCESS) {
  process.exitCode = exitCode;
}
```

Input is bounded to 1 MiB and decoded as strict UTF-8. The CLI reads only the
explicit file or stdin; it does not execute input or detector commands, scan
directories, access URLs or networks, create temporary files, install packages,
or send telemetry.

See the
[repository README](https://github.com/chetanx5/oss-error-registry#readme) and
[complete CLI contract](https://github.com/chetanx5/oss-error-registry/blob/main/docs/cli.md).
