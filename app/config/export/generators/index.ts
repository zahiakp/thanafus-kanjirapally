import { ExportDataset, ExportFormat, ExportRenderOptions } from "../types";
import { downloadBlob, exportFilename, prepareExport } from "./common";
import { csvBlob, jsonBlob, txtBlob, xmlBlob } from "./text";
import type { PdfOrientation } from "./pdf";

export async function generateAndDownload(
  dataset: ExportDataset,
  columnKeys: string[],
  format: ExportFormat,
  renderOptions: ExportRenderOptions,
) {
  const prepared = prepareExport(dataset, columnKeys);
  let blob: Blob;
  if (format === "csv") blob = csvBlob(prepared);
  else if (format === "txt") blob = txtBlob(prepared);
  else if (format === "xml") blob = xmlBlob(prepared);
  else if (format === "json") blob = jsonBlob(prepared);
  else if (format === "pdf") blob = await (await import("./pdf")).pdfBlob(prepared, renderOptions);
  else if (format === "xlsx") blob = await (await import("./xlsx")).xlsxBlob(prepared, renderOptions);
  else blob = await (await import("./docx")).docxBlob(prepared, renderOptions);
  downloadBlob(blob, exportFilename(dataset, format));
}

export type { PdfOrientation } from "./pdf";
