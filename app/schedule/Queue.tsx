"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TbArrowDown, TbArrowUp, TbCalendar, TbClock, TbEdit, TbListDetails, TbMapPin, TbRefresh, TbSearch, TbX } from "react-icons/tb";
import type { ScheduleEntry, Venue } from "../utils/venueSchedule";
import { categoryMap } from "../data/branding";

type Program = { id: number; name: string; category: string; isStage: number; status: string };
type Schedule = { entries: ScheduleEntry[]; revision: number; venues: Venue[]; unscheduled: Program[] };
export async function scheduleRequest<T>(query = "", body?: object): Promise<T> {
  const response = await fetch("/api/schedule" + query, {
    cache: "no-store", ...(body && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Schedule request failed");
  return data;
}

const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";
const primary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-40";
const field = "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";
const panel = "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm";
const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  reporting: "bg-amber-50 text-amber-800",
  ongoing: "bg-blue-50 text-blue-800",
  finished: "bg-emerald-50 text-emerald-800",
};
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-IN", {
  weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(date + "T00:00:00Z"));

function Status({ status }: { status?: string }) {
  return status ? <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColors[status] ?? statusColors.pending}`}>{status}</span> : null;
}

type Assignment = { id: number; name: string; stage: boolean; source?: ScheduleEntry };
const canMove = (status?: string) => status === "pending" || status === "reporting";
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata" }).format(new Date());

export default function Queue({ view }: { view: "admin" | "staff" | "public" }) {
  const [data, setData] = useState<Schedule>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState("");
  const [venueFilter, setVenueFilter] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"scheduled" | "unscheduled">("scheduled");
  const [refreshing, setRefreshing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState({ venueId: "", date: "", time: "" });
  const [editing, setEditing] = useState<Assignment>();
  const query = view === "public" ? "?view=public" : "";
  const load = useCallback(async () => {
    const schedule = await scheduleRequest<Schedule>(query);
    setData(previous => previous && previous.revision > schedule.revision ? previous : schedule);
  }, [query]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => {
    if (view !== "public" && view !== "staff") return;
    const refresh = () => { if (document.visibilityState === "visible") void load().then(() => setError("")).catch(e => setError(e.message)); };
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load, view]);

  useEffect(() => {
    const element = dialog.current;
    if (editing && element && !element.open) element.showModal();
    if (!editing && element?.open) element.close();
  }, [editing]);

  async function refresh() {
    setRefreshing(true);
    setError("");
    try { await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setRefreshing(false); }
  }

  async function save(body: object) {
    setBusy(true);
    setError("");
    try {
      await scheduleRequest("", body);
      setEditing(undefined);
      await load();
    } catch (e) {
      setError((e as Error).message);
      if ("revision" in body && (e as Error).message.startsWith("The schedule changed")) setEditing(undefined);
      await load().catch(() => undefined);
    } finally { setBusy(false); }
  }
  function move(programId: number, target: { venueId: number; date: string; time?: string | null; position?: number } | null) {
    return save({ action: "move", revision: data?.revision, programId, destination: target });
  }
  const isAdmin = view === "admin";
  const isPublic = view === "public";
  const title = isPublic ? "Program Schedule" : "Schedule";
  const entries = data?.entries ?? [];
  const unscheduled = data?.unscheduled ?? [];
  const dates = [...new Set(entries.map(row => row.date))].sort();
  const eventsByVenue = new Map(entries.map(row => [row.venueId, row.venueName]));
  const visibleVenues = (data?.venues ?? [...eventsByVenue].map(([id, name]) => ({ id, name })))
    .slice().sort((a, b) => a.name.localeCompare(b.name));
  const needle = search.trim().toLowerCase();
  const matches = (row: { name: string; category: string }) =>
    (row.name + " " + (categoryMap[row.category] ?? row.category)).toLowerCase().includes(needle);
  const matchingUnscheduled = unscheduled.filter(matches);
  const boards = new Map<string, ScheduleEntry[]>();
  for (const row of entries) {
    if ((day && row.date !== day) || (venueFilter && String(row.venueId) !== venueFilter)) continue;
    const key = row.date + "/" + row.venueId;
    const queue = boards.get(key) ?? [];
    queue.push(row);
    boards.set(key, queue);
  }
  const visibleBoards = [...boards].filter(([, queue]) => queue.some(matches));
  const compatibleVenues = data?.venues?.filter(v => (v.type === "stage") === editing?.stage) ?? [];

  function openAssignment(id: number, name: string, stage: boolean, source?: ScheduleEntry) {
    const preferredVenue = data?.venues.find(v => String(v.id) === venueFilter && (v.type === "stage") === stage);
    setError("");
    setEditing({ id, name, stage, source });
    setDestination({ venueId: source ? String(source.venueId) : preferredVenue ? String(preferredVenue.id) : "",
      date: source?.date ?? (day || today()), time: source?.time ?? "" });
  }

  return <div className={isPublic ? "mx-auto max-w-7xl space-y-5 px-3 pb-6 pt-6 sm:px-6 sm:pt-10 lg:px-8" : "space-y-5"}>
    <header className={isPublic ? "flex flex-wrap items-center justify-between gap-4 pb-1" : `${panel} flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5`}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
          <TbCalendar size={23} />
        </div>
        <div>
          <h1 className={isPublic ? "text-2xl font-extrabold text-gray-900 sm:text-4xl" : "text-xl font-semibold text-gray-900"}>{title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">All times are in IST (Asia/Kolkata).</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {isAdmin && <Link href="/venues" className={button}><TbMapPin size={18} /> Manage venues</Link>}
        <button className={button} disabled={busy || refreshing} onClick={() => void refresh()}>
          <TbRefresh className={refreshing ? "animate-spin" : ""} size={18} /> Refresh
        </button>
      </div>
    </header>
    {error && !editing && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {!data && !error && <div className={`${panel} p-8 text-center text-sm text-gray-500`} role="status">Loading schedule…</div>}

    {data && <>
      <section className={panel} aria-label="Schedule filters">
        {isAdmin && <div className="flex flex-wrap gap-2 border-b border-gray-100 p-3 sm:px-4">
          <button type="button" aria-pressed={tab === "scheduled"} className={tab === "scheduled" ? primary : button} onClick={() => setTab("scheduled")}>Scheduled <span className="tabular-nums">({entries.length})</span></button>
          <button type="button" aria-pressed={tab === "unscheduled"} className={tab === "unscheduled" ? primary : button} onClick={() => setTab("unscheduled")}>Unscheduled <span className="tabular-nums">({unscheduled.length})</span></button>
        </div>}
        <div className={`grid gap-3 p-3 sm:p-4 ${tab === "scheduled" ? "xl:grid-cols-[minmax(0,1fr)_auto_auto]" : ""}`}>
          <label className="relative min-w-0">
            <span className="sr-only">Search programs or categories</span><TbSearch className="absolute left-3 top-3.5 text-gray-400" size={17} />
            <input type="search" className={field + " pl-9"} placeholder="Search programs or categories…" value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          {tab === "scheduled" && <>
            <select aria-label="Event date" className={field} value={day} onChange={e => setDay(e.target.value)}>
              <option value="">All dates</option>{dates.map(date => <option key={date} value={date}>{dateLabel(date)}</option>)}
            </select>
            <select aria-label="Venue" className={field} value={venueFilter} onChange={e => setVenueFilter(e.target.value)}>
              <option value="">All venues</option>{visibleVenues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </>}
        </div>
      </section>

      {tab === "scheduled" && (!visibleBoards.length ? <div className={`${panel} grid justify-items-center gap-3 p-8 text-center`}>
        <TbCalendar size={32} className="text-primary-600" />
        <h2 className="font-semibold text-gray-900">{entries.length ? "No matching programs" : "No programs scheduled"}</h2>
        {entries.length ? <button className={button} onClick={() => { setDay(""); setVenueFilter(""); setSearch(""); }}>Clear filters</button> :
          isAdmin && <button className={primary} onClick={() => setTab("unscheduled")}>View unscheduled programs</button>}
      </div> : <div className="grid gap-4">
        {visibleBoards.map(([key, queue]) => {
          let latestTime = "";
          return <section key={key} className={panel}>
            <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-50 text-primary-700"><TbMapPin size={19} /></span>
              <div className="mr-auto"><h2 className="font-semibold text-gray-900">{queue[0].venueName}</h2><p className="text-xs text-gray-600">{dateLabel(queue[0].date)}</p></div>
              <span className="text-sm text-gray-500">{queue.filter(matches).length}{needle ? ` of ${queue.length}` : ""} {queue.length === 1 ? "program" : "programs"}</span>
            </header>
            <ol className="divide-y divide-gray-100">
              {queue.map((row, index) => {
                const outOfOrder = row.time && row.time < latestTime;
                if (row.time && row.time > latestTime) latestTime = row.time;
                if (!matches(row)) return null;
                return <li key={row.programId} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3 px-4 py-3 sm:px-5 xl:flex xl:items-center">
                  <span aria-label={`Queue position ${row.position}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-sm font-bold tabular-nums text-primary-700">{row.position}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-semibold text-gray-900">{row.name}</h3>
                    <p className="text-sm text-gray-500">{categoryMap[row.category] ?? row.category}</p>
                    {isAdmin && outOfOrder && <p className="mt-1 text-xs font-medium text-amber-800">Planned time is out of queue order.</p>}
                  </div>
                  <div className="col-start-2 flex flex-wrap items-center gap-2 sm:min-w-36">
                    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-gray-600"><TbClock aria-hidden="true" size={16} />{row.time || "Time to be announced"}</span>
                    <Status status={row.status} />
                  </div>
                  {isAdmin && canMove(row.status) && <div className="col-start-2 flex flex-wrap gap-2">
                    <button className={button} title="Move up" aria-label={`Move ${row.name} up`} disabled={busy || index === 0 || !canMove(queue[index - 1]?.status)} onClick={() => void move(row.programId, { venueId: row.venueId, date: row.date, position: row.position - 1 })}><TbArrowUp size={17} /></button>
                    <button className={button} title="Move down" aria-label={`Move ${row.name} down`} disabled={busy || index === queue.length - 1 || !canMove(queue[index + 1]?.status)} onClick={() => void move(row.programId, { venueId: row.venueId, date: row.date, position: row.position + 1 })}><TbArrowDown size={17} /></button>
                    <button className={button} disabled={busy} onClick={() => openAssignment(row.programId, row.name, data.venues.find(v => v.id === row.venueId)?.type === "stage", row)}><TbEdit size={17} /> Edit</button>
                  </div>}
                </li>;
              })}
            </ol>
          </section>;
        })}
      </div>)}

      {isAdmin && tab === "unscheduled" && <section className={panel}>
        <header className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <TbListDetails className="text-primary-700" size={20} /><h2 className="font-semibold text-gray-900">Unscheduled programs</h2>
        </header>
        {!matchingUnscheduled.length && <p className="p-8 text-center text-sm text-gray-500">{unscheduled.length ? "No matching programs." : "All programs have a venue."}</p>}
        <ul className="divide-y divide-gray-100">
          {matchingUnscheduled.map(row => <li key={row.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="mr-auto min-w-0"><p className="break-words font-semibold text-gray-900">{row.name}</p><p className="text-sm text-gray-500">{categoryMap[row.category] ?? row.category} · {Number(row.isStage) > 0 ? "Stage" : "Off-stage"}</p></div>
            <Status status={row.status} />
            <button className={button} disabled={busy || !canMove(row.status)} onClick={() => openAssignment(row.id, row.name, Number(row.isStage) > 0)}>Assign</button>
          </li>)}
        </ul>
      </section>}
    </>}

    <dialog ref={dialog} aria-labelledby="assignment-title" className="m-auto w-11/12 max-w-lg rounded-2xl p-0 shadow-xl backdrop:bg-gray-950/45" onCancel={e => {
      e.preventDefault();
      if (!busy) setEditing(undefined);
    }}>
      {editing && <form className="space-y-4 p-5 sm:p-6" onSubmit={e => {
        e.preventDefault();
        const venueId = Number(destination.venueId);
        const source = editing.source;
        void move(editing.id, { venueId, date: destination.date, time: destination.time || null,
          position: source && source.venueId === venueId && source.date === destination.date ? source.position : undefined });
      }}>
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="assignment-title" className="text-lg font-semibold text-gray-900">{editing.source ? "Edit assignment" : "Assign program"}</h2><p className="mt-0.5 text-sm text-gray-500">{editing.name}</p></div>
          <button type="button" aria-label="Close assignment" className={button} disabled={busy} onClick={() => setEditing(undefined)}><TbX size={18} /></button>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Venue
          <select className={field} required value={destination.venueId} onChange={e => setDestination({ ...destination, venueId: e.target.value })}>
            <option value="">Select {editing.stage ? "a Stage" : "an Off-stage"} venue</option>
            {compatibleVenues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        {!compatibleVenues.length && <p className="text-sm text-gray-500">Add a compatible venue before assigning this program.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">Event date<input className={field} type="date" required value={destination.date} onChange={e => setDestination({ ...destination, date: e.target.value })} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">Planned time (optional)<input className={field} type="time" value={destination.time} onChange={e => setDestination({ ...destination, time: e.target.value })} /></label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4">
          {editing.source && <button type="button" className={button + " mr-auto text-red-700"} disabled={busy} onClick={() => void move(editing.id, null)}>Unschedule</button>}
          <button type="button" className={button} disabled={busy} onClick={() => setEditing(undefined)}>Cancel</button>
          <button className={primary} disabled={busy || !compatibleVenues.length}>{busy ? "Saving…" : "Save assignment"}</button>
        </div>
      </form>}
    </dialog>
  </div>;
}
