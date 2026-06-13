export type FontOption = {
  family: string;
  id: string;
  label: string;
  weight: number;
};

const FALLBACK_FONT_FAMILIES = [
  "Yu Gothic UI",
  "BIZ UDPGothic",
  "Yu Mincho",
  "Noto Sans JP",
  "Noto Serif JP",
  "Meiryo",
  "MS PGothic",
];

const FONT_WEIGHT_BY_TOKEN: Record<string, number> = {
  TH: 100,
  THIN: 100,
  XLT: 200,
  UL: 200,
  ULTRA_LIGHT: 200,
  EL: 200,
  EXTRA_LIGHT: 200,
  LT: 300,
  LIGHT: 300,
  L: 300,
  BOOK: 350,
  TEXT: 400,
  R: 400,
  REGULAR: 400,
  NORMAL: 400,
  ROMAN: 400,
  M: 500,
  MEDIUM: 500,
  MD: 500,
  DEMI: 600,
  DEMIBOLD: 600,
  SEMI: 600,
  SEMIBOLD: 600,
  SB: 600,
  DB: 600,
  DEMIBOLDITALIC: 600,
  B: 700,
  BD: 700,
  BOLD: 700,
  H: 800,
  HEAVY: 800,
  EB: 800,
  EXTRABOLD: 800,
  BLACK: 900,
  UB: 900,
  ULTRABOLD: 900,
};

export const DEFAULT_FONT_FAMILY = FALLBACK_FONT_FAMILIES[0];
export const DEFAULT_FONT_OPTION_ID = DEFAULT_FONT_FAMILY;

export async function loadLocalFontOptions(): Promise<FontOption[]> {
  if (typeof window.queryLocalFonts !== "function") {
    return [];
  }

  try {
    const fonts = await window.queryLocalFonts();
    return dedupeFontOptions(
      fonts
        .map((font) => toLocalFontOption(font))
        .filter((option): option is FontOption => option !== null),
    ).sort(compareFontOptions);
  } catch (error) {
    console.warn("Failed to query local fonts.", error);
    return [];
  }
}

export function toSystemFontOptions(fontFamilies: string[]): FontOption[] {
  return dedupeFontOptions(
    fontFamilies
      .map((fontName) => toSystemFontOption(fontName))
      .filter((option): option is FontOption => option !== null),
  ).sort(compareFontOptions);
}

export function toCssFontFamily(fontFamily: string): string {
  const value = fontFamily.trim();

  if (value.length === 0) {
    return `"${DEFAULT_FONT_FAMILY}"`;
  }

  if (value.includes(",") || value.includes('"') || value.includes("'")) {
    return value;
  }

  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function mergeFontOptions(...groups: FontOption[][]): FontOption[] {
  return dedupeFontOptions(groups.flat()).sort(compareFontOptions);
}

export function getFallbackFontOptions(): FontOption[] {
  return FALLBACK_FONT_FAMILIES.map((family) => ({
    family,
    id: family,
    label: family,
    weight: 400,
  }));
}

function compareFontOptions(left: FontOption, right: FontOption): number {
  return left.label.localeCompare(right.label, "ja");
}

function dedupeFontOptions(fonts: FontOption[]): FontOption[] {
  const merged: FontOption[] = [];
  const seen = new Set<string>();

  for (const font of fonts) {
    const family = font.family.trim();
    const label = font.label.trim();
    const id = font.id.trim();

    if (family.length === 0 || label.length === 0 || id.length === 0) {
      continue;
    }

    const normalized: FontOption = {
      family,
      id,
      label,
      weight: clampFontWeight(font.weight),
    };
    const key = normalized.id.toLocaleLowerCase("en-US");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(normalized);
  }

  return merged;
}

function toLocalFontOption(font: LocalFontData): FontOption | null {
  const family = font.family.trim();
  const label = selectFontLabel(font);
  if (family.length === 0 || label.length === 0) {
    return null;
  }

  const style = font.style.trim();
  const weight = inferFontWeight(style, label);
  const idSource = font.postscriptName.trim() || `${family}__${style}` || label;

  return {
    family,
    id: idSource,
    label,
    weight,
  };
}

function toSystemFontOption(fontName: string): FontOption | null {
  const label = fontName.trim();
  if (label.length === 0) {
    return null;
  }

  const styleToken = extractTrailingStyleToken(label);
  return {
    family: styleToken ? label.slice(0, -styleToken.length).trimEnd() : label,
    id: label,
    label,
    weight: inferFontWeight(styleToken ?? undefined, label),
  };
}

function selectFontLabel(font: LocalFontData): string {
  const fullName = font.fullName.trim();
  if (fullName.length > 0) {
    return fullName;
  }

  const family = font.family.trim();
  const style = font.style.trim();
  if (family.length > 0 && style.length > 0) {
    return `${family} ${style}`;
  }

  if (family.length > 0) {
    return family;
  }

  return font.postscriptName.trim();
}

function inferFontWeight(...parts: Array<string | undefined>): number {
  for (const part of parts) {
    if (!part) {
      continue;
    }

    const normalized = normalizeWeightToken(part);
    if (normalized in FONT_WEIGHT_BY_TOKEN) {
      return FONT_WEIGHT_BY_TOKEN[normalized];
    }

    for (const token of normalized.split(/[^A-Z0-9]+|_/)) {
      if (token in FONT_WEIGHT_BY_TOKEN) {
        return FONT_WEIGHT_BY_TOKEN[token];
      }
    }

    const trailing = extractTrailingStyleToken(part);
    if (trailing) {
      const trailingToken = normalizeWeightToken(trailing);
      if (trailingToken in FONT_WEIGHT_BY_TOKEN) {
        return FONT_WEIGHT_BY_TOKEN[trailingToken];
      }
    }
  }

  return 400;
}

function extractTrailingStyleToken(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/(?:^|[\s_-])([A-Za-z]{1,12})$/);
  if (!match) {
    return null;
  }

  const token = normalizeWeightToken(match[1]);
  return token in FONT_WEIGHT_BY_TOKEN ? match[1] : null;
}

function normalizeWeightToken(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
}

function clampFontWeight(weight: number): number {
  if (!Number.isFinite(weight)) {
    return 400;
  }

  return Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
}
