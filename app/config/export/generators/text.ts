import { displayValue, PreparedExport, spreadsheetSafe } from "./common";

const csvCell = (value: unknown) => {
  const safe = spreadsheetSafe(value as any);
  const string = String(safe).replace(/"/g, '""');
  return `"${string}"`;
};

export function csvBlob(exportData: PreparedExport) {
  const lines = [
    exportData.columns.map((column) => csvCell(column.label)).join(","),
    ...exportData.rows.map((row) => exportData.columns.map((column) => csvCell(row[column.key])).join(",")),
  ];
  return new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}

export function txtBlob(exportData: PreparedExport) {
  const clean = (value: unknown) => displayValue(value as any).replace(/[\t\r\n]+/g, " ");
  const lines = [
    exportData.columns.map((column) => clean(column.label)).join("\t"),
    ...exportData.rows.map((row) => exportData.columns.map((column) => clean(row[column.key])).join("\t")),
  ];
  return new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
}

const xmlEscape = (value: unknown) => displayValue(value as any)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function xmlBlob(exportData: PreparedExport) {
  const { metadata } = exportData.dataset;
  const rows = exportData.rows.map((row) => `  <row>\n${exportData.columns.map((column) => `    <field key="${xmlEscape(column.key)}" label="${xmlEscape(column.label)}">${xmlEscape(row[column.key])}</field>`).join("\n")}\n  </row>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<export report="${xmlEscape(metadata.reportId)}" generatedAt="${xmlEscape(metadata.generatedAt)}" generatedBy="${xmlEscape(metadata.generatedBy)}">\n${rows}\n</export>`;
  return new Blob([xml], { type: "application/xml;charset=utf-8" });
}

export function jsonBlob(exportData: PreparedExport) {
  const content = JSON.stringify({ metadata: exportData.dataset.metadata, columns: exportData.columns, rows: exportData.rows }, null, 2);
  return new Blob([content], { type: "application/json;charset=utf-8" });
}
