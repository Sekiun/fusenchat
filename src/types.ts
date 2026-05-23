export type WritingMode = "horizontal" | "vertical";

export type BubbleItem = {
  id: string;
  text: string;
  filePath: string;
  previewSrc: string;
  createdAt: string;
  bubbleColor: string;
  fontFamily: string;
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
