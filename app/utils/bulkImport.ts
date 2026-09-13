export type BulkImportMode = "validate" | "commit";

export interface BulkImportServerRow {
  row: number;
  success: boolean;
  normalized?: Record<string, unknown>;
  errors?: string[];
  message?: string;
  requestId?: string;
}

export interface BulkImportResponse {
  success: boolean;
  data?: {
    mode: BulkImportMode;
    total: number;
    inserted: number;
    skipped: number;
    rows: BulkImportServerRow[];
  };
  message?: string;
  requestId?: string;
}

export interface ParsedImportRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

const MAX_IMPORT_ROWS = 1_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function rowsToObjects(rows: unknown[][]): ParsedImportRow[] {
  if (rows.length < 2) throw new Error("The file does not contain any data rows.");
  const headers = rows[0].map(normalizeHeader);
  if (headers.some((header) => !header)) throw new Error("Every column must have a header.");
  if (new Set(headers).size !== headers.length) throw new Error("The file contains duplicate column headers.");

  const parsed = rows.slice(1).flatMap((row, index) => {
    const hasValue = row.some((value) => String(value ?? "").trim() !== "");
    if (!hasValue) return [];
    return [{
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""])),
    }];
  });

  if (parsed.length === 0) throw new Error("The file does not contain any data rows.");
  if (parsed.length > MAX_IMPORT_ROWS) throw new Error(`Imports are limited to ${MAX_IMPORT_ROWS} rows.`);
  return parsed;
}

function parseCsv(text: string): unknown[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error("The CSV file contains an unclosed quoted value.");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export async function parseImportFile(file: File): Promise<ParsedImportRow[]> {
  if (file.size > MAX_FILE_BYTES) throw new Error("The import file must be 5 MB or smaller.");
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") return rowsToObjects(parseCsv(await file.text()));
  if (extension !== "xlsx") throw new Error("Choose an .xlsx or .csv file.");

  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const rows = await readXlsxFile(file);
  return rowsToObjects(rows as unknown as unknown[][]);
}

export function valueFromRow(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
}

export function parseBooleanValue(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y", "group", "stage"].includes(normalized)) return 1;
  if (["0", "false", "no", "n", "individual", "offstage", "off-stage"].includes(normalized)) return 0;
  return null;
}

export async function requestBulkImport(
  resource: "students" | "programs",
  mode: BulkImportMode,
  rows: Record<string, unknown>[],
  idempotencyKey: string,
) {
  const response = await fetch(`/api/backend/${resource}/action.php?action=bulkUpload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, rows, idempotencyKey }),
  });
  const payload = (await response.json().catch(() => null)) as BulkImportResponse | null;
  const requestId = response.headers.get("x-request-id") || undefined;

  if (!payload) {
    throw new Error(`The import service returned an invalid response.${requestId ? ` Request ID: ${requestId}` : ""}`);
  }

  payload.requestId = requestId;
  const serverRows = payload.data?.rows;
  const firstRowError = serverRows?.flatMap((row) => row.errors || [row.message].filter(Boolean) as string[])[0];
  if (!response.ok && (!Array.isArray(serverRows) || serverRows.length === 0)) {
    const reason = payload.message || firstRowError || `Import request failed with status ${response.status}.`;
    throw new Error(`${reason}${requestId ? ` Request ID: ${requestId}` : ""}`);
  }

  return payload;
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsvTemplate(filename: string, rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] || {});
  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
