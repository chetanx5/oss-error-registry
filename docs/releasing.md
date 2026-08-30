# Release readiness and versioning

The repository defines four intended public packages:

| Package                        | Responsibility                                   |
| ------------------------------ | ------------------------------------------------ |
| `@oss-error-registry/core`     | Detector contract and deterministic analyzer     |
| `@oss-error-registry/registry` | Statically imported production detector catalog  |
| `@oss-error-registry/reporter` | Deterministic pretty and JSON formatting         |
| `@oss-error-registry/cli`      | CLI executable and supported programmatic runner |

The workspace root remains private. The four packages use ESM, export only their
package root, and are versioned together. Internal workspace dependencies use
pnpm's `workspace:*` protocol in source manifests and are rewritten to the exact
lockstep version when packed.

## Current publication status

No package has been published. Version `0.0.0` is deliberately retained as a
development placeholder until an initial release version and npm ownership are
explicitly approved. This repository contains no publishing workflow, npm token
requirement, release creation, or lifecycle script.

## Semantic Versioning policy

After an initial version is selected, all four packages advance together:

- **Patch**: backwards-compatible bug, detector-accuracy, documentation, or
  packaging fixes that do not add a supported public capability.
- **Minor**: backwards-compatible public APIs, CLI options, reporter fields, or
  production detectors. Before `1.0.0`, an intentional breaking change also
  increments the minor version and must be called out prominently.
- **Major**: breaking changes to supported APIs, CLI contracts, detector data
  contracts, output schemas, or compatibility guarantees after `1.0.0`.

A release changes every public package manifest, the CLI version constant, the
lockfile when necessary, and this changelog in one reviewed change. A version
must never be reused after publication.

## Local release gate

From a clean checkout with dependencies installed, run:

```sh
pnpm release:check
git diff --check
git status --short
```

`release:check` runs the regular registry, formatting, lint, typecheck, test,
and build gates, then:

1. validates root and public package metadata;
2. packs every public package twice and compares their allowlisted contents,
   requiring byte-identical files except for semantically identical
   `package.json` key ordering produced by pnpm;
3. enforces each tarball's file allowlist and source-map path safety;
4. installs all tarballs into an isolated temporary consumer using pnpm's
   offline mode with lifecycle scripts disabled;
5. imports every installed public package without workspace path aliases;
6. resolves the packaged TypeScript declarations; and
7. exercises the installed CLI's help, version, file, stdin, pretty, JSON,
   positive-match, and deterministic no-match paths.

Temporary tarballs, the isolated pnpm store, and consumer files are created
under an operating-system temporary directory and removed in a `finally`
cleanup. The command does not publish, tag, push, create a release, read npm
credentials, or contact a package registry.

Publication remains a separate, explicitly authorized manual decision. This
document intentionally provides no publishing command while the packages are
unpublished.
