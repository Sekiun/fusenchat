import { useRef, useState } from "react";
import { toCssFontFamily } from "../lib/fontUtils";
import type { RenderScale, WritingMode } from "../types";
import { readMetadataFromPngBytes } from "../lib/pngMetadata";

const BUBBLE_COLOR_PRESETS = [
  "#2f2f2f",
  "#3e5a78",
  "#6b4d7a",
  "#3a6b52",
  "#8b5a3c",
  "#d9d4c7",
];

type InputPanelProps = {
  availableFonts: string[];
  bubbleColor: string;
  fontFamily: string;
  onBubbleColorChange: (value: string) => void;
  onFontFamilyChange: (value: string) => void;
  onScaleChange: (value: RenderScale) => void;
  onWritingModeChange: (value: WritingMode) => void;
  onChange: (value: string) => void;
  onAppendTexts: (texts: string[]) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  onSubmit: () => void;
  scale: RenderScale;
  submitting: boolean;
  value: string;
  writingMode: WritingMode;
};

export function InputPanel({
  availableFonts,
  bubbleColor,
  fontFamily,
  onBubbleColorChange,
  onFontFamilyChange,
  onScaleChange,
  onWritingModeChange,
  onChange,
  onAppendTexts,
  onError,
  onNotice,
  onSubmit,
  scale,
  submitting,
  value,
  writingMode,
}: InputPanelProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    if (event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    onSubmit();
  };

  const handleDrop = async (event: React.DragEvent<HTMLTextAreaElement>): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    const droppedFiles = Array.from(event.dataTransfer.files);
    const pngFiles = droppedFiles.filter(isPngFile);

    if (pngFiles.length === 0) {
      onError("PNG ファイルのみドロップできます。");
      return;
    }

    onNotice("PNG メタデータを読み込んでいます…");
    onError(null);

    const restoredTexts: string[] = [];
    let skipped = 0;

    for (const file of pngFiles) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const metadata = await readMetadataFromPngBytes(bytes);
        if (metadata?.text) {
          restoredTexts.push(metadata.text);
        } else {
          skipped += 1;
        }
      } catch (error) {
        console.error(error);
        skipped += 1;
      }
    }

    if (restoredTexts.length > 0) {
      onAppendTexts(restoredTexts);
      onNotice(
        skipped > 0
          ? `テキストを ${restoredTexts.length} 件追加しました。${skipped} 件は読み取れませんでした。`
          : `テキストを ${restoredTexts.length} 件追加しました。`,
      );
      requestAnimationFrame(() => moveCaretToEnd(textareaRef.current));
      return;
    }

    onNotice(null);
    onError("PNG 内に fusenchat のメタデータが見つかりませんでした。");
  };

  return (
    <section className="input-panel">
      <div className="input-panel__surface">
        <div className="composer-toolbar">
          <div className="bubble-color-picker">
            <div className="bubble-color-picker__label">Bubble color</div>
            <div className="bubble-color-picker__controls">
              {BUBBLE_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`bubble-color-swatch${bubbleColor === preset ? " is-active" : ""}`}
                  style={{ backgroundColor: preset }}
                  aria-label={`Select ${preset}`}
                  onClick={() => onBubbleColorChange(preset)}
                />
              ))}
              <label className="bubble-color-custom">
                <span>Custom</span>
                <input
                  type="color"
                  value={bubbleColor}
                  onChange={(event) => onBubbleColorChange(event.target.value)}
                />
              </label>
            </div>
          </div>

          <label className="toolbar-field">
            <span>System Font</span>
            <select
              className="toolbar-select toolbar-select--font"
              value={fontFamily}
              style={{ fontFamily: toCssFontFamily(fontFamily) }}
              onChange={(event) => onFontFamilyChange(event.target.value)}
            >
              {availableFonts.map((family) => (
                <option key={family} value={family} style={{ fontFamily: toCssFontFamily(family) }}>
                  {family}
                </option>
              ))}
            </select>
          </label>

          <div className="toolbar-field">
            <span>Writing</span>
            <div className="toolbar-toggle" role="group" aria-label="Writing mode">
              <button
                type="button"
                className={writingMode === "horizontal" ? "is-active" : ""}
                onClick={() => onWritingModeChange("horizontal")}
              >
                横書き
              </button>
              <button
                type="button"
                className={writingMode === "vertical" ? "is-active" : ""}
                onClick={() => onWritingModeChange("vertical")}
              >
                縦書き
              </button>
            </div>
          </div>
          <div className="toolbar-field">
            <span>Resolution</span>
            <div className="toolbar-toggle" role="group" aria-label="Render scale">
              <button
                type="button"
                className={scale === 1 ? "is-active" : ""}
                onClick={() => onScaleChange(1)}
              >
                1x
              </button>
              <button
                type="button"
                className={scale === 2 ? "is-active" : ""}
                onClick={() => onScaleChange(2)}
              >
                2x
              </button>
              <button
                type="button"
                className={scale === 3 ? "is-active" : ""}
                onClick={() => onScaleChange(3)}
              >
                3x
              </button>
            </div>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          className={`input-box${isDragActive ? " input-box--dragging" : ""}`}
          placeholder="Ask for follow-up changes"
          value={value}
          disabled={submitting}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }
            setIsDragActive(false);
          }}
          onDrop={(event) => void handleDrop(event)}
        />
        <button
          type="button"
          className="send-button"
          disabled={submitting}
          onClick={onSubmit}
          aria-label="send"
        >
          ↑
        </button>
      </div>
    </section>
  );
}

function isPngFile(file: File): boolean {
  return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
}

function moveCaretToEnd(element: HTMLTextAreaElement | null): void {
  if (!element) {
    return;
  }

  const cursor = element.value.length;
  element.focus();
  element.selectionStart = cursor;
  element.selectionEnd = cursor;
  element.scrollTop = element.scrollHeight;
}
