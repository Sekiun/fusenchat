import { marked } from "marked";
import { toCssFontFamily } from "./fontUtils";
import type { WritingMode } from "../types";

export type RenderBubbleOptions = {
  bubbleColor?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  maxWidth?: number;
  paddingX?: number;
  paddingY?: number;
  radius?: number;
  textColor?: string;
  writingMode?: WritingMode;
};

export type RenderedBubble = {
  blob: Blob;
  bubbleColor: string;
  fontFamily: string;
  textColor: string;
  width: number;
  height: number;
  writingMode: WritingMode;
};

type TextStyle = {
  backgroundColor: string | null;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: "normal" | "italic";
  fontWeight: number;
  lineHeight: number;
  strike: boolean;
  underline: boolean;
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

type VerticalGlyph = {
  advance: number;
  boxLeft: number;
  boxWidth: number;
  char: string;
  drawHeight: number;
  style: TextStyle;
  width: number;
};

type VerticalColumn = {
  glyphs: VerticalGlyph[];
  height: number;
  width: number;
};

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

const DEFAULT_OPTIONS: Required<RenderBubbleOptions> = {
  bubbleColor: "#2f2f2f",
  fontFamily: "Yu Gothic UI",
  fontSize: 24,
  lineHeight: 1.4,
  maxWidth: 780,
  paddingX: 28,
  paddingY: 18,
  radius: 20,
  textColor: "",
  writingMode: "horizontal",
};

const QUOTE_INDENT = 18;
const QUOTE_BAR_COLOR = "rgba(255, 255, 255, 0.24)";
const QUOTE_BAR_WIDTH = 4;
const LINK_COLOR = "#9ecbff";
const CODE_BACKGROUND = "rgba(255, 255, 255, 0.1)";
const CODE_BLOCK_BACKGROUND = "rgba(0, 0, 0, 0.22)";
const MUTED_TEXT = "rgba(255, 255, 255, 0.82)";
const SEPARATOR_COLOR = "rgba(255, 255, 255, 0.12)";
const MONO_FONT = '"Cascadia Code", "SFMono-Regular", Consolas, monospace';
const VERTICAL_COLUMN_GAP = 8;
const VERTICAL_TRACKING_RATIO = 0.06;
const FONT_LOAD_SAMPLE = "縦書きテスト0123ABCあいうえお";
const ASCII_RUN_PATTERN = /[A-Za-z0-9]+/g;

export async function renderBubbleToPng(
  text: string,
  options: RenderBubbleOptions = {},
): Promise<RenderedBubble> {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const bubbleColor = normalizeHexColor(resolved.bubbleColor);
  const textColor =
    resolved.textColor.trim().length > 0
      ? normalizeHexColor(resolved.textColor)
      : getReadableTextColor(bubbleColor);
  const baseStyle = createBaseStyle({
    ...resolved,
    bubbleColor,
    textColor,
  });
  await ensureFontReady(baseStyle);

  if (resolved.writingMode === "vertical") {
    return renderVerticalBubble(text, resolved, bubbleColor, textColor, baseStyle);
  }

  return renderHorizontalBubble(text, resolved, bubbleColor, textColor, baseStyle);
}

async function renderHorizontalBubble(
  text: string,
  options: Required<RenderBubbleOptions>,
  bubbleColor: string,
  textColor: string,
  baseStyle: TextStyle,
): Promise<RenderedBubble> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas 2D context could not be created.");
  }

  const normalized = normalizeText(text);
  const maxTextWidth = options.maxWidth - options.paddingX * 2;
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
      options.maxWidth,
      Math.max(contentWidth + options.paddingX * 2, options.paddingX * 2 + 24),
    ),
  );
  const bubbleHeight = Math.ceil(
    Math.max(contentHeight + options.paddingY * 2, options.paddingY * 2 + baseLineHeight),
  );

  canvas.width = bubbleWidth;
  canvas.height = bubbleHeight;

  ctx.clearRect(0, 0, bubbleWidth, bubbleHeight);
  ctx.textBaseline = "top";
  ctx.fillStyle = bubbleColor;
  drawRoundedRect(ctx, 0, 0, bubbleWidth, bubbleHeight, options.radius);
  ctx.fill();

  let currentY = options.paddingY;
  for (const block of blocks) {
    drawHorizontalBlock(ctx, block, options.paddingX, currentY);
    currentY += block.totalHeight;
  }

  return {
    blob: await canvasToBlob(canvas),
    bubbleColor,
    fontFamily: options.fontFamily,
    textColor,
    width: bubbleWidth,
    height: bubbleHeight,
    writingMode: "horizontal",
  };
}

async function renderVerticalBubble(
  text: string,
  options: Required<RenderBubbleOptions>,
  bubbleColor: string,
  textColor: string,
  baseStyle: TextStyle,
): Promise<RenderedBubble> {
  const normalized = normalizeText(text);
  const maxContentHeight = Math.max(220, options.maxWidth - options.paddingY * 2);
  const html = normalizeVerticalHtml(markdownToHtml(normalized));
  const measurement = measureVerticalMarkup(html, baseStyle, textColor, maxContentHeight);
  const contentWidth = Math.max(1, Math.ceil(measurement.width));
  const contentHeight = Math.max(1, Math.ceil(measurement.height));
  const bubbleWidth = Math.ceil(contentWidth + options.paddingX * 2);
  const bubbleHeight = Math.ceil(contentHeight + options.paddingY * 2);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas 2D context could not be created.");
  }

  canvas.width = bubbleWidth;
  canvas.height = bubbleHeight;

  const svgMarkup = createVerticalBubbleSvg({
    backgroundColor: bubbleColor,
    contentHeight,
    contentWidth,
    fontFamily: baseStyle.fontFamily,
    fontSize: baseStyle.fontSize,
    height: bubbleHeight,
    xhtmlMarkup: serializeVerticalForeignObjectMarkup(
      html,
      getVerticalMarkupCss({
        fontFamily: baseStyle.fontFamily,
        fontSize: baseStyle.fontSize,
        lineHeight: baseStyle.lineHeight,
        maxContentHeight: contentHeight,
        textColor,
      }),
    ),
    lineHeight: baseStyle.lineHeight,
    paddingX: options.paddingX,
    paddingY: options.paddingY,
    radius: options.radius,
    textColor,
    width: bubbleWidth,
  });
  const image = await loadSvgImage(svgMarkup);

  ctx.clearRect(0, 0, bubbleWidth, bubbleHeight);
  ctx.drawImage(image, 0, 0);

  return {
    blob: await canvasToBlob(canvas),
    bubbleColor,
    fontFamily: options.fontFamily,
    textColor,
    width: bubbleWidth,
    height: bubbleHeight,
    writingMode: "vertical",
  };
}

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
      case "paragraph":
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
      case "blockquote":
        blocks.push(...buildBlocks(ctx, token.tokens ?? [], maxTextWidth, baseStyle, quoteDepth + 1));
        break;
      case "list": {
        const start = token.start ?? 1;
        (token.items ?? []).forEach((item, index) => {
          const prefix = token.ordered ? `${start + index}. ` : "- ";
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
      case "code":
        blocks.push(createCodeBlock(ctx, token.text ?? "", maxTextWidth, quoteDepth, baseStyle));
        break;
      case "hr":
        blocks.push(createSeparatorBlock(maxTextWidth, quoteDepth));
        break;
      default: {
        const fallback = token.text ?? token.raw ?? "";
        if (fallback.length > 0) {
          blocks.push(
            createTextBlock(ctx, [segment(fallback, baseStyle)], maxTextWidth, quoteDepth, {
              marginBottom: 14,
            }),
          );
        }
      }
    }
  }

  if (blocks.length > 0) {
    const last = blocks[blocks.length - 1];
    last.marginBottom = 0;
    last.totalHeight = last.contentHeight + last.paddingY * 2;
  }

  return blocks;
}

function buildVerticalSegments(tokens: MarkdownBlockToken[], baseStyle: TextStyle): StyledSegment[] {
  const segments: StyledSegment[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "space":
        break;
      case "paragraph":
        segments.push(...inlineTokensToSegments(token.tokens ?? [], baseStyle));
        segments.push(segment("\n", baseStyle));
        break;
      case "heading": {
        const headingStyle: TextStyle = {
          ...baseStyle,
          fontSize: headingFontSize(token.depth ?? 1, baseStyle.fontSize),
          fontWeight: 800,
          lineHeight: 1.25,
        };
        segments.push(...inlineTokensToSegments(token.tokens ?? [], headingStyle));
        segments.push(segment("\n", headingStyle));
        break;
      }
      case "blockquote":
        segments.push(...buildVerticalSegments(token.tokens ?? [], baseStyle));
        segments.push(segment("\n", baseStyle));
        break;
      case "list": {
        const start = token.start ?? 1;
        (token.items ?? []).forEach((item, index) => {
          const prefix = token.ordered ? `${start + index}. ` : "・";
          segments.push(segment(prefix, { ...baseStyle, fontWeight: 800 }));
          segments.push(...collectListItemSegments(item, baseStyle));
          segments.push(segment("\n", baseStyle));
        });
        break;
      }
      case "code": {
        const codeStyle: TextStyle = {
          ...baseStyle,
          color: baseStyle.color,
          fontFamily: MONO_FONT,
          fontSize: Math.max(18, baseStyle.fontSize - 2),
          fontWeight: 500,
        };
        segments.push(segment(token.text ?? "", codeStyle));
        segments.push(segment("\n", codeStyle));
        break;
      }
      case "hr":
        segments.push(segment("──", { ...baseStyle, fontWeight: 700 }));
        segments.push(segment("\n", baseStyle));
        break;
      default: {
        const fallback = token.text ?? token.raw ?? "";
        if (fallback.length > 0) {
          segments.push(segment(fallback, baseStyle));
          segments.push(segment("\n", baseStyle));
        }
      }
    }
  }

  return coalesceSegments(segments);
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

  return finalizeBlock({
    backgroundColor: CODE_BLOCK_BACKGROUND,
    lines: wrapSegments(ctx, [segment(text, codeStyle)], availableWidth, {}),
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
    forcedContentHeight: 1,
    forcedContentWidth: Math.max(120, maxTextWidth - quoteDepth * QUOTE_INDENT),
    lines: [],
    marginBottom: 14,
    paddingX: 0,
    paddingY: 8,
    quoteDepth,
    separator: true,
    separatorColor: SEPARATOR_COLOR,
    separatorThickness: 1,
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
  const totalWidth = input.quoteDepth * QUOTE_INDENT + measuredWidth + input.paddingX * 2;
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

function collectListItemSegments(item: MarkdownListItemToken, baseStyle: TextStyle): StyledSegment[] {
  const tokens = item.tokens ?? [];
  const paragraphToken = tokens.find((token) => token.type === "paragraph");
  if (paragraphToken?.tokens) {
    return inlineTokensToSegments(paragraphToken.tokens, baseStyle);
  }

  if (item.text) {
    return [segment(item.text, baseStyle)];
  }

  return [segment("", baseStyle)];
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

  if (prefix.length > 0) {
    appendSegmentsToLine(ctx, currentLine, prefix);
  }

  for (const item of segments) {
    for (const char of Array.from(item.text)) {
      if (char === "\n") {
        pushLine(lines, currentLine, item.style);
        currentLine = createLine(hangingIndent);
        continue;
      }

      const width = measureText(ctx, char, item.style);
      if (currentLine.indent + currentLine.textWidth + width > maxWidth && currentLine.fragments.length > 0) {
        pushLine(lines, currentLine, item.style);
        currentLine = createLine(hangingIndent);
      }

      appendFragment(currentLine, char, item.style, width);
    }
  }

  pushLine(lines, currentLine, segments[segments.length - 1]?.style ?? createDefaultStyle());
  return lines.length > 0 ? lines : [createLine(0)];
}

function createLine(indent: number): LayoutLine {
  return { fragments: [], height: 0, indent, textWidth: 0 };
}

function pushLine(lines: LayoutLine[], line: LayoutLine, fallbackStyle: TextStyle): void {
  if (line.height === 0) {
    line.height = fallbackStyle.fontSize * fallbackStyle.lineHeight;
  }
  lines.push(line);
}

function appendSegmentsToLine(ctx: CanvasRenderingContext2D, line: LayoutLine, segments: StyledSegment[]): void {
  for (const item of segments) {
    for (const char of Array.from(item.text)) {
      appendFragment(line, char, item.style, measureText(ctx, char, item.style));
    }
  }
}

function appendFragment(line: LayoutLine, char: string, style: TextStyle, width: number): void {
  const last = line.fragments[line.fragments.length - 1];

  if (last && sameStyle(last.style, style)) {
    last.text += char;
    last.width += width;
  } else {
    line.fragments.push({ style, text: char, width });
  }

  line.textWidth += width;
  line.height = Math.max(line.height, style.fontSize * style.lineHeight);
}

function buildVerticalColumns(
  ctx: CanvasRenderingContext2D,
  segments: StyledSegment[],
  maxColumnHeight: number,
  baseFontSize: number,
): VerticalColumn[] {
  const columns: VerticalColumn[] = [];
  let current = createVerticalColumn();
  let previousWasBreak = false;

  const flushCurrent = (): void => {
    if (current.glyphs.length > 0) {
      columns.push(current);
      current = createVerticalColumn();
    }
  };

  for (const item of segments) {
    for (const char of Array.from(item.text)) {
      if (char === "\n") {
        if (current.glyphs.length > 0) {
          flushCurrent();
          previousWasBreak = true;
        } else if (previousWasBreak) {
          columns.push(createVerticalSpacerColumn(baseFontSize));
        } else {
          previousWasBreak = true;
        }
        continue;
      }

      previousWasBreak = false;
      const metrics = measureGlyph(ctx, char, item.style);
      const advance = Math.ceil(
        Math.max(item.style.fontSize * 0.96, metrics.height + item.style.fontSize * VERTICAL_TRACKING_RATIO),
      );
      const width = Math.ceil(Math.max(item.style.fontSize, metrics.boxWidth));

      if (current.height + advance > maxColumnHeight && current.glyphs.length > 0) {
        flushCurrent();
      }

      current.glyphs.push({
        advance,
        boxLeft: metrics.left,
        boxWidth: metrics.boxWidth,
        char,
        drawHeight: metrics.height,
        style: item.style,
        width,
      });
      current.height += advance;
      current.width = Math.max(current.width, width + (item.style.backgroundColor ? 8 : 0));
    }
  }

  flushCurrent();
  return columns;
}

function createVerticalColumn(): VerticalColumn {
  return { glyphs: [], height: 0, width: 0 };
}

function createVerticalSpacerColumn(baseFontSize: number): VerticalColumn {
  return {
    glyphs: [],
    height: Math.ceil(baseFontSize * 1.6),
    width: Math.ceil(baseFontSize * 0.55),
  };
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
        segments.push(...inlineTokensToSegments(token.tokens ?? [], { ...inherited, fontWeight: 800 }));
        break;
      case "em":
        segments.push(...inlineTokensToSegments(token.tokens ?? [], { ...inherited, fontStyle: "italic" }));
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
        segments.push(...inlineTokensToSegments(token.tokens ?? [], { ...inherited, color: MUTED_TEXT, strike: true }));
        break;
      case "link":
        segments.push(...inlineTokensToSegments(token.tokens ?? [], { ...inherited, color: LINK_COLOR, underline: true }));
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
    } else {
      merged.push({ ...item });
    }
  }

  return merged;
}

function drawHorizontalBlock(ctx: CanvasRenderingContext2D, block: LayoutBlock, startX: number, startY: number): void {
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
    drawRoundedRect(ctx, contentX, startY, block.contentWidth + block.paddingX * 2, blockBodyHeight, 12);
    ctx.fill();
  }

  if (block.separator) {
    ctx.fillStyle = block.separatorColor;
    drawRoundedRect(ctx, contentX, startY + block.paddingY, block.contentWidth, block.separatorThickness, block.separatorThickness);
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
        drawRoundedRect(ctx, cursorX - 4, backgroundTop, fragment.width + 8, backgroundHeight, 6);
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

function drawVerticalColumns(
  ctx: CanvasRenderingContext2D,
  columns: VerticalColumn[],
  startX: number,
  startY: number,
): void {
  let currentRightX = startX;

  for (const column of columns) {
    const columnX = currentRightX - column.width;
    let currentY = startY;

    for (const glyph of column.glyphs) {
      if (glyph.style.backgroundColor) {
        const backgroundHeight = Math.max(glyph.advance - 4, glyph.style.fontSize + 4);
        ctx.fillStyle = glyph.style.backgroundColor;
        drawRoundedRect(ctx, columnX, currentY + 2, column.width, backgroundHeight, 6);
        ctx.fill();
      }

      ctx.font = getFontString(glyph.style);
      ctx.fillStyle = glyph.style.color;
      const targetLeft = columnX + (column.width - glyph.boxWidth) / 2;
      const drawX = targetLeft + glyph.boxLeft;
      const drawY = currentY + Math.max(0, (glyph.advance - glyph.drawHeight) / 2);
      ctx.fillText(glyph.char, drawX, drawY);

      currentY += glyph.advance;
    }

    currentRightX = columnX - VERTICAL_COLUMN_GAP;
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

function measureText(ctx: CanvasRenderingContext2D, text: string, style: TextStyle): number {
  ctx.font = getFontString(style);
  return ctx.measureText(text).width;
}

async function ensureFontReady(style: TextStyle): Promise<void> {
  if (!("fonts" in document)) {
    return;
  }

  try {
    await Promise.all([
      document.fonts.load(getFontString(style), FONT_LOAD_SAMPLE),
      document.fonts.ready,
    ]);
  } catch (error) {
    console.warn("Failed to wait for font load.", error);
  }
}

function measureGlyph(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
): { boxWidth: number; height: number; left: number; width: number } {
  ctx.font = getFontString(style);
  const metrics = ctx.measureText(text);
  const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const left = Number.isFinite(metrics.actualBoundingBoxLeft) ? metrics.actualBoundingBoxLeft : 0;
  const boxWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;

  return {
    boxWidth: boxWidth > 0 ? boxWidth : metrics.width > 0 ? metrics.width : style.fontSize,
    height: height > 0 ? height : style.fontSize,
    left,
    width: metrics.width > 0 ? metrics.width : style.fontSize,
  };
}

function getFontString(style: TextStyle): string {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${toCssFontFamily(style.fontFamily)}`;
}

function markdownToHtml(text: string): string {
  return marked.parse(text, {
    breaks: true,
    gfm: true,
  }) as string;
}

function normalizeVerticalHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  rewriteVerticalTextNodes(template.content);
  return template.innerHTML;
}

function rewriteVerticalTextNodes(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!(node instanceof Text)) {
      continue;
    }

    const parent = node.parentElement;
    if (!parent || parent.closest("pre, code, script, style")) {
      continue;
    }

    ASCII_RUN_PATTERN.lastIndex = 0;
    if (!ASCII_RUN_PATTERN.test(node.data)) {
      continue;
    }

    ASCII_RUN_PATTERN.lastIndex = 0;
    targets.push(node);
  }

  for (const textNode of targets) {
    replaceAsciiRuns(textNode);
  }
}

function replaceAsciiRuns(textNode: Text): void {
  const fragments = splitAsciiRuns(textNode.data);
  if (fragments.length <= 1) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const part of fragments) {
    if (part.kind === "text") {
      fragment.append(part.value);
      continue;
    }

    const span = document.createElement("span");
    span.textContent = part.value;
    span.className =
      /^\d{1,2}$/.test(part.value) ? "fusenchat-vertical-tcy" : "fusenchat-vertical-upright";
    fragment.append(span);
  }

  textNode.parentNode?.replaceChild(fragment, textNode);
}

function splitAsciiRuns(text: string): Array<{ kind: "run" | "text"; value: string }> {
  const parts: Array<{ kind: "run" | "text"; value: string }> = [];
  let lastIndex = 0;

  text.replace(ASCII_RUN_PATTERN, (value, offset: number) => {
    if (offset > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, offset) });
    }

    parts.push({ kind: "run", value });
    lastIndex = offset + value.length;
    return value;
  });

  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

function measureVerticalMarkup(
  html: string,
  style: TextStyle,
  textColor: string,
  maxContentHeight: number,
): { height: number; width: number } {
  const host = document.createElement("div");
  host.setAttribute(
    "style",
    [
      "position: fixed",
      "left: -100000px",
      "top: 0",
      "visibility: hidden",
      "pointer-events: none",
      "z-index: -1",
    ].join("; "),
  );

  const content = document.createElement("div");
  content.className = "fusenchat-vertical-measure";
  content.setAttribute(
    "style",
    getVerticalContentStyle(style, textColor, maxContentHeight),
  );
  content.innerHTML = html;
  host.appendChild(content);
  document.body.appendChild(host);

  const rect = content.getBoundingClientRect();
  document.body.removeChild(host);

  return {
    height: rect.height,
    width: rect.width,
  };
}

function createVerticalBubbleSvg(input: {
  backgroundColor: string;
  contentHeight: number;
  contentWidth: number;
  fontFamily: string;
  fontSize: number;
  height: number;
  lineHeight: number;
  paddingX: number;
  paddingY: number;
  radius: number;
  textColor: string;
  width: number;
  xhtmlMarkup: string;
}): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}">
      <rect width="${input.width}" height="${input.height}" rx="${input.radius}" ry="${input.radius}" fill="${escapeHtmlAttribute(input.backgroundColor)}" />
      <foreignObject x="${input.paddingX}" y="${input.paddingY}" width="${input.contentWidth}" height="${input.contentHeight}">
        ${input.xhtmlMarkup}
      </foreignObject>
    </svg>
  `;

  return svg.replace(/\n\s+/g, "");
}

async function loadSvgImage(svgMarkup: string): Promise<HTMLImageElement> {
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to decode SVG bubble image."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  });

  return image;
}

function getVerticalRootStyle(): string {
  return "width:100%;height:100%;margin:0;padding:0;overflow:hidden;background:transparent;";
}

function serializeVerticalForeignObjectMarkup(html: string, cssText: string): string {
  const xhtmlNs = "http://www.w3.org/1999/xhtml";
  const root = document.createElementNS(xhtmlNs, "div");
  root.setAttribute("style", getVerticalRootStyle());
  const style = document.createElementNS(xhtmlNs, "style");
  style.textContent = cssText;

  const content = document.createElementNS(xhtmlNs, "div");
  content.setAttribute("class", "fusenchat-vertical-markdown");

  const template = document.createElement("template");
  template.innerHTML = html;
  root.append(style);
  content.append(template.content.cloneNode(true));
  root.append(content);

  return new XMLSerializer().serializeToString(root);
}

function getVerticalContentStyle(
  style: TextStyle,
  textColor: string,
  maxContentHeight: number,
): string {
  return [
    getVerticalTypographyStyle(style, textColor, maxContentHeight),
    "display:inline-block",
  ].join("; ");
}

function getVerticalMarkupCss(input: {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  maxContentHeight: number;
  textColor: string;
}): string {
  const typography = getVerticalTypographyStyle(
    {
      backgroundColor: null,
      color: input.textColor,
      fontFamily: input.fontFamily,
      fontSize: input.fontSize,
      fontStyle: "normal",
      fontWeight: 600,
      lineHeight: input.lineHeight,
      strike: false,
      underline: false,
    },
    input.textColor,
    input.maxContentHeight,
  );

  return `
    .fusenchat-vertical-markdown {
      ${typography};
      display: inline-block;
    }
    .fusenchat-vertical-markdown * {
      box-sizing: border-box;
    }
    .fusenchat-vertical-markdown p,
    .fusenchat-vertical-markdown ul,
    .fusenchat-vertical-markdown ol,
    .fusenchat-vertical-markdown blockquote,
    .fusenchat-vertical-markdown pre,
    .fusenchat-vertical-markdown h1,
    .fusenchat-vertical-markdown h2,
    .fusenchat-vertical-markdown h3,
    .fusenchat-vertical-markdown h4,
    .fusenchat-vertical-markdown h5,
    .fusenchat-vertical-markdown h6 {
      margin: 0;
      margin-block-end: 0.18em;
    }
    .fusenchat-vertical-markdown h1 { font-size: ${input.fontSize + 14}px; line-height: 1.2; font-weight: 800; }
    .fusenchat-vertical-markdown h2 { font-size: ${input.fontSize + 10}px; line-height: 1.22; font-weight: 800; }
    .fusenchat-vertical-markdown h3 { font-size: ${input.fontSize + 6}px; line-height: 1.24; font-weight: 800; }
    .fusenchat-vertical-markdown h4 { font-size: ${input.fontSize + 3}px; line-height: 1.26; font-weight: 800; }
    .fusenchat-vertical-markdown ul,
    .fusenchat-vertical-markdown ol {
      padding: 0;
      padding-block-start: 0.2em;
      list-style-position: inside;
    }
    .fusenchat-vertical-markdown li {
      margin: 0;
      margin-block-end: 0.08em;
    }
    .fusenchat-vertical-markdown blockquote {
      padding-block-start: 0.18em;
      border-block-start: 4px solid rgba(255, 255, 255, 0.24);
      color: rgba(255, 255, 255, 0.92);
    }
    .fusenchat-vertical-markdown code {
      font-family: ${MONO_FONT};
      font-size: ${Math.max(18, input.fontSize - 2)}px;
      font-weight: 500;
      background: ${CODE_BACKGROUND};
      border-radius: 6px;
      padding: 0.15em 0.18em;
    }
    .fusenchat-vertical-markdown pre {
      font-family: ${MONO_FONT};
      font-size: ${Math.max(18, input.fontSize - 2)}px;
      font-weight: 500;
      line-height: 1.45;
      background: ${CODE_BLOCK_BACKGROUND};
      border-radius: 12px;
      padding: 0.75em 0.7em;
      white-space: pre-wrap;
    }
    .fusenchat-vertical-markdown pre code {
      background: transparent;
      padding: 0;
    }
    .fusenchat-vertical-markdown a {
      color: ${LINK_COLOR};
      text-decoration: underline;
      text-decoration-thickness: 1.5px;
    }
    .fusenchat-vertical-markdown del {
      color: ${MUTED_TEXT};
    }
    .fusenchat-vertical-markdown hr {
      border: 0;
      border-block-start: 1px solid ${SEPARATOR_COLOR};
      margin: 0;
      margin-block-end: 0.18em;
    }
    .fusenchat-vertical-markdown > :last-child {
      margin-block-end: 0;
    }
    .fusenchat-vertical-upright {
      text-orientation: upright;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .fusenchat-vertical-tcy {
      text-combine-upright: all;
      text-orientation: upright;
      direction: ltr;
      unicode-bidi: isolate;
    }
  `;
}

function getVerticalTypographyStyle(
  style: TextStyle,
  textColor: string,
  maxContentHeight: number,
): string {
  return [
    `color: ${textColor}`,
    `font-family: ${toCssFontFamily(style.fontFamily)}`,
    `font-size: ${style.fontSize}px`,
    `font-style: ${style.fontStyle}`,
    `font-weight: ${style.fontWeight}`,
    `line-height: ${style.lineHeight}`,
    "writing-mode: vertical-rl",
    "text-orientation: upright",
    "direction: ltr",
    "white-space: pre-wrap",
    "overflow-wrap: anywhere",
    "word-break: normal",
    "line-break: strict",
    "text-rendering: geometricPrecision",
    "font-feature-settings: 'vert' 1, 'vrt2' 1",
    `max-inline-size: ${maxContentHeight}px`,
    "inline-size: fit-content",
    "block-size: fit-content",
  ].join("; ");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
