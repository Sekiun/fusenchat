import type { FusenchatPngMetadata } from "../types";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const TEXT_KEY = "fusenchat:text";
const PAYLOAD_KEY = "fusenchat:payload";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const crc32Table = createCrc32Table();

type PngChunk = {
  data: Uint8Array;
  type: string;
};

export function readPngMetadata(bytes: Uint8Array): FusenchatPngMetadata | null {
  const chunks = parsePngChunks(bytes);

  for (const chunk of chunks) {
    if (chunk.type !== "iTXt") {
      continue;
    }

    const parsed = parseInternationalTextChunk(chunk.data);
    if (!parsed) {
      continue;
    }

    if (parsed.keyword === PAYLOAD_KEY) {
      return JSON.parse(parsed.text) as FusenchatPngMetadata;
    }
  }

  for (const chunk of chunks) {
    if (chunk.type !== "iTXt") {
      continue;
    }

    const parsed = parseInternationalTextChunk(chunk.data);
    if (!parsed || parsed.keyword !== TEXT_KEY) {
      continue;
    }

    return {
      text: parsed.text,
      createdAt: "",
      app: "fusenchat",
    };
  }

  return null;
}

export function writePngMetadata(
  pngBytes: Uint8Array,
  metadata: FusenchatPngMetadata,
): Uint8Array {
  const chunks = parsePngChunks(pngBytes).filter((chunk) => {
    if (chunk.type !== "iTXt") {
      return true;
    }

    const parsed = parseInternationalTextChunk(chunk.data);
    return parsed?.keyword !== TEXT_KEY && parsed?.keyword !== PAYLOAD_KEY;
  });

  const injectedChunks = [
    createChunk("iTXt", createInternationalTextData(TEXT_KEY, metadata.text)),
    createChunk("iTXt", createInternationalTextData(PAYLOAD_KEY, JSON.stringify(metadata))),
  ];

  const encodedChunks: Uint8Array[] = [PNG_SIGNATURE];
  let inserted = false;

  for (const chunk of chunks) {
    if (!inserted && chunk.type === "IEND") {
      encodedChunks.push(...injectedChunks);
      inserted = true;
    }

    encodedChunks.push(createChunk(chunk.type, chunk.data));
  }

  if (!inserted) {
    throw new Error("PNG metadata could not be written because the IEND chunk was missing.");
  }

  return concatBytes(encodedChunks);
}

function parsePngChunks(bytes: Uint8Array): PngChunk[] {
  if (!hasPngSignature(bytes)) {
    throw new Error("The PNG signature is invalid.");
  }

  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      throw new Error("Unexpected end of PNG chunk header.");
    }

    const length = readUint32(bytes, offset);
    const type = decoder.decode(bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;

    if (crcEnd > bytes.length) {
      throw new Error(`Unexpected end of PNG chunk data for ${type}.`);
    }

    chunks.push({
      data: bytes.slice(dataStart, dataEnd),
      type,
    });
    offset = crcEnd;
  }

  return chunks;
}

function parseInternationalTextChunk(
  data: Uint8Array,
): { keyword: string; text: string } | null {
  const keywordEnd = data.indexOf(0);
  if (keywordEnd <= 0 || keywordEnd + 5 > data.length) {
    return null;
  }

  const keyword = decoder.decode(data.slice(0, keywordEnd));
  const compressionFlag = data[keywordEnd + 1];
  const languageStart = keywordEnd + 3;
  const languageEnd = data.indexOf(0, languageStart);

  if (languageEnd < 0) {
    return null;
  }

  const translatedStart = languageEnd + 1;
  const translatedEnd = data.indexOf(0, translatedStart);

  if (translatedEnd < 0 || compressionFlag !== 0) {
    return null;
  }

  return {
    keyword,
    text: decoder.decode(data.slice(translatedEnd + 1)),
  };
}

function createInternationalTextData(keyword: string, text: string): Uint8Array {
  return concatBytes([
    encoder.encode(keyword),
    new Uint8Array([0, 0, 0, 0, 0]),
    encoder.encode(text),
  ]);
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(type);
  const crcInput = concatBytes([typeBytes, data]);
  const chunk = new Uint8Array(12 + data.length);

  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(crcInput));

  return chunk;
}

function hasPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) {
    return false;
  }

  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  return combined;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}
