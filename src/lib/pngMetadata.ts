import { invoke } from "@tauri-apps/api/core";
import type { FusenchatPngMetadata } from "../types";

export async function readMetadataFromPngBytes(
  bytes: Uint8Array,
): Promise<FusenchatPngMetadata | null> {
  return invoke<FusenchatPngMetadata | null>("read_bubble_png_metadata_from_bytes", {
    payload: {
      bytes: Array.from(bytes),
    },
  });
}
