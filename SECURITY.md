# Security policy

OSS Error Registry processes error logs that may contain command-like text,
paths, URLs, terminal controls, or other untrusted strings. Those strings are
data and must remain inert throughout matching and reporting.

## Supported versions

Security fixes are applied to the current `main` branch and, once available, the
latest installable `0.1.x` release. Version `0.1.0` is not supported because its
published internal dependency specifications make the package set unsuitable for
installation. This policy will be updated when the compatibility or release
strategy changes.

## Reporting a vulnerability

Do not disclose a suspected vulnerability, credential, private log, or exploit
detail in a public issue.

Use GitHub's private vulnerability-reporting flow for this repository when it is
available. If the private flow is unavailable, open a public issue containing
only a request for a private maintainer contact channel; do not include
sensitive technical details in that issue.

Include, through the private channel:

- the affected package, version, or commit;
- a minimal reproduction using sanitized data;
- the expected and observed security boundary;
- the practical impact; and
- any suggested mitigation, if known.

Maintainers should acknowledge a private report, reproduce it, determine its
scope, and coordinate a fix and disclosure before public discussion. Response
times are best effort while the project is maintained by volunteers.

## Runtime security boundaries

- CLI input is read only from an explicit file or stdin, with a 1 MiB UTF-8 byte
  limit.
- Input is never executed, evaluated, dynamically imported, or interpreted as a
  URL or shell command.
- Diagnostic and remediation command strings are display-only metadata.
- Runtime packages do not make network requests or send telemetry or analytics.
- The runtime registry uses committed static imports and does not crawl the
  filesystem or load arbitrary contributor modules.
- The reporter neutralizes non-printing terminal controls and emits stable
  output without timestamps or machine-specific metadata.
- Detector, pattern, result, and matching-work counts are bounded.

## Contributor and fixture boundaries

Registry tooling rejects path traversal, absolute fixture paths, backslashes,
unexpected directory entries, invalid UTF-8, oversized input, missing fixtures,
unreferenced fixtures, symbolic links, and generated-index drift. Fixtures are
opened as data and never executed.

Detector modules are reviewed repository source, but their accepted shape is
restricted to a declarative `defineDetector({...})` call. Callbacks, executable
hooks, extra imports, dynamic expressions, and arbitrary module loading are not
part of the detector contract.

Like ordinary local build tooling, validation assumes the checked tree is not
being concurrently replaced by another local process during a run. It is not a
sandbox against a malicious process that already controls the contributor's
machine or repository checkout.

## Release safeguards

Public packages contain no install or lifecycle scripts. Release validation uses
explicit file allowlists, checks declarations and source maps, performs an
offline clean installation with lifecycle scripts disabled, and exercises the
packed CLI. Release tooling does not publish, create tags, read npm credentials,
or contact a package registry.

Architecture details are documented in [`ARCHITECTURE.md`](ARCHITECTURE.md).
