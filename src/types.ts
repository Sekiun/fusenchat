export type WritingMode = "horizontal" | "vertical";
export type RenderScale = 1 | 2 | 3;

export type BubbleItem = {
  id: string;
  blob: Blob;
  text: string;
  fileName: string;
  filePath: string;
  previewSrc: string;
  createdAt: string;
  bubbleColor: string;
  fontFamily: string;
  fontWeight: number;
  textColor: string;
  writingMode: WritingMode;
  width: number;
  height: number;
};

export type FusenchatPngMetadata = {
  text: string;
  createdAt: string;
  app?: string;
};
