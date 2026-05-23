import { startBubbleFileDrag } from "../lib/fileUtils";
import { isTauriRuntime } from "../lib/runtime";
import type { BubbleItem } from "../types";

type BubbleCardProps = {
  bubble: BubbleItem;
  onOpenFolder: (bubble: BubbleItem) => Promise<void> | void;
  onCopyPath: (bubble: BubbleItem) => Promise<void> | void;
  onCopyImage: (bubble: BubbleItem) => Promise<void> | void;
  onDelete: (bubble: BubbleItem) => Promise<void> | void;
  onDragOutError: (message: string) => void;
};

export function BubbleCard({
  bubble,
  onOpenFolder,
  onCopyPath,
  onCopyImage,
  onDelete,
  onDragOutError,
}: BubbleCardProps): JSX.Element {
  const desktopMode = isTauriRuntime();

  const handleDragStart = (event: React.DragEvent<HTMLDivElement | HTMLImageElement>): void => {
    if (event.currentTarget instanceof HTMLImageElement) {
      event.dataTransfer.setDragImage(
        event.currentTarget,
        Math.min(48, event.currentTarget.width / 2),
        Math.min(48, event.currentTarget.height / 2),
      );
    } else {
      const previewImage = event.currentTarget.querySelector<HTMLImageElement>(".bubble-card__image");
      if (previewImage) {
        event.dataTransfer.setDragImage(
          previewImage,
          Math.min(48, previewImage.width / 2),
          Math.min(48, previewImage.height / 2),
        );
      }
    }

    if (!desktopMode) {
      const dragFile = new File([bubble.blob], bubble.fileName, {
        type: bubble.blob.type || "image/png",
      });

      event.dataTransfer.effectAllowed = "copy";
      if (typeof event.dataTransfer.items?.add === "function") {
        event.dataTransfer.items.add(dragFile);
      } else {
        event.dataTransfer.setData(
          "DownloadURL",
          `image/png:${bubble.fileName}:${bubble.previewSrc}`,
        );
      }
      return;
    }

    event.preventDefault();
    void startBubbleFileDrag(bubble.filePath).catch((error: unknown) => {
      console.error(error);
      onDragOutError(
        error instanceof Error && error.message
          ? error.message
          : "Native file drag could not be started.",
      );
    });
  };

  return (
    <article className="bubble-row">
      <div
        className="bubble-card"
        draggable
        onDragStart={handleDragStart}
      >
        <img
          className="bubble-card__image"
          src={bubble.previewSrc}
          alt={bubble.text}
          width={bubble.width}
          height={bubble.height}
          draggable
          onDragStart={handleDragStart}
        />
        <div className="bubble-card__actions">
          {desktopMode ? (
            <button type="button" onClick={() => void onCopyPath(bubble)}>
              Path
            </button>
          ) : null}
          <button type="button" onClick={() => void onCopyImage(bubble)}>
            Image
          </button>
          <button type="button" onClick={() => void onOpenFolder(bubble)}>
            {desktopMode ? "Folder" : "Download"}
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => void onDelete(bubble)}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
