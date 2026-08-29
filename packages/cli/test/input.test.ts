import { Buffer } from "node:buffer";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { MAX_ANALYSIS_INPUT_BYTES } from "@oss-error-registry/core";

import { readInputFile, readStandardInput } from "../src/input.js";

const temporaryRoots: string[] = [];

async function createTemporaryPath(
  contents?: Uint8Array | string,
): Promise<{ readonly filePath: string; readonly root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "oss-error-registry-input-"));
  temporaryRoots.push(root);
  const filePath = path.join(root, "input.log");
  if (contents !== undefined) {
    await writeFile(filePath, contents);
  }
  return { filePath, root };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true });
    }),
  );
});

describe("readInputFile", () => {
  it("reads UTF-8 file data exactly", async () => {
    const text = "Unicode log: Ошибка 🚨\r\nsecond line";
    const { filePath } = await createTemporaryPath(text);

    expect(await readInputFile(filePath)).toBe(text);
  });

  it("accepts a file at the exact byte limit", async () => {
    const input = "x".repeat(MAX_ANALYSIS_INPUT_BYTES);
    const { filePath } = await createTemporaryPath(input);

    expect((await readInputFile(filePath)).length).toBe(
      MAX_ANALYSIS_INPUT_BYTES,
    );
  });

  it("rejects a file above the byte limit", async () => {
    const input = "x".repeat(MAX_ANALYSIS_INPUT_BYTES + 1);
    const { filePath } = await createTemporaryPath(input);

    await expect(readInputFile(filePath)).rejects.toThrowError(
      `Input exceeds the maximum size of ${MAX_ANALYSIS_INPUT_BYTES} UTF-8 bytes.`,
    );
  });

  it("rejects malformed UTF-8", async () => {
    const { filePath } = await createTemporaryPath(Buffer.from([0xc3, 0x28]));

    await expect(readInputFile(filePath)).rejects.toThrowError(
      "Input must be valid UTF-8.",
    );
  });

  it("reports a missing file deterministically", async () => {
    const { filePath } = await createTemporaryPath();

    await expect(readInputFile(filePath)).rejects.toThrowError(
      "Input file does not exist.",
    );
  });

  it("rejects a directory as an invalid input path", async () => {
    const { root } = await createTemporaryPath();

    await expect(readInputFile(root)).rejects.toThrowError(
      "Input path must be a regular file.",
    );
  });
});

describe("readStandardInput", () => {
  it("joins chunks before fatal UTF-8 decoding", async () => {
    const encoded = Buffer.from("split Unicode 🚨", "utf8");
    const splitPoint = encoded.length - 2;
    const stream = Readable.from([
      encoded.subarray(0, splitPoint),
      encoded.subarray(splitPoint),
    ]);

    expect(await readStandardInput(stream)).toBe("split Unicode 🚨");
  });

  it("accepts standard input at the exact byte limit", async () => {
    const stream = Readable.from([
      Buffer.alloc(MAX_ANALYSIS_INPUT_BYTES, 0x78),
    ]);

    expect((await readStandardInput(stream)).length).toBe(
      MAX_ANALYSIS_INPUT_BYTES,
    );
  });

  it("rejects standard input above the byte limit", async () => {
    const stream = Readable.from([
      Buffer.alloc(MAX_ANALYSIS_INPUT_BYTES + 1, 0x78),
    ]);

    await expect(readStandardInput(stream)).rejects.toThrowError(
      `Input exceeds the maximum size of ${MAX_ANALYSIS_INPUT_BYTES} UTF-8 bytes.`,
    );
  });

  it("rejects malformed UTF-8", async () => {
    const stream = Readable.from([Buffer.from([0xc3, 0x28])]);

    await expect(readStandardInput(stream)).rejects.toThrowError(
      "Input must be valid UTF-8.",
    );
  });

  it("maps stream failures to a deterministic input error", async () => {
    async function* failingStream(): AsyncGenerator<Uint8Array> {
      yield Buffer.from("partial", "utf8");
      throw new Error("platform-specific stream failure");
    }

    await expect(readStandardInput(failingStream())).rejects.toThrowError(
      "Could not read standard input.",
    );
  });

  it("rejects unsupported chunk values", async () => {
    async function* invalidStream(): AsyncGenerator<unknown> {
      yield { not: "bytes" };
    }

    await expect(readStandardInput(invalidStream())).rejects.toThrowError(
      "Could not read standard input.",
    );
  });
});
