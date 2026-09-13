import { ExportColumnStyle, ExportTableStyle, ExportTitleLine } from "./types";

export const DEFAULT_TABLE_STYLE: ExportTableStyle = {
  fontSize: 8,
  rowHeight: 22,
  headerBackground: "#DB2777",
  headerText: "#FFFFFF",
  bodyBackground: "#FFFFFF",
  bodyText: "#222222",
};

export const baseTitleLine = (text: string): ExportTitleLine => ({
  id: "report-title",
  text,
  color: "#222222",
  fontSize: 13,
  align: "center",
});

export const promotedTitleLine = (sourceColumnKey: string, text: string): ExportTitleLine => ({
  id: `column-${sourceColumnKey}`,
  sourceColumnKey,
  text,
  color: "#222222",
  fontSize: 10,
  align: "center",
});

export function resolvedColumnStyle(globalStyle: ExportTableStyle, override?: ExportColumnStyle) {
  return { ...globalStyle, ...override };
}

export const isStyledFormat = (format: string) => format === "pdf" || format === "docx" || format === "xlsx";

export function cleanHex(value: string, fallback = "#000000") {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}

export function hexToRgb(value: string): [number, number, number] {
  const hex = cleanHex(value).slice(1);
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}

export const hexWithoutHash = (value: string) => cleanHex(value).slice(1);