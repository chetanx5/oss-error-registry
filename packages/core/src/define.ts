import type { DetectorDefinition, DetectorPlugin } from "./detector.js";
import {
  assertDetectorDefinition,
  assertDetectorPlugin,
} from "./validation.js";

type DeepReadonly<T> = T extends object
  ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
  : T;

function deepFreeze<T>(
  value: T,
  seen = new WeakSet<object>(),
): DeepReadonly<T> {
  if (value === null || typeof value !== "object") {
    return value as DeepReadonly<T>;
  }

  if (seen.has(value)) {
    return value as DeepReadonly<T>;
  }

  seen.add(value);

  for (const key of Reflect.ownKeys(value)) {
    const child = (value as unknown as Record<PropertyKey, unknown>)[key];
    deepFreeze(child, seen);
  }

  return Object.freeze(value) as DeepReadonly<T>;
}

export function defineDetector<const Definition extends DetectorDefinition>(
  definition: Definition,
): DeepReadonly<Definition> {
  assertDetectorDefinition(definition);
  return deepFreeze(definition);
}

export function definePlugin<const Plugin extends DetectorPlugin>(
  plugin: Plugin,
): DeepReadonly<Plugin> {
  assertDetectorPlugin(plugin);
  return deepFreeze(plugin);
}
