# Roadmap

OSS Error Registry prioritizes reliable signatures and reviewable guidance over
detector count. Roadmap items describe direction, not promised dates.

## Initial `0.1.x` line

- Publish the four prepared ESM packages after explicit release approval.
- Collect real-world feedback on CLI usability, reporter stability, matching
  bounds, and false-positive/false-negative behavior.
- Improve existing signatures when sanitized fixtures demonstrate a concrete
  gap.
- Add carefully reviewed detectors for common errors in already represented
  ecosystems.

## Catalog growth

Future detector families may include Yarn, Next.js, React, Python, pip, uv,
PostgreSQL, Nginx, Vercel, and Cloudflare. An ecosystem is not considered
supported until at least one real detector with positive and near-miss negative
fixtures is merged. There is no target detector count.

## Contributor experience

- Keep one-detector contributions self-contained and free of central-list edits.
- Improve validation messages when real contributor mistakes reveal ambiguity.
- Expand documentation and examples only when they correspond to supported
  behavior.
- Preserve cross-platform checks on supported Node.js releases.

## Compatibility and stability

- Keep runtime operation offline, deterministic, bounded, and telemetry-free.
- Preserve the acyclic package dependency graph and narrow root exports.
- Version JSON schema or public contract changes explicitly.
- Document breaking changes prominently while the project is pre-`1.0.0`.
- Consider `1.0.0` only after public API, CLI, detector contract, and reporter
  behavior have sufficient real-world use.

Requests should start as focused GitHub issues with real error output, expected
behavior, and security-sensitive data removed. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`DETECTOR_GUIDE.md`](DETECTOR_GUIDE.md).
