"use client";

import { useEffect, useMemo, useState } from "react";
import { Checkbox, Select } from "antd";
import { MdDownload, MdFileDownload, MdFilterAlt, MdOutlinePreview } from "react-icons/md";
import { showMessage } from "../../../components/common/CusToast";
import { categoryMap } from "../../data/branding";
import { exportReportMap, exportReports, FilterKey } from "./catalog";
import { baseTitleLine, DEFAULT_TABLE_STYLE, isStyledFormat, promotedTitleLine, resolvedColumnStyle } from "./design";
import DesignPanel from "./DesignPanel";
import { generateAndDownload, PdfOrientation } from "./generators";
import HeaderConfigurator from "./HeaderConfigurator";
import { ExportColumn, ExportColumnStyle, ExportDataset, ExportFilters, ExportFormat, ExportOptionsResponse, ExportReportId, ExportTableStyle, ExportTitleLine } from "./types";

const formats: Array<{ value: ExportFormat; label: string; description: string }> = [
  { value: "pdf", label: "PDF", description: "Branded print-ready document" },
  { value: "xlsx", label: "Excel", description: "Styled editable workbook" },
  { value: "csv", label: "CSV", description: "Universal spreadsheet data" },
  { value: "docx", label: "Word", description: "Editable DOCX table" },
  { value: "txt", label: "Text", description: "Tab-delimited plain text" },
  { value: "xml", label: "XML", description: "Structured integration data" },
  { value: "json", label: "JSON", description: "Developer-friendly data" },
];

const emptyOptions: ExportOptionsResponse = { success: true, teams: [], programs: [], categories: [], participantStatuses: [], programStatuses: [] };
const reportGroups = ["Core lists", "Event operations", "Results and awards", "Review and audit"] as const;

function filterLabel(key: FilterKey) {
  return ({ search: "Search", team: "Team", category: "Category", program: "Program", status: "Status", resultStatus: "Result stage" } as Record<FilterKey, string>)[key];
}

export default function Content() {
  const [reportId, setReportId] = useState<ExportReportId>("teams");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [orientation, setOrientation] = useState<PdfOrientation>("auto");
  const [includeBrandHeader, setIncludeBrandHeader] = useState(true);
  const [filters, setFilters] = useState<ExportFilters>({ resultStatus: "all" });
  const [options, setOptions] = useState<ExportOptionsResponse>(emptyOptions);
  const [dataset, setDataset] = useState<ExportDataset | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [customColumns, setCustomColumns] = useState<ExportColumn[]>([]);
  const [customHeader, setCustomHeader] = useState("");
  const [tableStyle, setTableStyle] = useState<ExportTableStyle>({ ...DEFAULT_TABLE_STYLE });
  const [columnStyles, setColumnStyles] = useState<Record<string, ExportColumnStyle>>({});
  const [titleLines, setTitleLines] = useState<ExportTitleLine[]>([baseTitleLine("Team list")]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const report = exportReportMap.get(reportId)!;
  const reportOptions = reportGroups.map((group) => ({
    label: group,
    options: exportReports.filter((item) => item.group === group).map((item) => ({ value: item.id, label: item.name })),
  }));

  const resetColumns = (id = reportId) => {
    const definition = exportReportMap.get(id)!;
    setColumnOrder(definition.columns.slice().sort((a, b) => a.defaultOrder - b.defaultOrder).map((column) => column.key));
    setVisibleColumns(new Set(definition.columns.filter((column) => column.defaultVisible).map((column) => column.key)));
    setCustomColumns([]); setCustomHeader("");
    setColumnStyles({});
    setTitleLines([baseTitleLine(definition.name)]);
  };

  useEffect(() => {
    resetColumns(reportId);
    setFilters({ resultStatus: "all" });
    setDataset(null); setError(""); setLoading(false);
  }, [reportId]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/export/options", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Unable to load export filters");
        setOptions(result);
      })
      .catch((fetchError) => { if (!controller.signal.aborted) setError(fetchError.message); });
    return () => controller.abort();
  }, []);

  const loadPreview = async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ report: reportId });
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      const response = await fetch(`/api/export/data?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to load export data");
      setDataset(result);
    } catch (fetchError: any) {
      setDataset(null); setError(fetchError.message || "Unable to load export data");
    } finally {
      setLoading(false);
    }
  };

  const orderedColumns = useMemo(() => {
    const source = [...(dataset?.columns || report.columns), ...customColumns];
    const map = new Map(source.map((column) => [column.key, column]));
    return columnOrder.map((key) => map.get(key)).filter(Boolean) as typeof source;
  }, [columnOrder, customColumns, dataset, report.columns]);
  const selectedColumns = orderedColumns.filter((column) => visibleColumns.has(column.key));
  const styledFormat = isStyledFormat(format);
  const titleColumnKeys = new Set(titleLines.flatMap((line) => line.sourceColumnKey ? [line.sourceColumnKey] : []));
  const outputColumns = styledFormat ? selectedColumns.filter((column) => !titleColumnKeys.has(column.key)) : selectedColumns;
  const activeFilters = Object.entries(filters).filter(([, value]) => value && value !== "all");
  const activeFilterCount = activeFilters.length;

  const setFilter = (key: FilterKey, value: string) => {
    setFilters((current) => {
      const next: ExportFilters = { ...current, [key]: value || undefined };
      if (key === "category") {
        next.program = undefined;
        next.status = undefined;
        if (report.filters.includes("resultStatus")) next.resultStatus = "all";
      }
      if (key === "program") {
        next.status = undefined;
        if (report.filters.includes("resultStatus")) next.resultStatus = "all";
      }
      return next;
    });
    const invalidated = key === "category" ? new Set(["category", "programName"]) : key === "program" ? new Set(["programName"]) : key === "team" ? new Set(["teamName"]) : new Set<string>();
    if (invalidated.size) setTitleLines((current) => current.filter((line) => !line.sourceColumnKey || !invalidated.has(line.sourceColumnKey)));
    setDataset(null); setError("");
  };
  const moveColumn = (key: string, direction: -1 | 1) => setColumnOrder((current) => {
    const index = current.indexOf(key); const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const reorderColumn = (source: string, target: string) => {
    if (source === target) return;
    setColumnOrder((current) => {
      const next = current.filter((key) => key !== source);
      next.splice(next.indexOf(target), 0, source);
      return next;
    });
  };
  const toggleColumn = (key: string) => setVisibleColumns((current) => {
    const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  const addCustomHeader = () => {
    const label = customHeader.replace(/[\r\n\t]+/g, " ").trim().slice(0, 60);
    if (!label) return showMessage("Enter a custom header name", "error");
    const key = `custom_${Date.now().toString(36)}_${customColumns.length}`;
    const column: ExportColumn = { key, label, valueType: "blank", defaultVisible: true, defaultOrder: columnOrder.length };
    setCustomColumns((current) => [...current, column]);
    setColumnOrder((current) => [...current, key]);
    setVisibleColumns((current) => new Set(current).add(key));
    setCustomHeader("");
  };

  const removeCustomHeader = (key: string) => {
    setCustomColumns((current) => current.filter((column) => column.key !== key));
    setColumnOrder((current) => current.filter((columnKey) => columnKey !== key));
    setVisibleColumns((current) => { const next = new Set(current); next.delete(key); return next; });
    setColumnStyles((current) => { const next = { ...current }; delete next[key]; return next; });
  };

  const labelFor = (items: Array<{ value: string; label: string }>, value?: string) => items.find((item) => item.value === value)?.label || value || "";
  const titleValues: Record<string, string> = {
    ...(filters.category ? { category: labelFor(options.categories, filters.category) } : {}),
    ...(filters.program ? { programName: labelFor(options.programs, filters.program) } : {}),
    ...(filters.team ? { teamName: labelFor(options.teams, filters.team) } : {}),
  };
  const toggleTitle = (column: ExportColumn, defaultText: string) => setTitleLines((current) => current.some((line) => line.sourceColumnKey === column.key)
    ? current.filter((line) => line.sourceColumnKey !== column.key)
    : [...current, promotedTitleLine(column.key, defaultText)]);
  const changeTitle = (id: string, patch: Partial<ExportTitleLine>) => setTitleLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const moveTitle = (id: string, direction: -1 | 1) => setTitleLines((current) => {
    const index = current.findIndex((line) => line.id === id); const target = index + direction;
    if (index <= 0 || target <= 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const resetTitleDesign = () => setTitleLines((current) => [baseTitleLine(report.name), ...current.filter((line) => line.sourceColumnKey).map((line) => promotedTitleLine(line.sourceColumnKey!, titleValues[line.sourceColumnKey!] || line.text))]);
  const changeColumnStyle = (key: string, patch: ExportColumnStyle) => setColumnStyles((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  const handleDownload = async () => {
    if (!dataset || !dataset.rows.length) return showMessage("No rows are available to export", "error");
    if (!outputColumns.length) return showMessage("Select at least one header", "error");
    setDownloading(true);
    try {
      const exportDataset = { ...dataset, columns: [...dataset.columns, ...customColumns] };
      await generateAndDownload(exportDataset, outputColumns.map((column) => column.key), format, { pdfOrientation: orientation, includeBrandHeader, titleLines, tableStyle, columnStyles });
      showMessage(`${report.name} downloaded successfully`, "success");
    } catch (downloadError: any) {
      showMessage(downloadError.message || "Unable to generate export", "error");
    } finally { setDownloading(false); }
  };

  const programOptions = filters.category ? options.programs.filter((option) => option.category === filters.category) : [];
  const isFilterDisabled = (key: FilterKey) => {
    if (key === "program") return report.filters.includes("category") && !filters.category;
    if (key === "status" || key === "resultStatus") {
      if (report.filters.includes("program")) return !filters.program;
      if (report.filters.includes("category")) return !filters.category;
    }
    return false;
  };
  const dependencyPlaceholder = (key: FilterKey) => {
    if (key === "program" && !filters.category) return "Select category first";
    if ((key === "status" || key === "resultStatus") && report.filters.includes("program") && !filters.program) return "Select program first";
    if ((key === "status" || key === "resultStatus") && !filters.category) return "Select category first";
    return "All";
  };

  const statusOptions = reportId === "programs" || reportId === "award_progress"
    ? options.programStatuses
    : reportId === "awards"
      ? [{ value: "pending", label: "Pending" }, { value: "awarded", label: "Awarded" }]
      : reportId === "data_quality"
        ? [{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]
        : options.participantStatuses;

  const renderFilter = (key: FilterKey) => {
    if (key === "search") return <input value={filters.search || ""} onChange={(event) => setFilter(key, event.target.value)} placeholder="Search report rows..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500" />;
    const choices = key === "team" ? options.teams : key === "category" ? options.categories : key === "program" ? programOptions : key === "status" ? statusOptions : [{ value: "all", label: "All stages" }, { value: "judged", label: "Judged" }, { value: "announced", label: "Announced" }];
    const disabled = isFilterDisabled(key);
    const selected = disabled ? undefined : key === "resultStatus" ? filters.resultStatus || "all" : String(filters[key] || "");
    return <Select value={selected || undefined} onChange={(value) => setFilter(key, value || "")} disabled={disabled} allowClear={key !== "resultStatus"} showSearch optionFilterProp="label" placeholder={dependencyPlaceholder(key)} options={choices} className="w-full" size="large" />;
  };

  return <div className="mx-auto max-w-7xl space-y-6 py-5">
    <section className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-white p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700"><MdFileDownload /> Admin export center</div><h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Bulk export</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">Create complete competition reports with filters, selectable headers, live preview, and seven download formats.</p></div><div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right shadow-sm"><div className="text-2xl font-bold text-primary-700">{dataset?.total ?? 0}</div><div className="text-xs text-gray-500">matching rows</div></div></div>
    </section>

    <section className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
      <div className="space-y-6">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-gray-900">1. Choose report</h2><span className="text-xs text-gray-500">16 reports</span></div><Select value={reportId} onChange={(value) => setReportId(value as ExportReportId)} options={reportOptions} showSearch optionFilterProp="label" className="w-full" size="large" /><p className="mt-3 text-sm leading-6 text-gray-600">{report.description}</p></article>

        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold text-gray-900"><MdFilterAlt className="text-primary-600" /> 2. Filter records</h2>{activeFilterCount > 0 && <button onClick={() => { setFilters({ resultStatus: "all" }); setTitleLines((current) => current.filter((line) => !line.sourceColumnKey)); setDataset(null); setError(""); }} className="text-xs font-semibold text-primary-700">Clear filters</button>}</div><div className="grid gap-3 sm:grid-cols-2">{report.filters.map((key) => <label key={key} className={key === "search" ? "sm:col-span-2" : ""}><span className="mb-1 block text-xs font-medium text-gray-600">{filterLabel(key)}</span>{renderFilter(key)}</label>)}</div>{activeFilters.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-gray-500">Active filters:</span>{activeFilters.map(([key, value]) => <span key={key} className="rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-700">{filterLabel(key as FilterKey)}: {key === "category" ? categoryMap[String(value)] || String(value) : String(value)}</span>)}</div>}</article>

        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-gray-900">3. Choose format</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{formats.map((item) => <button key={item.value} onClick={() => setFormat(item.value)} className={`rounded-xl border p-3 text-left transition ${format === item.value ? "border-primary-500 bg-primary-50 ring-1 ring-primary-400" : "border-gray-200 hover:border-gray-300"}`}><div className="font-semibold text-gray-900">{item.label}</div><div className="mt-1 text-[11px] leading-4 text-gray-500">{item.description}</div></button>)}</div>{format === "pdf" && <div className="mt-4 space-y-3"><label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">PDF orientation</span><Select value={orientation} onChange={(value) => setOrientation(value as PdfOrientation)} options={[{ value: "auto", label: "Auto by header count" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} className="w-full" size="large" /></label><Checkbox checked={includeBrandHeader} onChange={(event) => setIncludeBrandHeader(event.target.checked)}>Include branded page header</Checkbox></div>}</article>
      </div>

      <HeaderConfigurator columns={orderedColumns} visibleColumns={visibleColumns} columnOrder={columnOrder} customHeader={customHeader} columnStyles={columnStyles} tableStyle={tableStyle} titleValues={titleValues} titleColumnKeys={titleColumnKeys} onCustomHeaderChange={setCustomHeader} onAddCustomHeader={addCustomHeader} onRemoveCustomHeader={removeCustomHeader} onToggleColumn={toggleColumn} onMoveColumn={moveColumn} onDropColumn={reorderColumn} onSelectAll={() => setVisibleColumns(new Set(columnOrder))} onDefaults={() => resetColumns()} onStyleChange={changeColumnStyle} onStyleReset={(key) => setColumnStyles((current) => { const next = { ...current }; delete next[key]; return next; })} onToggleTitle={toggleTitle} />
    </section>

    <DesignPanel titleLines={titleLines} tableStyle={tableStyle} onTitleChange={changeTitle} onTitleMove={moveTitle} onTitleReset={resetTitleDesign} onTableChange={(patch) => setTableStyle((current) => ({ ...current, ...patch }))} onTableReset={() => setTableStyle({ ...DEFAULT_TABLE_STYLE })} />

    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5"><div><h2 className="flex items-center gap-2 font-semibold text-gray-900"><MdOutlinePreview className="text-primary-600" /> Live preview</h2><p className="mt-1 text-xs text-gray-500">First 50 rows; download includes all {dataset?.total || 0} rows.{styledFormat && titleColumnKeys.size > 0 && " Common values marked as titles are removed from the styled table."}</p></div><div className="flex items-center gap-2"><div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{outputColumns.length} headers</div><button onClick={loadPreview} disabled={loading} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><MdOutlinePreview />{loading ? "Generating..." : "Generate preview"}</button></div></div>
      {loading ? <div className="flex h-48 items-center justify-center text-gray-500">Loading report...</div> : error ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div> : !dataset ? <div className="flex h-48 items-center justify-center text-gray-500">Choose the report and filters, then generate the preview.</div> : !dataset.rows.length ? <div className="flex h-48 items-center justify-center text-gray-500">No matching records.</div> : !outputColumns.length ? <div className="flex h-48 items-center justify-center text-amber-700">Select at least one header.</div> : <div>{styledFormat && <div className="space-y-3 border-b border-gray-200 px-5 py-4">{titleLines.map((line) => <div key={line.id} style={{ color: line.color, fontSize: `${line.fontSize}pt`, textAlign: line.align, fontWeight: line.sourceColumnKey ? 500 : 700 }}>{line.text}</div>)}</div>}<div className="max-h-[520px] overflow-auto"><table className="min-w-full"><thead className="sticky top-0"><tr>{outputColumns.map((column) => { const style = resolvedColumnStyle(tableStyle, columnStyles[column.key]); return <th key={column.key} className="whitespace-nowrap border border-gray-200 px-4 py-2 text-left" style={styledFormat ? { backgroundColor: style.headerBackground, color: style.headerText, fontSize: `${tableStyle.fontSize}pt`, height: `${tableStyle.rowHeight}pt` } : undefined}>{column.label}</th>; })}</tr></thead><tbody>{dataset.rows.slice(0, 50).map((row, index) => <tr key={index}>{outputColumns.map((column) => { const style = resolvedColumnStyle(tableStyle, columnStyles[column.key]); return <td key={column.key} className="max-w-xs border border-gray-200 px-4 py-2" style={styledFormat ? { backgroundColor: style.bodyBackground, color: style.bodyText, fontSize: `${tableStyle.fontSize}pt`, height: `${tableStyle.rowHeight}pt` } : undefined}>{String(row[column.key] ?? "")}</td>; })}</tr>)}</tbody></table></div>{styledFormat && <div className="border-t border-gray-200 bg-gray-50 px-5 py-4"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Metadata</h3><dl className="grid gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-2"><div><dt className="inline font-semibold">Generated: </dt><dd className="inline">{new Date(dataset.metadata.generatedAt).toLocaleString()}</dd></div><div><dt className="inline font-semibold">Generated by: </dt><dd className="inline">{dataset.metadata.generatedBy}</dd></div><div><dt className="inline font-semibold">Rows: </dt><dd className="inline">{dataset.total}</dd></div><div><dt className="inline font-semibold">Filters: </dt><dd className="inline">{Object.entries(dataset.metadata.filters).filter(([, value]) => value && value !== "all").map(([key, value]) => `${key}: ${value}`).join(" | ") || "All records"}</dd></div></dl></div>}</div>}
    </section>

    <div className="sticky bottom-4 z-10 flex justify-end"><button disabled={loading || downloading || !dataset?.rows.length || !outputColumns.length} onClick={handleDownload} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-pink-600 px-6 py-3 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"><MdDownload className="text-xl" />{downloading ? "Generating..." : `Download ${format.toUpperCase()}`}</button></div>
  </div>;
}
