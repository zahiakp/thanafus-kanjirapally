"use client";

import { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiDownload, FiFileText, FiList, FiUploadCloud, FiX } from "react-icons/fi";
import { downloadCsvTemplate, parseImportFile, requestBulkImport } from "../../app/utils/bulkImport";

export interface ImportColumnDefinition {
  header: string;
  required: boolean;
  description: string;
}

export interface ImportPreviewColumn {
  key: string;
  label: string;
  render?: (value: unknown, row: ImportPreviewRow) => React.ReactNode;
}

export interface NormalizedImportRow {
  data: Record<string, unknown>;
  errors: string[];
}

export interface ImportPreviewRow extends NormalizedImportRow {
  rowNumber: number;
  valid: boolean;
}

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void | Promise<void>;
  resource: "students" | "programs";
  title: string;
  columns: ImportColumnDefinition[];
  previewColumns: ImportPreviewColumn[];
  sampleRows: Record<string, unknown>[];
  normalizeRow: (row: Record<string, unknown>, rowNumber: number) => NormalizedImportRow;
  duplicateKey: (row: Record<string, unknown>) => string;
}

type Phase = "upload" | "validating" | "preview" | "importing" | "done";

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : value ? [String(value)] : []))];
}

function makeIdempotencyKey(resource: string) {
  return `${resource}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export default function BulkImportModal({
  open,
  onClose,
  onImported,
  resource,
  title,
  columns,
  previewColumns,
  sampleRows,
  normalizeRow,
  duplicateKey,
}: BulkImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [resultRows, setResultRows] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, inserted: 0, skipped: 0 });
  const [error, setError] = useState("");
  const [showColumns, setShowColumns] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    if (!open) return;
    setPhase("upload");
    setFile(null);
    setRows([]);
    setResultRows([]);
    setSummary({ total: 0, inserted: 0, skipped: 0 });
    setError("");
    setShowColumns(false);
    setIdempotencyKey(makeIdempotencyKey(resource));
  }, [open, resource]);

  if (!open) return null;

  const selectFile = (selected: File | null) => {
    setFile(selected);
    setRows([]);
    setError("");
    setPhase("upload");
    setIdempotencyKey(makeIdempotencyKey(resource));
  };

  const validateFile = async () => {
    if (!file) return;
    setError("");
    setPhase("validating");
    try {
      const parsed = await parseImportFile(file);
      const normalized = parsed.map(({ values, rowNumber }) => ({ rowNumber, ...normalizeRow(values, rowNumber) }));

      const firstRows = new Map<string, number>();
      normalized.forEach((row) => {
        const key = duplicateKey(row.data).trim().toLowerCase();
        if (!key) return;
        const firstRow = firstRows.get(key);
        if (firstRow) row.errors.push(`Duplicates row ${firstRow} in this file.`);
        else firstRows.set(key, row.rowNumber);
      });

      const response = await requestBulkImport(
        resource,
        "validate",
        normalized.map((row) => row.data),
        `${idempotencyKey}-validate`,
      );
      const serverRows = response.data?.rows || [];
      const preview = normalized.map((row, index) => {
        const serverRow = serverRows[index];
        const errors = uniqueStrings([
          ...row.errors,
          ...(serverRow?.errors || []),
          serverRow?.success === false ? serverRow.message : "",
        ]);
        const data = { ...row.data, ...(serverRow?.normalized || {}) };
        return { ...row, data, errors, valid: errors.length === 0 && serverRow?.success !== false };
      });
      setRows(preview);
      setPhase("preview");
    } catch (validationError: any) {
      setError(validationError.message || "Unable to validate this file.");
      setPhase("upload");
    }
  };

  const commitImport = async () => {
    const validRows = rows.filter((row) => row.valid);
    if (!validRows.length) return;
    setError("");
    setPhase("importing");
    try {
      const response = await requestBulkImport(
        resource,
        "commit",
        validRows.map((row) => row.data),
        idempotencyKey,
      );
      const data = response.data;
      if (!response.success) {
        const commitRows = data?.rows || [];
        setRows((currentRows) => currentRows.map((row, index) => {
          if (!row.valid) return row;
          const serverRow = commitRows[index];
          const errors = uniqueStrings([
            ...row.errors,
            ...(serverRow?.errors || []),
            serverRow?.message || "",
          ]);
          return errors.length ? { ...row, errors, valid: false } : row;
        }));
const firstBackendError = commitRows.flatMap((row) => row?.errors || [row?.message].filter(Boolean))[0];
        const reason = response.message || firstBackendError || "The backend rejected this import. No rows were inserted.";
        setError(`${reason}${response.requestId ? ` Request ID: ${response.requestId}` : ""}`);
        setPhase("preview");
        return;
      }
      setSummary({
        total: data?.total ?? validRows.length,
        inserted: data?.inserted ?? 0,
        skipped: data?.skipped ?? 0,
      });
      setResultRows(data?.rows || []);
      setPhase("done");
      if (response.success) await onImported();
    } catch (commitError: any) {
      setError(commitError.message || "Import failed. No rows were inserted.");
      setPhase("preview");
    }
  };

  const validCount = rows.filter((row) => row.valid).length;
  const invalidCount = rows.length - validCount;
  const busy = phase === "validating" || phase === "importing";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={busy ? undefined : onClose} aria-label="Close import" />
        <section className={`relative z-10 flex max-h-[92vh] w-full flex-col rounded-3xl bg-white p-6 shadow-2xl md:p-8 ${phase === "preview" ? "max-w-6xl" : "max-w-xl"}`}>
          <button type="button" onClick={onClose} disabled={busy} className="absolute right-5 top-5 rounded-xl border border-gray-200 p-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40" aria-label="Close">
            <FiX />
          </button>

          <header className="mb-6 flex items-center gap-3 pr-12">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600"><FiFileText className="text-xl" /></span>
            <div><h2 className="text-xl font-bold text-gray-900">{title}</h2><p className="text-sm text-gray-500">Upload an Excel or CSV file, validate it, then import.</p></div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {(phase === "upload" || phase === "validating") && (
              <>
                <div
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files?.[0] || null); }}
                  onClick={() => !busy && inputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? "border-primary-500 bg-primary-50" : file ? "border-green-400 bg-green-50" : "border-gray-300 bg-gray-50 hover:border-primary-400"}`}
                >
                  <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(event) => selectFile(event.target.files?.[0] || null)} />
                  {file ? <FiCheckCircle className="mb-3 text-4xl text-green-600" /> : <FiUploadCloud className="mb-3 text-4xl text-gray-400" />}
                  <p className="font-semibold text-gray-800">{file?.name || "Click to upload or drag and drop"}</p>
                  <p className="mt-1 text-xs text-gray-500">{file ? `${(file.size / 1024).toFixed(1)} KB — click to change` : ".xlsx or .csv · maximum 5 MB / 1,000 rows"}</p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => downloadCsvTemplate(`${resource}-import-template.csv`, sampleRows)} className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"><FiDownload /> Download template</button>
                  <button type="button" onClick={() => setShowColumns(true)} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100"><FiList /> Supported columns</button>
                </div>

                {error && <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><FiAlertCircle className="mt-0.5 shrink-0" />{error}</div>}
                {file && <button type="button" onClick={() => void validateFile()} disabled={busy} className="mt-5 w-full rounded-xl bg-primary-600 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-60">{phase === "validating" ? "Validating with backend..." : "Preview and validate"}</button>}
              </>
            )}

            {phase === "preview" && (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-blue-700">{rows.length} rows</span>
                  <span className="rounded-lg bg-green-50 px-3 py-1.5 text-green-700">{validCount} valid</span>
                  {invalidCount > 0 && <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-700">{invalidCount} invalid</span>}
                  <span className="ml-auto max-w-64 truncate font-normal text-gray-500">{file?.name}</span>
                </div>
                <div className="max-h-[52vh] overflow-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-50"><tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">Status</th>{previewColumns.map((column) => <th key={column.key} className="px-4 py-3">{column.label}</th>)}<th className="px-4 py-3">Errors</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row) => <tr key={row.rowNumber} className={row.valid ? "" : "bg-red-50/40"}>
                        <td className="px-4 py-3 font-medium text-gray-500">{row.rowNumber}</td>
                        <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${row.valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{row.valid ? "Valid" : "Invalid"}</span></td>
                        {previewColumns.map((column) => <td key={column.key} className="max-w-56 px-4 py-3 text-gray-700">{column.render ? column.render(row.data[column.key], row) : String(row.data[column.key] ?? "—")}</td>)}
                        <td className="min-w-64 px-4 py-3 text-xs text-red-600">{row.errors.length ? row.errors.join(" · ") : "—"}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
                {invalidCount > 0 && <p className="mt-3 text-xs text-amber-700">Invalid rows will not be sent. The backend will commit all valid rows in one transaction.</p>}
                {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                <div className="mt-5 flex gap-3"><button type="button" onClick={() => setPhase("upload")} className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50">Back</button><button type="button" onClick={() => void commitImport()} disabled={!validCount} className="flex-1 rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40">Import {validCount} valid rows</button></div>
              </>
            )}

            {phase === "importing" && <div className="py-16 text-center"><span className="mx-auto mb-4 block h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" /><h3 className="font-semibold text-gray-900">Importing in one transaction...</h3><p className="mt-1 text-sm text-gray-500">Do not close this window.</p></div>}

            {phase === "done" && <div>
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5"><div className="flex items-center gap-3"><FiCheckCircle className="text-3xl text-green-600" /><div><h3 className="font-bold text-green-900">Import completed</h3><p className="text-sm text-green-700">{summary.inserted} inserted · {summary.skipped} skipped · {summary.total} total</p></div></div></div>
              {resultRows.length > 0 && <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{resultRows.map((row, index) => <div key={index} className={`rounded-lg px-3 py-2 text-xs ${row.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>Row {row.row}: {row.success ? "Imported" : (row.errors || [row.message]).filter(Boolean).join(" · ")}</div>)}</div>}
              <div className="mt-5 flex gap-3"><button type="button" onClick={() => selectFile(null)} className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50">Import another</button><button type="button" onClick={onClose} className="flex-1 rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-700">Close</button></div>
            </div>}
          </div>
        </section>
      </div>

      {showColumns && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"><button className="absolute inset-0 bg-black/40" onClick={() => setShowColumns(false)} aria-label="Close supported columns" /><section className="relative z-10 max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><button type="button" onClick={() => setShowColumns(false)} className="absolute right-4 top-4 rounded-lg border p-2"><FiX /></button><h3 className="text-xl font-bold">Supported columns</h3><p className="mt-1 text-sm text-gray-500">Column names are case-insensitive and spaces are ignored.</p><div className="mt-5 overflow-hidden rounded-xl border"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">Column</th><th className="px-4 py-3 text-left">Required</th><th className="px-4 py-3 text-left">Description</th></tr></thead><tbody className="divide-y">{columns.map((column) => <tr key={column.header}><td className="px-4 py-3"><code>{column.header}</code></td><td className="px-4 py-3">{column.required ? "Yes" : "No"}</td><td className="px-4 py-3 text-xs text-gray-600">{column.description}</td></tr>)}</tbody></table></div></section></div>}
    </>
  );
}
