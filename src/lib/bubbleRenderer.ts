import { marked } from "marked";

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
  bubbleColor: string;
  textColor: string;
  width: number;
  height: number;
};

type TextStyle = {
  color: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: "normal" | "italic";
  fontWeight: number;
  lineHeight: number;
  underline: boolean;
  strike: boolean;
  backgroundColor: string | null;
};

type StyledSegment = {
  style: TextStyle;
  text: string;
};

type LayoutFragment = {
  style: TextStyle;
  text: string;
  width: number;
};

type LayoutLine = {
  fragments: LayoutFragment[];
  height: number;
  indent: number;
  textWidth: number;
};

type LayoutBlock = {
  backgroundColor: string | null;
  contentHeight: number;
  contentWidth: number;
  lines: LayoutLine[];
  marginBottom: number;
  paddingX: number;
  paddingY: number;
  quoteDepth: number;
  separator: boolean;
  separatorColor: string;
  separatorThickness: number;
  totalHeight: number;
  totalWidth: number;
};

const DEFAULT_OPTIONS: Required<RenderBubbleOptions> = {
  maxWidth: 780,
  fontSize: 24,
  fontFamily: '"Yu Gothic UI", "Meiryo", sans-serif',
  lineHeight: 1.4,
  paddingX: 28,
  paddingY: 18,
  radius: 20,
  bubbleColor: "#2f2f2f",
  textColor: "",
};

const QUOTE_INDENT = 18;
const QUOTE_BAR_WIDTH = 4;
const QUOTE_BAR_COLOR = "rgba(255, 255, 255, 0.24)";
const LINK_COLOR = "#9ecbff";
const CODE_BACKGROUND = "rgba(255, 255, 255, 0.1)";
const CODE_BLOCK_BACKGROUND = "rgba(0, 0, 0, 0.22)";
const MUTED_TEXT = "rgba(255, 255, 255, 0.82)";
const SEPARATOR_COLOR = "rgba(255, 255, 255, 0.12)";
const MONO_FONT = '"Cascadia Code", "SFMono-Regular", Consolas, monospace';

export async function renderBubbleToPng(
  text: string,
  options: RenderBubbleOptions = {},
): Promise<RenderedBubble> {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const bubbleColor = normalizeHexColor(resolved.bubbleColor);
  const textColor = resolved.textColor.trim().length > 0
    ? normalizeHexColor(resolved.textColor)
    : getReadableTextColor(bubbleColor);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas 2D context could not be created.");
  }

  const normalized = normalizeText(text);
  const maxTextWidth = resolved.maxWidth - resolved.paddingX * 2;
  const baseStyle = createBaseStyle({
    ...resolved,
    bubbleColor,
    textColor,
  });
  const tokens = marked.lexer(normalized, {
    breaks: true,
    gfm: true,
  });

  const blocks = buildBlocks(ctx, tokens as MarkdownBlockToken[], maxTextWidth, baseStyle);
  if (blocks.length === 0) {
    blocks.push(
      createTextBlock(ctx, [segment("", baseStyle)], maxTextWidth, 0, {
        marginBottom: 0,
      }),
    );
  }

  const contentWidth = Math.max(...blocks.map((block) => block.totalWidth), 0);
  const contentHeight = blocks.reduce((sum, block) => sum + block.totalHeight, 0);
  const baseLineHeight = baseStyle.fontSize * baseStyle.lineHeight;
  const bubbleWidth = Math.ceil(
    Math.min(
      resolved.maxWidth,
      Math.max(contentWidth + resolved.paddingX * 2, resolved.paddingX * 2 + 24),
    ),
  );
  const bubbleHeight = Math.ceil(
    Math.max(contentHeight + resolved.paddingY * 2, resolved.paddingY * 2 + baseLineHeight),
  );

  canvas.width = bubbleWidth;
  canvas.height = bubbleHeight;

  ctx.clearRect(0, 0, bubbleWidth, bubbleHeight);
  ctx.textBaseline = "top";
  ctx.fillStyle = bubbleColor;
  drawRoundedRect(ctx, 0, 0, bubbleWidth, bubbleHeight, resolved.radius);
  ctx.fill();

  let currentY = resolved.paddingY;
  for (const block of blocks) {
    drawBlock(ctx, block, resolved.paddingX, currentY);
    currentY += block.totalHeight;
  }

  const blob = await canvasToBlob(canvas);

  return {
    blob,
    bubbleColor,
    textColor,
    width: bubbleWidth,
    height: bubbleHeight,
  };
}

type MarkdownBlockToken = {
  depth?: number;
  items?: MarkdownListItemToken[];
  ordered?: boolean;
  raw?: string;
  start?: number;
  text?: string;
  tokens?: MarkdownBlockToken[];
  type: string;
};

type MarkdownListItemToken = {
  text?: string;
  tokens?: MarkdownBlockToken[];
};

function buildBlocks(
  ctx: CanvasRenderingContext2D,
  tokens: MarkdownBlockToken[],
  maxTextWidth: number,
  baseStyle: TextStyle,
  quoteDepth = 0,
): LayoutBlock[] {
  const blocks: LayoutBlock[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "space":
        break;
      case "paragraph": {
        blocks.push(
          createTextBlock(
            ctx,
            inlineTokensToSegments(token.tokens ?? [], baseStyle),
            maxTextWidth,
            quoteDepth,
            { marginBottom: 14 },
          ),
        );
        break;
      }
      case "heading": {
        const headingStyle = {
          ...baseStyle,
          fontSize: headingFontSize(token.depth ?? 1, baseStyle.fontSize),
          fontWeight: 800,
          lineHeight: 1.25,
        };
        blocks.push(
          createTextBlock(
            ctx,
            inlineTokensToSegments(token.tokens ?? [], headingStyle),
            maxTextWidth,
            quoteDepth,
            { marginBottom: 16 },
          ),
        );
        break;
      }
      case "blockquote": {
        blocks.push(...buildBlocks(ctx, token.tokens ?? [], maxTextWidth, baseStyle, quoteDepth + 1));
        break;
      }
      case "list": {
        const start = token.start ?? 1;
        (token.items ?? []).forEach((item, index) => {
          const prefix = token.ordered ? `${start + index}. ` : "• ";
          const contentSegments = collectListItemSegments(item, baseStyle);
          blocks.push(
            createTextBlock(ctx, contentSegments, maxTextWidth, quoteDepth, {
              firstLinePrefix: [segment(prefix, { ...baseStyle, fontWeight: 800 })],
              hangingIndent: 26,
              marginBottom: 12,
            }),
          );
        });
        break;
      }
      case "code": {
        const codeText = token.text ?? "";
        blocks.push(createCodeBlock(ctx, codeText, maxTextWidth, quoteDepth, baseStyle));
        break;
      }
      case "hr": {
        blocks.push(createSeparatorBlock(maxTextWidth, quoteDepth));
        break;
      }
      default: {
        const fallback = token.text ?? token.raw ?? "";
        if (fallback.length > 0) {
          blocks.push(
            createTextBlock(
              ctx,
              [segment(fallback, baseStyle)],
              maxTextWidth,
              quoteDepth,
              { marginBottom: 14 },
            ),
          );
        }
      }
    }
  }

  if (blocks.length > 0) {
    blocks[blocks.length - 1].marginBottom = 0;
    blocks[blocks.length - 1].totalHeight =
      blocks[blocks.length - 1].contentHeight +
      blocks[blocks.length - 1].paddingY * 2;
  }

  return blocks;
}

function collectListItemSegments(item: MarkdownListItemToken, baseStyle: TextStyle): StyledSegment[] {
  const tokens = item.tokens ?? [];
  const paragraphToken = tokens.find((token) => token.type === "paragraph");
  if (paragraphToken?.tokens) {
    return inlineTokensToSegments(paragraphToken.tokens, baseStyle);
  }

  if (item.text) {
    return inlineTokensToSegments(marked.lexer(item.text, { breaks: true, gfm: true }) as MarkdownBlockToken[], baseStyle);
  }

  return [segment("", baseStyle)];
}

function createTextBlock(
  ctx: CanvasRenderingContext2D,
  segments: StyledSegment[],
  maxTextWidth: number,
  quoteDepth: number,
  options: {
    firstLinePrefix?: StyledSegment[];
    hangingIndent?: number;
    marginBottom: number;
  },
): LayoutBlock {
  const availableWidth = Math.max(120, maxTextWidth - quoteDepth * QUOTE_INDENT);
  const lines = wrapSegments(ctx, segments, availableWidth, {
    firstLinePrefix: options.firstLinePrefix ?? [],
    hangingIndent: options.hangingIndent ?? 0,
  });

  return finalizeBlock({
    backgroundColor: null,
    lines,
    marginBottom: options.marginBottom,
    paddingX: 0,
    paddingY: 0,
    quoteDepth,
    separator: false,
    separatorColor: SEPARATOR_COLOR,
    separatorThickness: 1,
  });
}

function createCodeBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxTextWidth: number,
  quoteDepth: number,
  baseStyle: TextStyle,
): LayoutBlock {
  const availableWidth = Math.max(120, maxTextWidth - quoteDepth * QUOTE_INDENT - 28);
  const codeStyle: TextStyle = {
    ...baseStyle,
    color: "#f4f4f4",
    fontFamily: MONO_FONT,
    fontSize: Math.max(18, baseStyle.fontSize - 2),
    fontWeight: 500,
    lineHeight: 1.45,
  };
  const lines = wrapSegments(ctx, [segment(text, codeStyle)], availableWidth, {});

  return finalizeBlock({
    backgroundColor: CODE_BLOCK_BACKGROUND,
    lines,
    marginBottom: 14,
    paddingX: 14,
    paddingY: 12,
    quoteDepth,
    separator: false,
    separatorColor: SEPARATOR_COLOR,
    separatorThickness: 1,
  });
}

function createSeparatorBlock(maxTextWidth: number, quoteDepth: number): LayoutBlock {
  return finalizeBlock({
    backgroundColor: null,
    lines: [],
    marginBottom: 14,
    paddingX: 0,
    paddingY: 8,
    quoteDepth,
    separator: true,
    separatorColor: SEPARATOR_COLOR,
    separatorThickness: 1,
    forcedContentWidth: Math.max(120, maxTextWidth - quoteDepth * QUOTE_INDENT),
    forcedContentHeight: 1,
  });
}

function finalizeBlock(input: {
  backgroundColor: string | null;
  forcedContentHeight?: number;
  forcedContentWidth?: number;
  lines: LayoutLine[];
  marginBottom: number;
  paddingX: number;
  paddingY: number;
  quoteDepth: number;
  separator: boolean;
  separatorColor: string;
  separatorThickness: number;
}): LayoutBlock {
  const measuredWidth =
    input.forcedContentWidth ??
    Math.max(0, ...input.lines.map((line) => line.indent + line.textWidth));
  const measuredHeight =
    input.forcedContentHeight ?? input.lines.reduce((sum, line) => sum + line.height, 0);
  const totalWidth =
    input.quoteDepth * QUOTE_INDENT + measuredWidth + input.paddingX * 2;
  const totalHeight = measuredHeight + input.paddingY * 2 + input.marginBottom;

  return {
    backgroundColor: input.backgroundColor,
    contentHeight: measuredHeight,
    contentWidth: measuredWidth,
    lines: input.lines,
    marginBottom: input.marginBottom,
    paddingX: input.paddingX,
    paddingY: input.paddingY,
    quoteDepth: input.quoteDepth,
    separator: input.separator,
    separatorColor: input.separatorColor,
    separatorThickness: input.separatorThickness,
    totalHeight,
    totalWidth,
  };
}

function wrapSegments(
  ctx: CanvasRenderingContext2D,
  segments: StyledSegment[],
  maxWidth: number,
  options: {
    firstLinePrefix?: StyledSegment[];
    hangingIndent?: number;
  },
): LayoutLine[] {
  const lines: LayoutLine[] = [];
  const hangingIndent = options.hangingIndent ?? 0;
  const prefix = options.firstLinePrefix ?? [];
  let currentLine = createLine(0);
  let isFirstLine = true;

  if (prefix.length > 0) {
    appendSegmentsToLine(ctx, currentLine, prefix);
  }

  for (const item of segments) {
    for (const char of Array.from(item.text)) {
      if (char === "\n") {
        pushLine(lines, currentLine, item.style);
        currentLine = createLine(hangingIndent);
        isFirstLine = false;
        continue;
      }

      const width = measureText(ctx, char, item.style);
      if (
        currentLine.indent + currentLine.textWidth + width > maxWidth &&
        currentLine.fragments.length > 0
      ) {
        pushLine(lines, currentLine, item.style);
        currentLine = createLine(isFirstLine ? hangingIndent : hangingIndent);
        isFirstLine = false;
      }

      appendFragment(currentLine, char, item.style, width);
    }
  }

  pushLine(lines, currentLine, segments[segments.length - 1]?.style ?? createDefaultStyle());
  return lines.length > 0 ? lines : [createLine(0)];
}

function createLine(indent: number): LayoutLine {
  return {
    fragments: [],
    height: 0,
    indent,
    textWidth: 0,
  };
}

function pushLine(lines: LayoutLine[], line: LayoutLine, fallbackStyle: TextStyle): void {
  if (line.height === 0) {
    line.height = fallbackStyle.fontSize * fallbackStyle.lineHeight;
  }
  lines.push(line);
}

function appendSegmentsToLine(
  ctx: CanvasRenderingContext2D,
  line: LayoutLine,
  segments: StyledSegment[],
): void {
  for (const item of segments) {
    for (const char of Array.from(item.text)) {
      appendFragment(line, char, item.style, measureText(ctx, char, item.style));
    }
  }
}

function appendFragment(
  line: LayoutLine,
  char: string,
  style: TextStyle,
  width: number,
): void {
  const last = line.fragments[line.fragments.length - 1];
  if (last && sameStyle(last.style, style)) {
    last.text += char;
    last.width += width;
  } else {
    line.fragments.push({
      style,
      text: char,
      width,
    });
  }

  line.textWidth += width;
  line.height = Math.max(line.height, style.fontSize * style.lineHeight);
}

function inlineTokensToSegments(tokens: MarkdownBlockToken[], inherited: TextStyle): StyledSegment[] {
  const segments: StyledSegment[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text":
      case "escape":
      case "html":
        if ((token.text ?? token.raw ?? "").length > 0) {
          segments.push(segment(token.text ?? token.raw ?? "", inherited));
        }
        break;
      case "strong":
        segments.push(
          ...inlineTokensToSegments(token.tokens ?? [], {
            ...inherited,
            fontWeight: 800,
          }),
        );
        break;
      case "em":
        segments.push(
          ...inlineTokensToSegments(token.tokens ?? [], {
            ...inherited,
            fontStyle: "italic",
          }),
        );
        break;
      case "codespan":
        segments.push(
          segment(token.text ?? "", {
            ...inherited,
            backgroundColor: CODE_BACKGROUND,
            fontFamily: MONO_FONT,
            fontSize: Math.max(18, inherited.fontSize - 2),
            fontWeight: 500,
          }),
        );
        break;
      case "del":
        segments.push(
          ...inlineTokensToSegments(token.tokens ?? [], {
            ...inherited,
            color: MUTED_TEXT,
            strike: true,
          }),
        );
        break;
      case "link":
        segments.push(
          ...inlineTokensToSegments(token.tokens ?? [], {
            ...inherited,
            color: LINK_COLOR,
            underline: true,
          }),
        );
        break;
      case "br":
        segments.push(segment("\n", inherited));
        break;
      case "image":
        segments.push(segment(`[image: ${token.text ?? "untitled"}]`, inherited));
        break;
      default:
        if ((token.text ?? token.raw ?? "").length > 0) {
          segments.push(segment(token.text ?? token.raw ?? "", inherited));
        }
    }
  }

  return coalesceSegments(segments);
}

function coalesceSegments(segments: StyledSegment[]): StyledSegment[] {
  const merged: StyledSegment[] = [];

  for (const item of segments) {
    const last = merged[merged.length - 1];
    if (last && sameStyle(last.style, item.style)) {
      last.text += item.text;
      continue;
    }

    merged.push({ ...item });
  }

  return merged;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: LayoutBlock,
  startX: number,
  startY: number,
): void {
  const quoteOffset = block.quoteDepth * QUOTE_INDENT;
  const contentX = startX + quoteOffset;
  const blockBodyHeight = block.contentHeight + block.paddingY * 2;

  if (block.quoteDepth > 0) {
    for (let index = 0; index < block.quoteDepth; index += 1) {
      const x = startX + index * QUOTE_INDENT + 3;
      ctx.fillStyle = QUOTE_BAR_COLOR;
      drawRoundedRect(ctx, x, startY + 2, QUOTE_BAR_WIDTH, Math.max(8, blockBodyHeight - 4), 2);
      ctx.fill();
    }
  }

  if (block.backgroundColor) {
    ctx.fillStyle = block.backgroundColor;
    drawRoundedRect(
      ctx,
      contentX,
      startY,
      block.contentWidth + block.paddingX * 2,
      blockBodyHeight,
      12,
    );
    ctx.fill();
  }

  if (block.separator) {
    ctx.fillStyle = block.separatorColor;
    const separatorY = startY + block.paddingY;
    drawRoundedRect(
      ctx,
      contentX,
      separatorY,
      block.contentWidth,
      block.separatorThickness,
      block.separatorThickness,
    );
    ctx.fill();
    return;
  }

  let currentY = startY + block.paddingY;
  for (const line of block.lines) {
    let cursorX = contentX + block.paddingX + line.indent;
    for (const fragment of line.fragments) {
      const textBoxHeight = fragment.style.fontSize * fragment.style.lineHeight;
      const fragmentY = currentY + (line.height - textBoxHeight) / 2;

      if (fragment.style.backgroundColor) {
        const backgroundTop = fragmentY + 2;
        const backgroundHeight = Math.max(fragment.style.fontSize + 4, textBoxHeight - 6);
        ctx.fillStyle = fragment.style.backgroundColor;
        drawRoundedRect(
          ctx,
          cursorX - 4,
          backgroundTop,
          fragment.width + 8,
          backgroundHeight,
          6,
        );
        ctx.fill();
      }

      ctx.font = getFontString(fragment.style);
      ctx.fillStyle = fragment.style.color;
      ctx.fillText(fragment.text, cursorX, fragmentY);

      if (fragment.style.underline) {
        drawTextDecoration(ctx, cursorX, fragmentY + fragment.style.fontSize + 2, fragment.width, 1.5, fragment.style.color);
      }

      if (fragment.style.strike) {
        drawTextDecoration(ctx, cursorX, fragmentY + fragment.style.fontSize * 0.58, fragment.width, 1.5, fragment.style.color);
      }

      cursorX += fragment.width;
    }

    currentY += line.height;
  }
}

function drawTextDecoration(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  thickness: number,
  color: string,
): void {
  ctx.fillStyle = color;
  drawRoundedRect(ctx, x, y, width, thickness, thickness);
  ctx.fill();
}

function createBaseStyle(options: Required<RenderBubbleOptions>): TextStyle {
  return {
    backgroundColor: null,
    color: options.textColor,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    fontStyle: "normal",
    fontWeight: 600,
    lineHeight: options.lineHeight,
    strike: false,
    underline: false,
  };
}

function createDefaultStyle(): TextStyle {
  return createBaseStyle(DEFAULT_OPTIONS);
}

function normalizeHexColor(color: string): string {
  const value = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value.toLowerCase();
  }

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return DEFAULT_OPTIONS.bubbleColor;
}

function getReadableTextColor(backgroundColor: string): string {
  const hex = normalizeHexColor(backgroundColor).slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness >= 160 ? "#111111" : "#ffffff";
}

function headingFontSize(depth: number, baseFontSize: number): number {
  switch (depth) {
    case 1:
      return baseFontSize + 14;
    case 2:
      return baseFontSize + 10;
    case 3:
      return baseFontSize + 6;
    case 4:
      return baseFontSize + 3;
    default:
      return baseFontSize;
  }
}

function segment(text: string, style: TextStyle): StyledSegment {
  return { style, text };
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sameStyle(left: TextStyle, right: TextStyle): boolean {
  return (
    left.backgroundColor === right.backgroundColor &&
    left.color === right.color &&
    left.fontFamily === right.fontFamily &&
    left.fontSize === right.fontSize &&
    left.fontStyle === right.fontStyle &&
    left.fontWeight === right.fontWeight &&
    left.lineHeight === right.lineHeight &&
    left.strike === right.strike &&
    left.underline === right.underline
  );
}

function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
): number {
  ctx.font = getFontString(style);
  return ctx.measureText(text).width;
}

function getFontString(style: TextStyle): string {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
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
