# `@oss-error-registry/registry`

The reviewed, statically imported production detector catalog for OSS Error
Registry.

> Version `0.1.0` is prepared but has not yet been published to npm. Requires
> Node.js 22.13.0 or newer and uses ESM.

## Install

After publication:

```sh
npm install @oss-error-registry/core @oss-error-registry/registry
```

## Usage

```ts
import { analyze } from "@oss-error-registry/core";
import { builtInDetectors } from "@oss-error-registry/registry";

declare const errorText: string;

const result = analyze(errorText, builtInDetectors);
```

The package root exports only the frozen `builtInDetectors` collection. Version
`0.1.0` includes eight focused Docker, Git, Node.js, npm, pnpm, and TypeScript
detectors. The catalog does not claim broader ecosystem or error coverage.

Runtime loading is filesystem-free: the package uses committed static imports
and does not discover files, read fixtures, load arbitrary modules, access a
network, execute commands, or send telemetry. Detector discovery and fixture
validation are development-time repository tooling only.

See the
[supported catalog](https://github.com/chetanx5/oss-error-registry#supported-catalog),
[registry architecture](https://github.com/chetanx5/oss-error-registry/blob/main/docs/registry-architecture.md),
and
[detector contribution guide](https://github.com/chetanx5/oss-error-registry/blob/main/DETECTOR_GUIDE.md).
