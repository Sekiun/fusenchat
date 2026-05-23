import { writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { Image } from "@tauri-apps/api/image";
import type { FusenchatPngMetadata } from "../types";

export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function saveBubblePngWithMetadata(
  blob: Blob,
  fileName: string,
  metadata: FusenchatPngMetadata,
): Promise<string> {
  const bytes = await blobToUint8Array(blob);

  return invoke<string>("save_bubble_png_with_metadata", {
    payload: {
      bytes: Array.from(bytes),
      fileName,
      metadata,
    },
  });
}

export async function deleteBubbleFile(filePath: string): Promise<void> {
  await invoke("delete_bubble_png_file", {
    payload: {
      filePath,
    },
  });
}

export async function openBubbleFolder(filePath: string): Promise<void> {
  await revealItemInDir(filePath);
}

export async function copyFilePath(filePath: string): Promise<void> {
  await writeText(filePath);
}

export async function copyBubbleImage(filePath: string): Promise<void> {
  const image = await Image.fromPath(filePath);

  try {
    await writeImage(image);
  } finally {
    await image.close();
  }
}

export async function startBubbleFileDrag(filePath: string): Promise<void> {
  await invoke("start_bubble_file_drag", {
    payload: {
      filePath,
    },
  });
}

export async function listSystemFontFamilies(): Promise<string[]> {
  return invoke<string[]>("list_system_font_families");
}
