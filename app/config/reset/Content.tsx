"use client";

import { useCallback, useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { MdHistory, MdOutlineResetTv } from "react-icons/md";
import IconInfoHexagon from "../../../components/icon/icon-info-hexagon";
import LDRloader from "../../../components/common/LDRloader";
import { accessCookieName, categoryMap } from "../../data/branding";
import { getResetHistory, getResetPrograms, ProgramStatus, ResetHistory, ResetProgram, undoProgramReset } from "./func";
import ResetModal from "./Modal";
import { showMessage } from "../../../components/common/CusToast";

const stageLabels: Record<ProgramStatus, string> = {
  pending: "Pending",
  reporting: "Reporting",
  ongoing: "Ongoing",
  finished: "Judging",
  resulted: "Finalizing",
  judged: "Announce",
  announced: "Award",
};
const label = (value: ProgramStatus) => stageLabels[value];

export default function Content() {
  const [cookies] = useCookies([accessCookieName]);
  const isAdmin = cookies[accessCookieName]?.role === "admin";
  const [programs, setPrograms] = useState<ResetProgram[]>([]);
  const [history, setHistory] = useState<ResetHistory[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"programs" | "history">("programs");
  const [selected, setSelected] = useState<ResetProgram | null>(null);
  const [undoing, setUndoing] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true); setError("");
    try {
      const [programResult, historyResult] = await Promise.all([getResetPrograms(search), getResetHistory()]);
      setPrograms(programResult.data); setHistory(historyResult.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load reset data"); }
    finally { setLoading(false); }
  }, [isAdmin, search]);

  useEffect(() => { load(); }, [load]);

  async function undo(item: ResetHistory) {
    if (!window.confirm(`Undo the reset for ${item.program_name}? This restores its saved data.`)) return;
    setUndoing(item.id);
    try { await undoProgramReset(item.id); showMessage("Reset undone successfully", "success"); await load(); }
    catch (cause) { showMessage(cause instanceof Error ? cause.message : "Undo failed", "error"); }
    finally { setUndoing(null); }
  }

  if (!isAdmin) return <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-8 text-red-700"><IconInfoHexagon size="44" /><p>Only administrators can reset programs.</p></div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-gray-900">Program reset</h1><p className="text-sm text-gray-500">Reset a program safely and undo it before new work is recorded.</p></div>
      <div className="flex rounded-lg border border-gray-200 bg-white p-1"><button onClick={() => setTab("programs")} className={`rounded-md px-3 py-2 text-sm ${tab === "programs" ? "bg-primary-600 text-white" : "text-gray-600"}`}>Programs</button><button onClick={() => setTab("history")} className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm ${tab === "history" ? "bg-primary-600 text-white" : "text-gray-600"}`}><MdHistory /> History</button></div>
    </div>
    {tab === "programs" && <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4"><p className="font-medium">Programs beyond pending</p><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search program or category" className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" /></div>
      {loading ? <div className="flex h-52 items-center justify-center"><LDRloader /></div> : error ? <p className="p-6 text-red-600">{error}</p> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Program</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Current stage</th><th className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y divide-gray-100">{programs.map((program) => <tr key={program.id}><td className="px-5 py-4 font-medium text-gray-900">{program.name}</td><td className="px-5 py-4">{categoryMap[program.category]}</td><td className="px-5 py-4">{label(program.status)}</td><td className="px-5 py-4"><button onClick={() => setSelected(program)} className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"><MdOutlineResetTv /> Reset</button></td></tr>)}{!programs.length && <tr><td colSpan={4} className="p-8 text-center text-gray-500">No resettable programs found.</td></tr>}</tbody></table></div>}
    </div>}
    {tab === "history" && <div className="rounded-xl border border-gray-200 bg-white">{loading ? <div className="flex h-52 items-center justify-center"><LDRloader /></div> : error ? <p className="p-6 text-red-600">{error}</p> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">When / by</th><th className="px-5 py-3">Program</th><th className="px-5 py-3">Change</th><th className="px-5 py-3">Data reset</th><th className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y divide-gray-100">{history.map((item) => <tr key={item.id}><td className="px-5 py-4"><div>{new Date(item.created_at).toLocaleString()}</div><div className="text-xs text-gray-500">{item.actor_id}</div></td><td className="px-5 py-4 font-medium">{item.program_name}</td><td className="px-5 py-4">{label(item.source_status)} {"→"} {label(item.target_status)}</td><td className="px-5 py-4 text-xs text-gray-600">Codes removed: {item.summary.participantCodesCleared || 0} {" · "} Participants reopened: {item.summary.participantStatusesChanged || 0} {" · "} Marks removed: {item.summary.participantMarksCleared || 0} {" · "} Results removed: {item.summary.resultRecordsRemoved || 0} {" · "} Awards undone: {item.summary.resultStatusesCleared || 0}</td><td className="px-5 py-4">{item.undone_at ? <span className="text-gray-500">Undone</span> : item.undoAvailable ? <button disabled={undoing === item.id} onClick={() => undo(item)} className="rounded-lg border border-primary-600 px-3 py-2 text-primary-700 disabled:opacity-50">{undoing === item.id ? "Undoing..." : "Undo"}</button> : <span className="text-xs text-amber-700">Undo unavailable after newer reset</span>}</td></tr>)}{!history.length && <tr><td colSpan={5} className="p-8 text-center text-gray-500">No reset history yet.</td></tr>}</tbody></table></div>}</div>}
    {selected && <ResetModal program={selected} close={() => setSelected(null)} onComplete={async () => { setSelected(null); await load(); }} />}
  </div>;
}