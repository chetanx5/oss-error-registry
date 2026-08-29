import { Buffer } from "node:buffer";
import { open, stat, type FileHandle } from "node:fs/promises";
import { TextDecoder } from "node:util";

import { MAX_ANALYSIS_INPUT_BYTES } from "@oss-error-registry/core";

const READ_CHUNK_BYTES = 64 * 1024;

export class CliInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CliInputError";
  }
}

function inputTooLargeError(): CliInputError {
  return new CliInputError(
    `Input exceeds the maximum size of ${MAX_ANALYSIS_INPUT_BYTES} UTF-8 bytes.`,
  );
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CliInputError("Input must be valid UTF-8.");
  }
}

function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object") {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(error, "code");
  return descriptor !== undefined && "value" in descriptor
    ? String(descriptor.value)
    : undefined;
}

function mapFileError(error: unknown): CliInputError {
  if (error instanceof CliInputError) {
    return error;
  }

  switch (errorCode(error)) {
    case "ENOENT":
      return new CliInputError("Input file does not exist.");
    case "EACCES":
    case "EPERM":
      return new CliInputError("Input file is not readable.");
    case "EISDIR":
      return new CliInputError("Input path must be a regular file.");
    default:
      return new CliInputError("Could not read the input file.");
  }
}

async function readFileHandle(handle: FileHandle): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (totalBytes <= MAX_ANALYSIS_INPUT_BYTES) {
    const remainingBytes = MAX_ANALYSIS_INPUT_BYTES + 1 - totalBytes;
    const buffer = Buffer.allocUnsafe(
      Math.min(READ_CHUNK_BYTES, remainingBytes),
    );
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
    if (bytesRead === 0) {
      break;
    }

    totalBytes += bytesRead;
    if (totalBytes > MAX_ANALYSIS_INPUT_BYTES) {
      throw inputTooLargeError();
    }
    chunks.push(buffer.subarray(0, bytesRead));
  }

  return Buffer.concat(chunks, totalBytes);
}

export async function readInputFile(filePath: string): Promise<string> {
  try {
    const initialStats = await stat(filePath);
    if (!initialStats.isFile()) {
      throw new CliInputError("Input path must be a regular file.");
    }
    if (initialStats.size > MAX_ANALYSIS_INPUT_BYTES) {
      throw inputTooLargeError();
    }

    const handle = await open(filePath, "r");
    try {
      const openedStats = await handle.stat();
      if (!openedStats.isFile()) {
        throw new CliInputError("Input path must be a regular file.");
      }
      if (openedStats.size > MAX_ANALYSIS_INPUT_BYTES) {
        throw inputTooLargeError();
      }
      return decodeUtf8(await readFileHandle(handle));
    } finally {
      await handle.close();
    }
  } catch (error) {
    throw mapFileError(error);
  }
}

function chunkToBytes(chunk: unknown): Uint8Array {
  if (typeof chunk === "string") {
    return Buffer.from(chunk, "utf8");
  }
  if (chunk instanceof Uint8Array) {
    return chunk;
  }
  throw new CliInputError("Could not read standard input.");
}

export async function readStandardInput(
  stream: AsyncIterable<unknown>,
): Promise<string> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    for await (const chunk of stream) {
      const bytes = chunkToBytes(chunk);
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_ANALYSIS_INPUT_BYTES) {
        throw inputTooLargeError();
      }
      chunks.push(bytes);
    }
  } catch (error) {
    if (error instanceof CliInputError) {
      throw error;
    }
    throw new CliInputError("Could not read standard input.");
  }

  return decodeUtf8(Buffer.concat(chunks, totalBytes));
}
