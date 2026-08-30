# `@oss-error-registry/reporter`

Deterministic human-readable and JSON formatting for OSS Error Registry analysis
results.

The package root exports only `formatPretty()` and `formatJson()`. Formatting
does not add timestamps, machine-specific values, networking, or telemetry.

See the [repository README](../../README.md) and
[reporter contract](../../docs/reporter.md) for output guarantees.
