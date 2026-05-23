const FALLBACK_FONT_FAMILIES = [
  "Yu Gothic UI",
  "BIZ UDPGothic",
  "Yu Mincho",
  "Noto Sans JP",
  "Noto Serif JP",
  "Meiryo",
  "MS PGothic",
];

export const DEFAULT_FONT_FAMILY = FALLBACK_FONT_FAMILIES[0];

export async function loadLocalFontFamilies(): Promise<string[]> {
  if (typeof window.queryLocalFonts !== "function") {
    return [];
  }

  try {
    const fonts = await window.queryLocalFonts();

    return fonts
      .map((font) => font.family.trim())
      .filter((family) => family.length > 0)
      .sort((left, right) => left.localeCompare(right, "ja"));
  } catch (error) {
    console.warn("Failed to query local fonts.", error);
    return [];
  }
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

export function mergeFontFamilies(...groups: string[][]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const family of group) {
      const normalized = family.trim();
      const key = normalized.toLocaleLowerCase("en-US");

      if (normalized.length === 0 || seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(normalized);
    }
  }

  return merged;
}

export function getFallbackFontFamilies(): string[] {
  return [...FALLBACK_FONT_FAMILIES];
}
