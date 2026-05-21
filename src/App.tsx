import { useEffect, useRef, useState } from "react";
import { ChatArea } from "./components/ChatArea";
import { Header } from "./components/Header";
import { InputPanel } from "./components/InputPanel";
import { renderBubbleToPng } from "./lib/bubbleRenderer";
import { buildBubbleFileName, formatIsoWithOffset } from "./lib/dateUtils";
import {
  copyBubbleImage,
  copyFilePath,
  deleteBubbleFile,
  openBubbleFolder,
  saveBubblePngWithMetadata,
} from "./lib/fileUtils";
import type { BubbleItem, FusenchatPngMetadata } from "./types";

export default function App(): JSX.Element {
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }

    const rawText = inputText;
    if (rawText.trim().length === 0) {
      return;
    }

    const createdAt = formatIsoWithOffset(new Date());
    const metadata: FusenchatPngMetadata = {
      text: rawText,
      createdAt,
      app: "fusenchat",
    };

    setIsSubmitting(true);
    setError(null);
    setNotice("PNG バブルを生成しています…");

    try {
      const rendered = await renderBubbleToPng(rawText);
      const fileName = buildBubbleFileName(new Date());
      const filePath = await saveBubblePngWithMetadata(rendered.blob, fileName, metadata);
      const previewSrc = URL.createObjectURL(rendered.blob);
      previewUrlsRef.current.add(previewSrc);

      const bubble: BubbleItem = {
        id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : fileName,
        text: rawText,
        filePath,
        previewSrc,
        createdAt,
        width: rendered.width,
        height: rendered.height,
      };

      setBubbles((prev) => [...prev, bubble]);
      setInputText("");
      setNotice("PNG を保存しました。");
    } catch (submitError) {
      console.error(submitError);
      setNotice(null);
      setError(toErrorMessage(submitError, "PNG の生成または保存に失敗しました。"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppendTexts = (texts: string[]): void => {
    setInputText((prev) => {
      let nextValue = prev;

      for (const text of texts) {
        if (!text) {
          continue;
        }

        nextValue = nextValue.trim().length > 0 ? `${nextValue}\n${text}` : text;
      }

      return nextValue;
    });
  };

  const handleDelete = async (bubble: BubbleItem): Promise<void> => {
    try {
      await deleteBubbleFile(bubble.filePath);
      setBubbles((prev) => prev.filter((item) => item.id !== bubble.id));
      revokePreviewUrl(bubble.previewSrc, previewUrlsRef.current);
      setNotice("PNG を削除しました。");
      setError(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError(toErrorMessage(deleteError, "PNG の削除に失敗しました。"));
    }
  };

  const handleOpenFolder = async (bubble: BubbleItem): Promise<void> => {
    try {
      await openBubbleFolder(bubble.filePath);
      setNotice("保存先フォルダを開きました。");
      setError(null);
    } catch (openError) {
      console.error(openError);
      setError(toErrorMessage(openError, "保存先フォルダを開けませんでした。"));
    }
  };

  const handleCopyPath = async (bubble: BubbleItem): Promise<void> => {
    try {
      await copyFilePath(bubble.filePath);
      setNotice("ファイルパスをコピーしました。");
      setError(null);
    } catch (copyError) {
      console.error(copyError);
      setError(toErrorMessage(copyError, "ファイルパスのコピーに失敗しました。"));
    }
  };

  const handleCopyImage = async (bubble: BubbleItem): Promise<void> => {
    try {
      await copyBubbleImage(bubble.filePath);
      setNotice("画像をクリップボードへコピーしました。");
      setError(null);
    } catch (copyError) {
      console.error(copyError);
      setError(toErrorMessage(copyError, "画像のコピーに失敗しました。"));
    }
  };

  return (
    <div className="app">
      <Header />
      <ChatArea
        bubbles={bubbles}
        onOpenFolder={handleOpenFolder}
        onCopyPath={handleCopyPath}
        onCopyImage={handleCopyImage}
        onDelete={handleDelete}
      />
      <div className="status-bar" aria-live="polite">
        {error ? <span className="status-bar__error">{error}</span> : notice}
      </div>
      <InputPanel
        value={inputText}
        submitting={isSubmitting}
        onChange={setInputText}
        onSubmit={() => void handleSubmit()}
        onAppendTexts={handleAppendTexts}
        onNotice={setNotice}
        onError={setError}
      />
    </div>
  );
}

function revokePreviewUrl(url: string, previewUrls: Set<string>): void {
  if (!previewUrls.has(url)) {
    return;
  }

  URL.revokeObjectURL(url);
  previewUrls.delete(url);
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallback;
}
