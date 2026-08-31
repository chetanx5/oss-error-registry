# Changelog

All notable changes will be documented in this file. The project follows
[Semantic Versioning](https://semver.org/) and keeps the four public workspace
packages on one lockstep version.

## Unreleased

No changes have been recorded after the prepared `0.1.1` hotfix.

## 0.1.1 - prepared, not published

This patch release repairs public package installability after `0.1.0` was
published with literal pnpm `workspace:*` dependency specifications:

- keeps `workspace:*` in source manifests for strict local workspace linking;
- requires pnpm for packing and publication so internal dependencies are
  rewritten to exact `0.1.1` versions;
- validates the actual `package.json` inside every pnpm-produced tarball before
  attempting a consumer install;
- rejects packed manifests containing any `workspace:` protocol or an
  incomplete/non-exact internal dependency set; and
- documents the pnpm-only, dependency-ordered publication procedure.

No package, tag, or GitHub release is created by preparing this entry.

## 0.1.0

The initial development release provides:

- a bounded deterministic matching engine and contributor detector contract;
- a filesystem-free static registry with eight production detectors;
- deterministic pretty and versioned JSON reporting;
- a bounded UTF-8 file/stdin CLI with explicit exit codes;
- offline runtime operation without telemetry, credentials, or remote APIs;
- validated fixtures and an automatically discovered detector test harness;
- contributor documentation and GitHub contribution templates; and
- deterministic package packing, offline clean-install tests, declaration
  checks, and packaged CLI smoke tests.

It also includes release-quality root and package documentation, explicit
architecture and security policies, and a public roadmap.

Known release defect: the packages with internal dependencies were published by
a tool that did not rewrite pnpm's workspace protocol. Their public manifests
therefore contain literal `workspace:*` specifications, making the `0.1.0`
package set unsuitable for installation. Use `0.1.1` after it is published.

Supported detectors are listed in the repository
[README](README.md#supported-catalog). No broader ecosystem support is claimed.
