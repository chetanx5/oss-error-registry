import { describe, expect, expectTypeOf, it } from "vitest";

import { definePlugin, type DetectorPlugin } from "@oss-error-registry/core";

import { npmEresolvePeerDependencyExample } from "./fixtures/npm-eresolve-peer-dependency.js";

function validateUnknown(value: unknown): void {
  definePlugin(value as DetectorPlugin);
}

describe("definePlugin", () => {
  it("accepts and freezes a declarative detector bundle", () => {
    const plugin = definePlugin({
      apiVersion: 1,
      id: "test-registry",
      detectors: [structuredClone(npmEresolvePeerDependencyExample)],
    });

    expect(plugin.id).toBe("test-registry");
    expect(plugin.detectors[0]?.id).toBe("npm/eresolve-peer-dependency");
    expect(Object.isFrozen(plugin)).toBe(true);
    expect(Object.isFrozen(plugin.detectors)).toBe(true);
    expect(Object.isFrozen(plugin.detectors[0])).toBe(true);
    expect(Reflect.set(plugin.detectors, "0", undefined)).toBe(false);
    expectTypeOf(plugin.id).toEqualTypeOf<"test-registry">();
    expectTypeOf(plugin.apiVersion).toEqualTypeOf<1>();
  });

  it("rejects an empty declarative bundle", () => {
    expect(() =>
      validateUnknown({
        apiVersion: 1,
        id: "empty-test-registry",
        detectors: [],
      }),
    ).toThrowError(
      'Plugin "empty-test-registry": detectors must be a non-empty array',
    );
  });

  it("rejects a whitespace-only plugin ID", () => {
    expect(() =>
      validateUnknown({
        apiVersion: 1,
        id: "   ",
        detectors: [npmEresolvePeerDependencyExample],
      }),
    ).toThrowError('Plugin "   ": id must be a non-empty string');
  });

  it("rejects unsupported plugin API versions", () => {
    expect(() =>
      validateUnknown({
        apiVersion: 2,
        id: "test-registry",
        detectors: [npmEresolvePeerDependencyExample],
      }),
    ).toThrowError(
      'Plugin "test-registry": apiVersion must be the supported version 1',
    );
  });

  it("rejects duplicate detector IDs inside a plugin", () => {
    expect(() =>
      validateUnknown({
        apiVersion: 1,
        id: "test-registry",
        detectors: [
          npmEresolvePeerDependencyExample,
          structuredClone(npmEresolvePeerDependencyExample),
        ],
      }),
    ).toThrowError(
      'Plugin "test-registry": detectors[1].id must be unique; duplicate "npm/eresolve-peer-dependency"',
    );
  });

  it("validates nested detector definitions", () => {
    expect(() =>
      validateUnknown({
        apiVersion: 1,
        id: "test-registry",
        detectors: [{ ...npmEresolvePeerDependencyExample, documentation: [] }],
      }),
    ).toThrowError(
      'Detector "npm/eresolve-peer-dependency": documentation must be a non-empty array',
    );
  });

  it("rejects plugin hooks without invoking them", () => {
    let hookWasInvoked = false;
    const onLoad = (): void => {
      hookWasInvoked = true;
    };

    expect(() =>
      validateUnknown({
        apiVersion: 1,
        id: "test-registry",
        detectors: [npmEresolvePeerDependencyExample],
        onLoad,
      }),
    ).toThrowError('Plugin "test-registry": onLoad is not supported');
    expect(hookWasInvoked).toBe(false);
  });
});
