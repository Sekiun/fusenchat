import { startBubbleFileDrag } from "../lib/fileUtils";
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
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>): void => {
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
      <div className="bubble-card" draggable onDragStart={handleDragStart}>
        <img
          className="bubble-card__image"
          src={bubble.previewSrc}
          alt={bubble.text}
          width={bubble.width}
          height={bubble.height}
          draggable={false}
        />
        <div className="bubble-card__actions">
          <button type="button" onClick={() => void onCopyPath(bubble)}>
            Path
          </button>
          <button type="button" onClick={() => void onCopyImage(bubble)}>
            Image
          </button>
          <button type="button" onClick={() => void onOpenFolder(bubble)}>
            Folder
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
