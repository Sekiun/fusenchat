export type RenderBubbleOptions = {
  maxWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  paddingX?: number;
  paddingY?: number;
  radius?: number;
  bubbleColor?: string;
  textColor?: string;
};

export type RenderedBubble = {
  blob: Blob;
  width: number;
  height: number;
};

const DEFAULT_OPTIONS: Required<RenderBubbleOptions> = {
  maxWidth: 520,
  fontSize: 24,
  fontFamily: '"Yu Gothic UI", "Meiryo", sans-serif',
  lineHeight: 1.4,
  paddingX: 28,
  paddingY: 18,
  radius: 20,
  bubbleColor: "#2f2f2f",
  textColor: "#ffffff",
};

export async function renderBubbleToPng(
  text: string,
  options: RenderBubbleOptions = {},
): Promise<RenderedBubble> {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas 2D context could not be created.");
  }

  ctx.font = getFontString(resolved.fontSize, resolved.fontFamily);
  ctx.textBaseline = "top";

  const normalized = normalizeText(text);
  const maxTextWidth = resolved.maxWidth - resolved.paddingX * 2;
  const wrappedLines = wrapText(ctx, normalized, maxTextWidth);
  const lineHeightPx = resolved.fontSize * resolved.lineHeight;
  const lineWidths = wrappedLines.map((line) => measureLine(ctx, line));
  const textWidth = lineWidths.length === 0 ? 0 : Math.max(...lineWidths);
  const bubbleWidth = Math.ceil(
    Math.min(resolved.maxWidth, Math.max(textWidth + resolved.paddingX * 2, resolved.paddingX * 2 + 24)),
  );
  const bubbleHeight = Math.ceil(
    Math.max(resolved.paddingY * 2 + lineHeightPx, wrappedLines.length * lineHeightPx + resolved.paddingY * 2),
  );

  canvas.width = bubbleWidth;
  canvas.height = bubbleHeight;

  ctx.clearRect(0, 0, bubbleWidth, bubbleHeight);
  ctx.font = getFontString(resolved.fontSize, resolved.fontFamily);
  ctx.textBaseline = "top";
  ctx.fillStyle = resolved.bubbleColor;
  drawRoundedRect(ctx, 0, 0, bubbleWidth, bubbleHeight, resolved.radius);
  ctx.fill();

  ctx.fillStyle = resolved.textColor;
  wrappedLines.forEach((line, index) => {
    const y = resolved.paddingY + index * lineHeightPx;
    ctx.fillText(line, resolved.paddingX, y);
  });

  const blob = await canvasToBlob(canvas);

  return {
    blob,
    width: bubbleWidth,
    height: bubbleHeight,
  };
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxTextWidth: number,
): string[] {
  const sourceLines = text.split("\n");
  const wrapped: string[] = [];

  for (const sourceLine of sourceLines) {
    if (sourceLine.length === 0) {
      wrapped.push("");
      continue;
    }

    let current = "";

    for (const char of Array.from(sourceLine)) {
      const candidate = current + char;
      if (measureLine(ctx, candidate) <= maxTextWidth || current.length === 0) {
        current = candidate;
        continue;
      }

      wrapped.push(current);
      current = char;
    }

    wrapped.push(current);
  }

  return wrapped.length > 0 ? wrapped : [""];
}

function measureLine(ctx: CanvasRenderingContext2D, line: string): number {
  if (line.length === 0) {
    return 0;
  }

  return ctx.measureText(line).width;
}

function getFontString(fontSize: number, fontFamily: string): string {
  return `600 ${fontSize}px ${fontFamily}`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to convert canvas to PNG blob."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}
