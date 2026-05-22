export type BubbleItem = {
  id: string;
  text: string;
  filePath: string;
  previewSrc: string;
  createdAt: string;
  bubbleColor: string;
  textColor: string;
  width: number;
  height: number;
};

export type FusenchatPngMetadata = {
  text: string;
  createdAt: string;
  app?: string;
};
