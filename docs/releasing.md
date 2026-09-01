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

Version `0.1.0` was published with literal `workspace:*` specifications in the
registry, reporter, and CLI manifests because the publication command bypassed
pnpm's workspace rewriting. That package set is not installable. All four public
packages are now prepared at the lockstep hotfix version `0.1.1`; the hotfix has
not been published. This repository contains no automated publishing workflow,
npm token requirement, release creation, or lifecycle script.

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
root project version, the lockfile when necessary, and this changelog in one
reviewed change. A version must never be reused after publication.

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
2. packs every public package twice with pnpm and directly validates the
   `package.json` stored in each resulting tarball;
3. rejects any packed `workspace:` protocol and requires the exact lockstep
   version for every internal dependency;
4. compares the tarballs' allowlisted contents, requiring byte-identical files
   except for semantically identical `package.json` key ordering produced by
   pnpm;
5. enforces each tarball's file allowlist and source-map path safety;
6. installs all tarballs into an isolated temporary consumer using pnpm's
   offline mode with lifecycle scripts disabled;
7. imports every installed public package without workspace path aliases;
8. resolves the packaged TypeScript declarations; and
9. exercises the installed CLI's help, version, file, stdin, pretty, JSON,
   positive-match, and deterministic no-match paths.

Temporary tarballs, the isolated pnpm store, and consumer files are created
under an operating-system temporary directory and removed in a `finally`
cleanup. The command does not publish, tag, push, create a release, read npm
credentials, or contact a package registry.

## Manual publication

Publication remains a separate, explicitly authorized decision. Before running
it, verify npm scope ownership and authentication, release notes, the exact
version, a clean reviewed release commit, and a passing `pnpm release:check`.

Publish with pnpm, in dependency order, so `workspace:*` is rewritten in the
public manifests:

```sh
pnpm --filter @oss-error-registry/core publish --access public
pnpm --filter @oss-error-registry/registry publish --access public
pnpm --filter @oss-error-registry/reporter publish --access public
pnpm --filter @oss-error-registry/cli publish --access public
```

Do not substitute a different package-manager publishing command. Do not bypass
Git checks, reuse a version, or publish unless that exact release has been
authorized. Tags and GitHub releases are separate reviewed steps after the npm
registry state has been verified.
