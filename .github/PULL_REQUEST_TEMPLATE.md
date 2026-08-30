## Summary

Describe the focused change and why it is needed.

## Detector checklist

If this pull request adds or changes a detector, confirm:

- [ ] The detector represents a real, recognizable error.
- [ ] The signature uses specific deterministic evidence and appropriate
      exclusions.
- [ ] At least one positive fixture is included.
- [ ] At least one near-miss negative fixture is included.
- [ ] `cases.json` covers every fixture and positive scores are exact.
- [ ] Guidance includes likely causes, diagnostics, conservative remediation,
      and an authoritative HTTPS reference.
- [ ] Fixtures contain no secrets or private data.
- [ ] `pnpm registry:generate` was run; the generated index was not edited
      manually.

## Validation

- [ ] `pnpm check`
- [ ] `git diff --check`

## Known limitations

List version-specific signatures, false-positive risks, or follow-up work.
