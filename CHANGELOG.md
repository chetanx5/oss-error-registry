# Changelog

All notable changes will be documented in this file. The project follows
[Semantic Versioning](https://semver.org/) and keeps the four public workspace
packages on one lockstep version.

## Unreleased

The repository is release-ready but has not been published to npm. The initial
release candidate currently provides:

- a bounded deterministic matching engine and contributor detector contract;
- a filesystem-free static registry with eight production detectors;
- deterministic pretty and versioned JSON reporting;
- a bounded UTF-8 file/stdin CLI with explicit exit codes;
- offline runtime operation without telemetry, credentials, or remote APIs;
- validated fixtures and an automatically discovered detector test harness;
- contributor documentation and GitHub contribution templates; and
- deterministic package packing, offline clean-install tests, declaration
  checks, and packaged CLI smoke tests.

Supported detectors are listed in the repository
[README](README.md#supported-catalog). No broader ecosystem support is claimed.
