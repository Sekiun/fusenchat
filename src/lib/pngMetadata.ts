import type { FusenchatPngMetadata } from "../types";
import { readPngMetadata } from "./pngMetadataWeb";
import { isTauriRuntime } from "./runtime";

export async function readMetadataFromPngBytes(
  bytes: Uint8Array,
): Promise<FusenchatPngMetadata | null> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");

    return invoke<FusenchatPngMetadata | null>("read_bubble_png_metadata_from_bytes", {
      payload: {
        bytes: Array.from(bytes),
      },
    });
  }

  return readPngMetadata(bytes);
}
