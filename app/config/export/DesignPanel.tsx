"use client";

import { Input, InputNumber, Select } from "antd";
import { MdArrowDownward, MdArrowUpward, MdRefresh } from "react-icons/md";
import { ExportTableStyle, ExportTextAlign, ExportTitleLine } from "./types";

type Props = {
  titleLines: ExportTitleLine[];
  tableStyle: ExportTableStyle;
  onTitleChange: (id: string, patch: Partial<ExportTitleLine>) => void;
  onTitleMove: (id: string, direction: -1 | 1) => void;
  onTitleReset: () => void;
  onTableChange: (patch: Partial<ExportTableStyle>) => void;
  onTableReset: () => void;
};

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="block text-xs font-medium text-gray-600"><span className="mb-1 block">{label}</span><div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-10 cursor-pointer border-0 bg-transparent" /><span className="font-mono text-xs uppercase">{value}</span></div></label>
);

export default function DesignPanel({ titleLines, tableStyle, onTitleChange, onTitleMove, onTitleReset, onTableChange, onTableReset }: Props) {
  return <section className="grid gap-6 lg:grid-cols-2">
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-gray-900">5. Title design</h2><p className="mt-1 text-xs text-gray-500">The report title stays first; promoted common values can be reordered.</p></div><button onClick={onTitleReset} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold"><MdRefresh className="inline" /> Reset</button></div>
      <div className="space-y-3">{titleLines.map((line, index) => <div key={line.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3"><div className="mb-3 flex items-center gap-2"><span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{line.sourceColumnKey ? "Common value title" : "Report title"}</span>{line.sourceColumnKey && <><button aria-label={`Move ${line.text} up`} disabled={index === 1} onClick={() => onTitleMove(line.id, -1)} className="rounded p-1 disabled:opacity-25"><MdArrowUpward /></button><button aria-label={`Move ${line.text} down`} disabled={index === titleLines.length - 1} onClick={() => onTitleMove(line.id, 1)} className="rounded p-1 disabled:opacity-25"><MdArrowDownward /></button></>}</div><Input value={line.text} maxLength={120} onChange={(event) => onTitleChange(line.id, { text: event.target.value })} /><div className="mt-3 grid gap-3 sm:grid-cols-3"><ColorField label="Text color" value={line.color} onChange={(color) => onTitleChange(line.id, { color })} /><label className="text-xs font-medium text-gray-600"><span className="mb-1 block">Font size (pt)</span><InputNumber min={8} max={40} value={line.fontSize} onChange={(value) => onTitleChange(line.id, { fontSize: Number(value || 8) })} className="w-full" /></label><label className="text-xs font-medium text-gray-600"><span className="mb-1 block">Alignment</span><Select value={line.align} onChange={(align) => onTitleChange(line.id, { align: align as ExportTextAlign })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} className="w-full" /></label></div></div>)}</div>
    </article>
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-gray-900">6. Global table design</h2><p className="mt-1 text-xs text-gray-500">Column-specific values override these defaults.</p></div><button onClick={onTableReset} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold"><MdRefresh className="inline" /> Reset</button></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-gray-600"><span className="mb-1 block">Font size (pt)</span><InputNumber min={6} max={18} value={tableStyle.fontSize} onChange={(value) => onTableChange({ fontSize: Number(value || 6) })} className="w-full" /></label><label className="text-xs font-medium text-gray-600"><span className="mb-1 block">Minimum row height (pt)</span><InputNumber min={12} max={72} value={tableStyle.rowHeight} onChange={(value) => onTableChange({ rowHeight: Number(value || 12) })} className="w-full" /></label><ColorField label="Header background" value={tableStyle.headerBackground} onChange={(headerBackground) => onTableChange({ headerBackground })} /><ColorField label="Header text" value={tableStyle.headerText} onChange={(headerText) => onTableChange({ headerText })} /><ColorField label="Rows background" value={tableStyle.bodyBackground} onChange={(bodyBackground) => onTableChange({ bodyBackground })} /><ColorField label="Rows text" value={tableStyle.bodyText} onChange={(bodyText) => onTableChange({ bodyText })} /></div>
    </article>
  </section>;
}
