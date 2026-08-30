# `@oss-error-registry/cli`

The offline deterministic command-line interface for OSS Error Registry. It
composes the core analyzer, static production registry, and reporter behind the
`oss-error-registry` executable.

The package root also exposes the supported programmatic `runCli()` boundary and
exit-code constants. The CLI treats diagnostic input as inert UTF-8 data; it
does not execute commands, access networks, install packages, or send telemetry.

See the [repository README](../../README.md) and
[CLI documentation](../../docs/cli.md) for local development usage. The package
has not yet been published to npm.
