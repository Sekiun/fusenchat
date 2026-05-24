import type { FusenchatPngMetadata } from "../types";
import { isBlobUrl, isTauriRuntime } from "./runtime";
import { writePngMetadata } from "./pngMetadataWeb";

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

  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");

    return invoke<string>("save_bubble_png_with_metadata", {
      payload: {
        bytes: Array.from(bytes),
        fileName,
        metadata,
      },
    });
  }

  const encodedBytes = writePngMetadata(bytes, metadata);
  const encodedBuffer = new ArrayBuffer(encodedBytes.byteLength);
  new Uint8Array(encodedBuffer).set(encodedBytes);
  const encodedBlob = new Blob([encodedBuffer], { type: "image/png" });
  return URL.createObjectURL(encodedBlob);
}

export async function deleteBubbleFile(filePath: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");

  await invoke("delete_bubble_png_file", {
    payload: {
      filePath,
    },
  });
}

export async function openBubbleFolder(filePath: string, fileName?: string): Promise<void> {
  if (isTauriRuntime()) {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(filePath);
    return;
  }

  if (isBlobUrl(filePath)) {
    triggerDownload(filePath, fileName ?? "bubble.png");
    return;
  }

  window.open(filePath, "_blank", "noopener,noreferrer");
}

export async function copyFilePath(filePath: string, fileName?: string): Promise<void> {
  if (isTauriRuntime()) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(filePath);
    return;
  }

  await navigator.clipboard.writeText(fileName ?? filePath);
}

export async function copyBubbleImage(filePath: string, fallbackUrl?: string): Promise<void> {
  if (isTauriRuntime()) {
    const [{ writeImage }, { Image }] = await Promise.all([
      import("@tauri-apps/plugin-clipboard-manager"),
      import("@tauri-apps/api/image"),
    ]);
    const image = await Image.fromPath(filePath);

    try {
      await writeImage(image);
    } finally {
      await image.close();
    }

    return;
  }

  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("This browser does not support writing images to the clipboard.");
  }

  const sourceUrl = isBlobUrl(filePath) ? filePath : fallbackUrl;
  if (!sourceUrl) {
    throw new Error("The bubble image could not be resolved for clipboard copy.");
  }

  const response = await fetch(sourceUrl);
  const blob = await response.blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
}

export async function startBubbleFileDrag(filePath: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Native file drag is only available in the desktop app.");
  }

  const { invoke } = await import("@tauri-apps/api/core");

  await invoke("start_bubble_file_drag", {
    payload: {
      filePath,
    },
  });
}

export async function listSystemFontFamilies(): Promise<string[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string[]>("list_system_font_families");
}

function triggerDownload(url: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
