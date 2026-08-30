# Contributing

Thank you for helping OSS Error Registry diagnose real developer errors without
network services or nondeterministic logic.

## Before opening a change

- Use Node.js 22.13.0 or newer and pnpm 11 or newer.
- Search existing issues and detector IDs to avoid duplicate work.
- Keep each pull request focused on one problem or one closely related detector
  family.
- Use real, recognizable error output. Remove credentials, tokens, private
  hosts, usernames, and machine-specific paths from fixtures.

Install and validate the workspace:

```sh
pnpm install
pnpm check
```

On Windows, use `pnpm.cmd` if PowerShell blocks script shims. Do not change the
system execution policy just for this repository.

## Adding a detector

The complete one-detector workflow is in
[`DETECTOR_GUIDE.md`](DETECTOR_GUIDE.md). A detector contribution normally adds
only one self-contained directory under
`packages/registry/src/detectors/<ecosystem>/<detector-name>/` and the generated
index update produced by the tooling.

Do not manually edit `packages/registry/src/generated/detectors.ts`. Run:

```sh
pnpm registry:generate
pnpm check
git diff --check
```

The registry generator validates the directory, source shape, cases, fixtures,
paths, and generated ordering. The generic test harness automatically imports
the generated registry and runs every declared positive and negative case.

## Pull requests

Create a topic branch from current `main`, make the smallest useful change, and
open a pull request. Include:

- the real error and ecosystem being diagnosed;
- why the signature is specific enough to be deterministic;
- positive and near-miss negative fixtures;
- authoritative HTTPS documentation;
- the commands you ran locally; and
- any known false-positive or version limitations.

Keep generated files in the same pull request as their source detector. Do not
include dependency directories, build output, logs, environment files, secrets,
or editor state.

## Safety and scope

Detector definitions and fixtures are data. They must not add callbacks,
executable hooks, dynamic imports, network requests, shell invocations, or test
fixtures that need to be executed. Command strings in diagnostic guidance are
display-only metadata and must be conservative, reviewable, and clearly marked
with the appropriate remediation safety level.

Changes to core matching semantics, reporter formats, the CLI contract, or the
registry architecture should be proposed separately from detector additions.
