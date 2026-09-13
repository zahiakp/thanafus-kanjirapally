import { brandName } from "../../../data/branding";
import { ExportColumn, ExportDataset, ExportRow, ExportValue } from "../types";

export type PreparedExport = {
  dataset: ExportDataset;
  columns: ExportColumn[];
  rows: ExportRow[];
};

export function prepareExport(dataset: ExportDataset, columnKeys: string[]): PreparedExport {
  const columnMap = new Map(dataset.columns.map((column) => [column.key, column]));
  const columns = columnKeys.map((key) => columnMap.get(key)).filter(Boolean) as ExportColumn[];
  if (!columns.length) throw new Error("Select at least one header before exporting.");
  const rows = dataset.rows.map((row) => Object.fromEntries(columns.map((column) => [column.key, row[column.key] ?? ""])));
  return { dataset, columns, rows };
}

export function displayValue(value: ExportValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function spreadsheetSafe(value: ExportValue | undefined): string | number {
  if (typeof value === "number") return value;
  const displayed = displayValue(value);
  return /^[=+\-@\t\r]/.test(displayed) ? `'${displayed}` : displayed;
}

export function exportFilename(dataset: ExportDataset, extension: string) {
  const report = dataset.metadata.reportName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const date = dataset.metadata.generatedAt.slice(0, 10);
  return `${brandName}-${report}-${date}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function filterSummary(dataset: ExportDataset) {
  return Object.entries(dataset.metadata.filters)
    .filter(([, value]) => value && value !== "all")
    .map(([key, value]) => `${key}: ${value}`)
    .join(" | ") || "All records";
}
