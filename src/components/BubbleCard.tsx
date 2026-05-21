import type { BubbleItem } from "../types";

type BubbleCardProps = {
  bubble: BubbleItem;
  onOpenFolder: (bubble: BubbleItem) => Promise<void> | void;
  onCopyPath: (bubble: BubbleItem) => Promise<void> | void;
  onCopyImage: (bubble: BubbleItem) => Promise<void> | void;
  onDelete: (bubble: BubbleItem) => Promise<void> | void;
};

export function BubbleCard({
  bubble,
  onOpenFolder,
  onCopyPath,
  onCopyImage,
  onDelete,
}: BubbleCardProps): JSX.Element {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>): void => {
    const fileUri = toFileUri(bubble.filePath);
    event.dataTransfer.setData("text/plain", bubble.filePath);
    event.dataTransfer.setData("text/uri-list", fileUri);
    event.dataTransfer.effectAllowed = "copy";
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
          draggable={false}
        />
        <div className="bubble-card__actions">
          <button type="button" onClick={() => void onCopyPath(bubble)}>
            パス
          </button>
          <button type="button" onClick={() => void onCopyImage(bubble)}>
            画像
          </button>
          <button type="button" onClick={() => void onOpenFolder(bubble)}>
            フォルダ
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => void onDelete(bubble)}
          >
            削除
          </button>
        </div>
      </div>
    </article>
  );
}

function toFileUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return encodeURI(`file:///${normalized}`);
}
