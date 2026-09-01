function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareAscii(left, right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function jsonEqual(left, right) {
  return (
    JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
  );
}

function collectWorkspaceProtocolPaths(value, currentPath, paths) {
  if (typeof value === "string") {
    if (value.startsWith("workspace:")) {
      paths.push(currentPath);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectWorkspaceProtocolPaths(
        entry,
        `${currentPath}[${String(index)}]`,
        paths,
      );
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value).sort(([left], [right]) =>
      compareAscii(left, right),
    )) {
      collectWorkspaceProtocolPaths(
        entry,
        `${currentPath}[${JSON.stringify(key)}]`,
        paths,
      );
    }
  }
}

export function findWorkspaceProtocolPaths(value) {
  const paths = [];
  collectWorkspaceProtocolPaths(value, "$", paths);
  return Object.freeze(paths);
}

function fail(packageName, message) {
  throw new Error(`Packed manifest ${packageName}: ${message}`);
}

export function assertPackedManifest(manifest, expectation) {
  if (!isRecord(manifest)) {
    fail(expectation.name, "package.json must contain an object");
  }
  if (manifest.name !== expectation.name) {
    fail(expectation.name, `name must be ${expectation.name}`);
  }
  if (manifest.version !== expectation.version) {
    fail(expectation.name, `version must be ${expectation.version}`);
  }

  const workspaceProtocolPaths = findWorkspaceProtocolPaths(manifest);
  if (workspaceProtocolPaths.length > 0) {
    fail(
      expectation.name,
      `forbidden workspace: protocol at ${workspaceProtocolPaths.join(", ")}`,
    );
  }

  const dependencies = manifest.dependencies ?? {};
  if (!isRecord(dependencies)) {
    fail(expectation.name, "dependencies must be an object when present");
  }
  const expectedDependencies = Object.fromEntries(
    [...expectation.dependencyNames]
      .sort(compareAscii)
      .map((dependency) => [dependency, expectation.version]),
  );
  if (!jsonEqual(dependencies, expectedDependencies)) {
    fail(
      expectation.name,
      `dependencies must be exact lockstep versions ${JSON.stringify(expectedDependencies)}; received ${JSON.stringify(canonicalize(dependencies))}`,
    );
  }
}
