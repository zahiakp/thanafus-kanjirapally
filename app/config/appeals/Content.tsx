"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { IoClose, IoSearchOutline } from "react-icons/io5";
import { MdGavel, MdOutlinePayments, MdReportProblem } from "react-icons/md";
import LDRloader from "../../../components/common/LDRloader";
import { showMessage } from "../../../components/common/CusToast";
import {
  Appeal, AppealParticipant, AppealProgram, AppealStatus, BondStatus,
  createAppeal, getAppeals, getEligibleParticipants, getEligiblePrograms, updateAppeal,
} from "./func";

const statusStyle: Record<AppealStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};
const bondStyle: Record<BondStatus, string> = {
  unpaid: "border-orange-200 bg-orange-50 text-orange-700",
  paid: "border-sky-200 bg-sky-50 text-sky-700",
  refunded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  forfeited: "border-red-200 bg-red-50 text-red-700",
};

function Badge({ value, type }: { value: AppealStatus | BondStatus; type: "appeal" | "bond" }) {
  const classes = type === "appeal" ? statusStyle[value as AppealStatus] : bondStyle[value as BondStatus];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}>{value}</span>;
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function DecisionModal({ appeal, decision, close, saved }: {
  appeal: Appeal; decision: "approved" | "rejected"; close: () => void; saved: () => Promise<void>;
}) {
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!remarks.trim()) return showMessage("Decision remarks are required.", "error");
    setSaving(true);
    try {
      const result = await updateAppeal("decide", { id: appeal.id, status: decision, remarks: remarks.trim() });
      showMessage(result.message, "success");
      await saved();
      close();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to decide this appeal.", "error");
    } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" role="dialog" aria-modal="true">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-gray-900">{decision === "approved" ? "Approve" : "Reject"} appeal #{appeal.id}</h2><p className="mt-1 text-sm text-gray-500">Your explanation remains on the appeal record.</p></div><button type="button" onClick={close} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><IoClose className="text-xl" /></button></div>
      <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm"><p className="font-semibold text-gray-900">{appeal.participantName}</p><p className="text-gray-500">{appeal.programName} · {appeal.targetCampusName}</p></div>
      <label htmlFor="decision-remarks" className="mt-5 block text-sm font-semibold text-gray-800">Decision remarks</label>
      <textarea id="decision-remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={2000} rows={5} className="mt-2 w-full rounded-xl border border-gray-300 p-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-100" placeholder="Explain the decision clearly..." autoFocus />
      <div className="mt-2 text-right text-xs text-gray-400">{remarks.length}/2000</div>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={close} className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700">Cancel</button><button disabled={saving || !remarks.trim()} className={`rounded-lg px-5 py-2.5 font-semibold text-white disabled:opacity-50 ${decision === "approved" ? "bg-emerald-600" : "bg-red-600"}`}>{saving ? "Saving..." : `${decision === "approved" ? "Approve" : "Reject"} appeal`}</button></div>
    </form>
  </div>;
}

function AppealActions({ appeal, run, decide, busy }: {
  appeal: Appeal;
  run: (action: "markPaid" | "settleBond", appeal: Appeal, bondStatus?: BondStatus) => void;
  decide: (appeal: Appeal, status: "approved" | "rejected") => void;
  busy: number | null;
}) {
  if (appeal.status === "pending" && appeal.bondStatus === "unpaid") return <button disabled={busy === appeal.id} onClick={() => run("markPaid", appeal)} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Mark bond paid</button>;
  if (appeal.status === "pending" && appeal.bondStatus === "paid") return <div className="flex flex-wrap gap-2"><button onClick={() => decide(appeal, "approved")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Approve</button><button onClick={() => decide(appeal, "rejected")} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Reject</button></div>;
  if (appeal.status === "approved" && appeal.bondStatus === "paid") return <button disabled={busy === appeal.id} onClick={() => run("settleBond", appeal, "refunded")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Mark refunded</button>;
  if (appeal.status === "rejected" && appeal.bondStatus === "paid") return <button disabled={busy === appeal.id} onClick={() => run("settleBond", appeal, "forfeited")} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Mark forfeited</button>;
  return <span className="text-xs font-medium text-gray-400">Complete</span>;
}

export default function AppealsContent({ role }: { role: "admin" | "campus" }) {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [bondAmount, setBondAmount] = useState(500);
  const [summary, setSummary] = useState({ pending: 0, unpaid: 0, approved: 0, rejected: 0 });
  const [filterOptions, setFilterOptions] = useState<{ programs: Array<{ id: number; name: string }>; campuses: Array<{ id: string; name: string }> }>({ programs: [], campuses: [] });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");
  const [bondStatus, setBondStatus] = useState("");
  const [programId, setProgramId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [programs, setPrograms] = useState<AppealProgram[]>([]);
  const [participants, setParticipants] = useState<AppealParticipant[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [decision, setDecision] = useState<{ appeal: Appeal; status: "approved" | "rejected" } | null>(null);
  const limit = 15;

  const loadAppeals = useCallback(async () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (bondStatus) params.set("bondStatus", bondStatus);
    if (programId) params.set("programId", programId);
    if (campusId) params.set("campusId", campusId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const result = await getAppeals(params);
      setAppeals(result.data); setTotal(result.total); setBondAmount(result.bondAmount);
      setSummary(result.summary); setFilterOptions(result.filters || { programs: [], campuses: [] });
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load appeals."); }
    finally { setLoading(false); }
  }, [page, search, status, bondStatus, programId, campusId, dateFrom, dateTo]);

  useEffect(() => { void loadAppeals(); }, [loadAppeals]);
  useEffect(() => {
    if (role !== "campus") return;
    void getEligiblePrograms().then((result) => { setPrograms(result.data); setBondAmount(result.bondAmount); }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load eligible programs."));
  }, [role]);

  async function changeProgram(value: string) {
    setSelectedProgram(value); setSelectedParticipant(""); setParticipants([]);
    if (!value) return;
    setLoadingParticipants(true);
    try { setParticipants(await getEligibleParticipants(Number(value))); }
    catch (loadError) { showMessage(loadError instanceof Error ? loadError.message : "Unable to load participants.", "error"); }
    finally { setLoadingParticipants(false); }
  }

  async function submitAppeal(event: FormEvent) {
    event.preventDefault();
    if (!selectedParticipant || !comment.trim()) return showMessage("Select an opponent and enter the allegation.", "error");
    setSubmitting(true);
    try {
      const result = await createAppeal(Number(selectedParticipant), comment.trim());
      showMessage(result.message, "success");
      setSelectedProgram(""); setSelectedParticipant(""); setParticipants([]); setComment(""); setPage(1);
      await loadAppeals();
    } catch (submitError) { showMessage(submitError instanceof Error ? submitError.message : "Unable to submit appeal.", "error"); }
    finally { setSubmitting(false); }
  }

  async function runAction(action: "markPaid" | "settleBond", appeal: Appeal, nextBondStatus?: BondStatus) {
    const label = action === "markPaid" ? "confirm receiving this bond" : `mark this bond ${nextBondStatus}`;
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    setBusy(appeal.id);
    try {
      const result = await updateAppeal(action, { id: appeal.id, ...(nextBondStatus ? { bondStatus: nextBondStatus } : {}) });
      showMessage(result.message, "success"); await loadAppeals();
    } catch (actionError) { showMessage(actionError instanceof Error ? actionError.message : "Unable to update appeal.", "error"); }
    finally { setBusy(null); }
  }

  const pages = Math.max(1, Math.ceil(total / limit));
  const selectedTarget = useMemo(() => participants.find((item) => String(item.id) === selectedParticipant), [participants, selectedParticipant]);

  return <main className="space-y-6">
    <header className="rounded-xl border border-gray-200 bg-white p-5"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-2xl text-primary-600"><MdGavel /></span><div><h1 className="text-xl font-bold text-gray-900">Appeals</h1><p className="text-sm text-gray-500">{role === "admin" ? "Review allegations, payments, decisions, and bond settlements." : "Raise an allegation against an opponent participant."}</p></div></div></header>

    {role === "campus" && <form onSubmit={submitAppeal} className="rounded-xl border border-gray-200 bg-white p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-gray-900">Raise an appeal</h2><p className="text-sm text-gray-500">Available from reporting until the result is announced.</p></div><div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">Bond: ₹{bondAmount}</div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold text-gray-700">Program<select value={selectedProgram} onChange={(event) => void changeProgram(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5"><option value="">Select an eligible program</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name} · {program.category}</option>)}</select></label><label className="text-sm font-semibold text-gray-700">Opponent participant<select value={selectedParticipant} onChange={(event) => setSelectedParticipant(event.target.value)} disabled={!selectedProgram || loadingParticipants} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 disabled:bg-gray-100"><option value="">{loadingParticipants ? "Loading..." : "Select opponent"}</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.participantName} · {participant.campusName}{participant.code ? ` · ${participant.code}` : ""}</option>)}</select></label></div>{selectedTarget && <div className="mt-4 rounded-lg border border-primary-100 bg-primary-50/60 p-3 text-sm"><strong>{selectedTarget.participantName}</strong><span className="text-gray-600"> · {selectedTarget.campusName}{selectedTarget.code ? ` · Code ${selectedTarget.code}` : ""}</span></div>}<label className="mt-4 block text-sm font-semibold text-gray-700">Allegation<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-gray-300 p-3" placeholder="Describe the alleged manipulation clearly..." /></label><div className="mt-2 flex items-center justify-between text-xs text-gray-400"><span>Payment is confirmed manually by Admin.</span><span>{comment.length}/2000</span></div><button disabled={submitting || !selectedParticipant || !comment.trim()} className="mt-5 rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{submitting ? "Submitting..." : "Submit appeal"}</button></form>}

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ label: "Pending", value: summary.pending, icon: <MdReportProblem /> }, { label: "Unpaid bonds", value: summary.unpaid, icon: <MdOutlinePayments /> }, { label: "Approved", value: summary.approved, icon: <MdGavel /> }, { label: "Rejected", value: summary.rejected, icon: <MdGavel /> }].map((item) => <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex items-center justify-between text-gray-500"><span className="text-sm">{item.label}</span><span className="text-xl text-primary-500">{item.icon}</span></div><p className="mt-2 text-2xl font-bold text-gray-900">{item.value}</p></div>)}</section>

    {role === "admin" && <section className="rounded-xl border border-gray-200 bg-white p-4"><form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }} className="grid gap-3 md:grid-cols-2 xl:grid-cols-7"><div className="relative"><IoSearchOutline className="absolute left-3 top-3 text-lg text-gray-400" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3" placeholder="Search appeals..." /></div><select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="rounded-lg border border-gray-300 px-3 py-2.5"><option value="">All decisions</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><select value={bondStatus} onChange={(event) => { setPage(1); setBondStatus(event.target.value); }} className="rounded-lg border border-gray-300 px-3 py-2.5"><option value="">All bond statuses</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="refunded">Refunded</option><option value="forfeited">Forfeited</option></select><select value={programId} onChange={(event) => { setPage(1); setProgramId(event.target.value); }} className="rounded-lg border border-gray-300 px-3 py-2.5"><option value="">All programs</option>{filterOptions.programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><select value={campusId} onChange={(event) => { setPage(1); setCampusId(event.target.value); }} className="rounded-lg border border-gray-300 px-3 py-2.5"><option value="">All filing teams</option>{filterOptions.campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select><label className="text-xs font-semibold text-gray-500">From<input type="date" value={dateFrom} onChange={(event) => { setPage(1); setDateFrom(event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label><label className="text-xs font-semibold text-gray-500">To<input type="date" value={dateTo} onChange={(event) => { setPage(1); setDateTo(event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label></form></section>}

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-200 p-4"><h2 className="font-bold text-gray-900">{role === "admin" ? "All appeals" : "Your appeals"}</h2><p className="text-sm text-gray-500">{total} appeal(s)</p></div>{loading ? <div className="flex min-h-60 items-center justify-center bg-primary-50/40"><LDRloader /></div> : error ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}<button onClick={() => void loadAppeals()} className="ml-3 font-bold underline">Try again</button></div> : appeals.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center"><MdGavel className="text-5xl text-gray-300" /><p className="mt-3 font-semibold text-gray-700">No appeals found</p><p className="text-sm text-gray-500">Appeals matching this view will appear here.</p></div> : <AppealRows appeals={appeals} role={role} bondAmount={bondAmount} busy={busy} runAction={runAction} decide={(appeal, nextStatus) => setDecision({ appeal, status: nextStatus })} />}</section>
    {total > limit && <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"><p className="text-sm text-gray-500">Page {page} of {pages}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div></div>}
    {decision && <DecisionModal appeal={decision.appeal} decision={decision.status} close={() => setDecision(null)} saved={loadAppeals} />}
  </main>;
}

function AppealRows({ appeals, role, bondAmount, busy, runAction, decide }: { appeals: Appeal[]; role: "admin" | "campus"; bondAmount: number; busy: number | null; runAction: (action: "markPaid" | "settleBond", appeal: Appeal, status?: BondStatus) => void; decide: (appeal: Appeal, status: "approved" | "rejected") => void }) {
  return <><div className="divide-y divide-gray-100 md:hidden">{appeals.map((appeal) => <article key={appeal.id} className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-primary-600">APPEAL #{appeal.id}</p><h3 className="truncate font-bold text-gray-900">{appeal.participantName}</h3><p className="text-xs text-gray-500">{appeal.targetCampusName} · {appeal.programName}</p></div><div className="flex shrink-0 flex-col items-end gap-1"><Badge value={appeal.status} type="appeal" /><Badge value={appeal.bondStatus} type="bond" /></div></div><div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{appeal.comment}</div><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-gray-400">Filed by</dt><dd className="font-semibold text-gray-700">{appeal.appellantCampusName}</dd></div><div><dt className="text-gray-400">Submitted</dt><dd className="font-semibold text-gray-700">{dateTime(appeal.createdAt)}</dd></div>{appeal.remarks && <div className="col-span-2"><dt className="text-gray-400">Admin remarks</dt><dd className="mt-1 text-gray-700">{appeal.remarks}</dd></div>}</dl>{role === "admin" && <AppealActions appeal={appeal} run={runAction} decide={decide} busy={busy} />}</article>)}</div><div className="hidden overflow-x-auto md:block"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{["Appeal", "Target participant", "Program / teams", "Allegation", "Bond", "Decision", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{appeals.map((appeal) => <tr key={appeal.id} className="align-top hover:bg-gray-50/60"><td className="whitespace-nowrap px-4 py-4"><p className="font-bold text-gray-900">#{appeal.id}</p><p className="mt-1 text-xs text-gray-500">{dateTime(appeal.createdAt)}</p></td><td className="px-4 py-4"><p className="font-semibold text-gray-900">{appeal.participantName}</p><p className="text-xs text-gray-500">Entry #{appeal.participantId}{appeal.participantCode ? ` · Code ${appeal.participantCode}` : ""}</p></td><td className="px-4 py-4"><p className="font-semibold text-gray-900">{appeal.programName}</p><p className="text-xs text-gray-500">Against: {appeal.targetCampusName}</p><p className="text-xs text-gray-500">Filed by: {appeal.appellantCampusName}</p></td><td className="max-w-xs px-4 py-4"><p className="line-clamp-3 text-sm text-gray-700">{appeal.comment}</p>{appeal.remarks && <p className="mt-2 text-xs text-gray-500"><strong>Remarks:</strong> {appeal.remarks}</p>}</td><td className="whitespace-nowrap px-4 py-4"><p className="mb-2 text-sm font-bold text-gray-900">₹{bondAmount}</p><Badge value={appeal.bondStatus} type="bond" /></td><td className="px-4 py-4"><Badge value={appeal.status} type="appeal" /></td><td className="px-4 py-4">{role === "admin" ? <AppealActions appeal={appeal} run={runAction} decide={decide} busy={busy} /> : <span className="text-xs text-gray-400">Admin managed</span>}</td></tr>)}</tbody></table></div></>;
}
