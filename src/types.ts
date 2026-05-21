export type BubbleItem = {
  id: string;
  text: string;
  filePath: string;
  previewSrc: string;
  createdAt: string;
  width: number;
  height: number;
};

export type FusenchatPngMetadata = {
  text: string;
  createdAt: string;
  app?: string;
};
