"use client";

import { Input } from "antd";
import { useRef, useState } from "react";
import { MdAdd, MdArrowDownward, MdArrowUpward, MdCheckBox, MdDelete, MdDragIndicator, MdExpandLess, MdExpandMore, MdRefresh } from "react-icons/md";
import { ExportColumn, ExportColumnStyle, ExportTableStyle } from "./types";

type Props = {
  columns: ExportColumn[];
  visibleColumns: Set<string>;
  columnOrder: string[];
  customHeader: string;
  columnStyles: Record<string, ExportColumnStyle>;
  tableStyle: ExportTableStyle;
  titleValues: Record<string, string>;
  titleColumnKeys: Set<string>;
  onCustomHeaderChange: (value: string) => void;
  onAddCustomHeader: () => void;
  onRemoveCustomHeader: (key: string) => void;
  onToggleColumn: (key: string) => void;
  onMoveColumn: (key: string, direction: -1 | 1) => void;
  onDropColumn: (source: string, target: string) => void;
  onSelectAll: () => void;
  onDefaults: () => void;
  onStyleChange: (key: string, patch: ExportColumnStyle) => void;
  onStyleReset: (key: string) => void;
  onToggleTitle: (column: ExportColumn, defaultText: string) => void;
};

const ColorOverride = ({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (value: string) => void }) => <label className="text-[11px] font-medium text-gray-600"><span className="mb-1 block">{label}</span><div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1"><input type="color" value={value || fallback} onChange={(event) => onChange(event.target.value)} className="h-7 w-9 cursor-pointer border-0 bg-transparent" /><span className="font-mono text-[10px] uppercase">{value || "Global"}</span></div></label>;

export default function HeaderConfigurator(props: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const dragged = useRef<string | null>(null);
  const toggleExpanded = (key: string) => setExpanded((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
  return <article className="rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-200 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">4. Choose and style headers</h2><p className="mt-1 text-xs text-gray-500">Drag, reorder, promote common values, or override colors.</p></div><div className="flex gap-2"><button onClick={props.onSelectAll} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold"><MdCheckBox className="inline" /> Select all</button><button onClick={props.onDefaults} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold"><MdRefresh className="inline" /> Defaults</button></div></div></div><form onSubmit={(event) => { event.preventDefault(); props.onAddCustomHeader(); }} className="border-b border-gray-200 bg-gray-50 p-4"><div className="flex gap-2"><Input value={props.customHeader} onChange={(event) => props.onCustomHeaderChange(event.target.value)} maxLength={60} placeholder="Blank header name, e.g. Sign, Topic, Time" /><button type="submit" className="flex shrink-0 items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white"><MdAdd /> Add blank header</button></div></form><div className="max-h-[720px] space-y-2 overflow-auto p-4">{props.columns.map((column, index) => { const style = props.columnStyles[column.key] || {}; const titleValue = props.titleValues[column.key]; return <div key={column.key} draggable onDragStart={() => { dragged.current = column.key; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged.current) props.onDropColumn(dragged.current, column.key); dragged.current = null; }} className={`rounded-xl border ${props.visibleColumns.has(column.key) ? "border-primary-200 bg-primary-50/50" : "border-gray-200 bg-gray-50 opacity-70"}`}><div className="flex items-center gap-2 p-3"><MdDragIndicator className="cursor-grab text-xl text-gray-400" /><input type="checkbox" checked={props.visibleColumns.has(column.key)} onChange={() => props.onToggleColumn(column.key)} className="h-4 w-4 accent-primary-600" /><span className="min-w-0 flex-1 text-sm font-medium text-gray-800">{column.label}</span>{titleValue && <label className="flex items-center gap-1 text-xs font-medium text-primary-700"><input type="checkbox" checked={props.titleColumnKeys.has(column.key)} onChange={() => props.onToggleTitle(column, titleValue)} className="accent-primary-600" /> Use as title</label>}<button aria-label={`Style ${column.label}`} onClick={() => toggleExpanded(column.key)} className="rounded p-1 text-gray-500">{expanded.has(column.key) ? <MdExpandLess /> : <MdExpandMore />}</button><button aria-label={`Move ${column.label} up`} disabled={index === 0} onClick={() => props.onMoveColumn(column.key, -1)} className="rounded p-1 disabled:opacity-25"><MdArrowUpward /></button><button aria-label={`Move ${column.label} down`} disabled={index === props.columns.length - 1} onClick={() => props.onMoveColumn(column.key, 1)} className="rounded p-1 disabled:opacity-25"><MdArrowDownward /></button>{column.key.startsWith("custom_") && <button aria-label={`Remove ${column.label}`} onClick={() => props.onRemoveCustomHeader(column.key)} className="rounded p-1 text-red-500"><MdDelete /></button>}</div>{expanded.has(column.key) && <div className="border-t border-gray-200 bg-white p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-gray-600">Column color overrides</span><button onClick={() => props.onStyleReset(column.key)} className="text-xs font-semibold text-primary-700">Use global values</button></div><div className="grid gap-2 sm:grid-cols-2"><ColorOverride label="Header background" value={style.headerBackground} fallback={props.tableStyle.headerBackground} onChange={(headerBackground) => props.onStyleChange(column.key, { headerBackground })} /><ColorOverride label="Header text" value={style.headerText} fallback={props.tableStyle.headerText} onChange={(headerText) => props.onStyleChange(column.key, { headerText })} /><ColorOverride label="Rows background" value={style.bodyBackground} fallback={props.tableStyle.bodyBackground} onChange={(bodyBackground) => props.onStyleChange(column.key, { bodyBackground })} /><ColorOverride label="Rows text" value={style.bodyText} fallback={props.tableStyle.bodyText} onChange={(bodyText) => props.onStyleChange(column.key, { bodyText })} /></div></div>}</div>; })}</div></article>;
}
