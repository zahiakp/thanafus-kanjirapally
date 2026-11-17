"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import IconAction from "../../components/common/IconAction";
import { TbAlertCircle, TbArrowDown, TbArrowUp, TbCalendar, TbCheck, TbClock, TbEdit, TbHistory, TbListDetails, TbMapPin, TbRefresh, TbSearch, TbX } from "react-icons/tb";
import type { EventKind, ScheduleEntry, Venue } from "../utils/venueSchedule";
import { canReorderTimelineItem, reorderTimeline, timelineKey, timelineOrderAtGap } from "../utils/timelineReorder";
import { categoryMap } from "../data/branding";

type Program = { id: number; name: string; category: string; isStage: number; status: string };
type QueueSummary = { date: string; venueId: number; venueName: string; count: number };
type Schedule = {
  entries: ScheduleEntry[];
  revision?: number;
  venues: Venue[];
  unscheduled: Program[];
  queues: QueueSummary[];
  focus: QueueSummary | null;
  scheduledTotal: number;
  unscheduledTotal?: number;
};
export async function scheduleRequest<T>(query = "", body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/schedule" + query, {
    cache: "no-store", signal, ...(body && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
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

function timeLabel(time: string) {
  const [hour, minute] = time.split(":");
  const hours = Number(hour);
  return `${hours % 12 || 12}:${minute} ${hours < 12 ? "AM" : "PM"}`;
}

function Status({ status }: { status?: string }) {
  return status ? <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColors[status] ?? statusColors.pending}`}>{status}</span> : null;
}

type Assignment = { id: number; name: string; stage: boolean; source?: ScheduleEntry; event?: boolean };
type TimelineDraft = { order: string[]; entries: ScheduleEntry[] };
const eventStyles: Record<EventKind, string> = {
  launch: "bg-violet-50 text-violet-800",
  break: "bg-amber-50 text-amber-800",
  session: "bg-sky-50 text-sky-800",
};
const canMove = (status?: string) => status === "pending" || status === "reporting";
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata" }).format(new Date());

function timelineGapAtPointer(event: DragEvent<HTMLOListElement>) {
  if (!(event.target instanceof Element)) return null;
  const placeholder = event.target.closest<HTMLElement>("[data-timeline-gap]");
  if (placeholder) return Number(placeholder.dataset.timelineGap);
  const row = event.target.closest("li")?.querySelector<HTMLElement>("[data-timeline-row]");
  if (!row) return null;
  const { top, height } = row.getBoundingClientRect();
  return Number(row.dataset.timelineRow) + (event.clientY < top + height / 2 ? 0 : 1);
}

function TimelineDropGap({ index, height }: { index: number; height: number }) {
  return <div aria-hidden="true" data-timeline-gap={index} style={{ height }}
    className="relative overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none">
    <div className={`pointer-events-none absolute inset-x-4 inset-y-1.5 grid place-items-center rounded-lg bg-primary-50 text-xs font-medium leading-none text-primary-700 transition-opacity duration-200 motion-reduce:transition-none sm:inset-x-5 ${height ? "opacity-100" : "opacity-0"}`}>
      Drag here
    </div>
  </div>;
}

export default function Queue({ view }: { view: "admin" | "staff" | "public" }) {
  const [loaded, setLoaded] = useState<{ query: string; schedule: Schedule }>();
  const request = useRef<AbortController | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState("");
  const [venueFilter, setVenueFilter] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"scheduled" | "unscheduled">("scheduled");
  const [refreshing, setRefreshing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dragImage = useRef<HTMLCanvasElement>(null);
  const [destination, setDestination] = useState({ venueId: "", date: "", time: "", duration: 15 });
  const [eventKind, setEventKind] = useState<EventKind>("break");
  const [dragged, setDragged] = useState<{ key: string; gapHeight: number } | null>(null);
  const [dropGap, setDropGap] = useState<number | null>(null);
  const [draft, setDraft] = useState<TimelineDraft>();
  const [editing, setEditing] = useState<Assignment>();
  const params = new URLSearchParams({ tab });
  if (view === "public") params.set("view", "public");
  if (day) params.set("date", day);
  if (venueFilter) params.set("venueId", venueFilter);
  const query = "?" + params.toString();
  const data = loaded?.query === query ? loaded.schedule : undefined;
  const navigation = loaded?.schedule;
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const schedule = await scheduleRequest<Schedule>(query, undefined, controller.signal);
      if (!controller.signal.aborted) setLoaded({ query, schedule });
    } catch (e) {
      if (!controller.signal.aborted) throw e;
    }
  }, [query]);
  useEffect(() => {
    setError("");
    void load().catch(e => setError(e.message));
    return () => request.current?.abort();
  }, [load]);
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

  const hasDraft = Boolean(draft);
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = true; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDraft]);

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
  function move(programId: number, target: { venueId: number; date: string; time: string; duration: number } | null) {
    return save({ action: "move", revision: data?.revision, programId, destination: target });
  }
  const isAdmin = view === "admin";
  const isPublic = view === "public";
  const title = isPublic ? "Program Schedule" : "Schedule";
  const entries = draft?.entries ?? data?.entries ?? [];
  const unscheduled = data?.unscheduled ?? [];
  const dates = [...new Set(navigation?.queues.map(queue => queue.date) ?? [])];
  const activeDay = data?.focus?.date ?? (dates.includes(day) ? day : dates[0]);
  const stageTabs = navigation?.queues.filter(queue => queue.date === activeDay) ?? [];
  const activeVenue = data?.focus?.venueId ?? (stageTabs.some(stage => String(stage.venueId) === venueFilter) ? Number(venueFilter) : stageTabs[0]?.venueId);
  const needle = search.trim().toLowerCase();
  const matches = (row: { name: string; category: string }) =>
    (row.name + " " + (categoryMap[row.category] ?? row.category)).toLowerCase().includes(needle);
  const matchingUnscheduled = unscheduled.filter(matches);
  const boards = new Map<string, ScheduleEntry[]>();
  for (const row of entries) {
    const key = row.date + "/" + row.venueId;
    const queue = boards.get(key) ?? [];
    queue.push(row);
    boards.set(key, queue);
  }
  const visibleBoards = [...boards].filter(([, queue]) => queue.some(matches));
  const compatibleVenues = data?.venues?.filter(v => editing?.event || (v.type === "stage") === editing?.stage) ?? [];
  const canReorder = isAdmin && !busy && !refreshing && !needle;
  const editingBlocked = busy || refreshing || hasDraft || dragged !== null;

  function previewOrder(order: string[]) {
    if (!data) return;
    setError("");
    try {
      const preview = reorderTimeline(data.entries, order);
      setDraft(preview.some((row, index) => row !== data.entries[index]) ? { order, entries: preview } : undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function commitDraft() {
    if (!draft || !data?.focus) return;
    setBusy(true);
    setError("");
    try {
      await scheduleRequest("", {
        action: "reorder", revision: data.revision, date: data.focus.date, venueId: data.focus.venueId, order: draft.order,
      });
    } catch (e) {
      const message = (e as Error).message;
      if (message.startsWith("The schedule changed")) {
        setDraft(undefined);
        setLoaded(undefined);
        await load().then(() => setError(message)).catch(() => setError("The schedule changed. Refresh to load the latest timeline."));
      } else {
        setError(message);
      }
      setBusy(false);
      return;
    }
    try {
      await load();
    } catch {
      setLoaded(undefined);
      setError("Schedule saved. Refresh to load the latest timeline.");
    } finally {
      setDraft(undefined);
      setBusy(false);
    }
  }

  function openEvent(source?: ScheduleEntry) {
    setError("");
    setEditing({ id: source?.eventId ?? 0, name: source?.name ?? "", stage: false, source, event: true });
    setEventKind(source?.kind ?? "break");
    setDestination({ venueId: String(source?.venueId ?? activeVenue ?? ""), date: source?.date ?? activeDay ?? today(),
      time: source?.time ?? "", duration: source?.duration ?? 15 });
  }

  function openAssignment(id: number, name: string, stage: boolean, source?: ScheduleEntry) {
    const preferredVenue = data?.venues.find(v => v.id === activeVenue && (v.type === "stage") === stage);
    setError("");
    setEditing({ id, name, stage, source });
    setDestination({ venueId: source ? String(source.venueId) : preferredVenue ? String(preferredVenue.id) : "",
      date: source?.date ?? (activeDay || today()), time: source?.time ?? "", duration: source?.duration ?? 15 });
  }

  return <div className={isPublic ? "mx-auto max-w-7xl space-y-5 px-3 pb-6 pt-6 sm:px-6 sm:pt-10 lg:px-8" : "space-y-5"}>
    {isAdmin && <canvas ref={dragImage} aria-hidden="true" width={1} height={1} className="pointer-events-none fixed left-0 top-0" />}
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
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && <div className="flex flex-wrap gap-2" role="group" aria-label="Schedule views">
          {(["scheduled", "unscheduled"] as const).map(option => <button key={option} type="button" disabled={editingBlocked}
            aria-pressed={tab === option} className={tab === option ? primary : button} onClick={() => { setTab(option); setSearch(""); }}>
            {option === "scheduled" ? "Scheduled" : "Unscheduled"}
            {navigation && <span className="tabular-nums">({option === "scheduled" ? navigation.scheduledTotal : navigation.unscheduledTotal})</span>}
          </button>)}
        </div>}
        {isAdmin && tab === "scheduled" && <button className={button} disabled={editingBlocked || !data} onClick={() => openEvent()}>Add event</button>}
        {isAdmin && (editingBlocked
          ? <button className={button} disabled><TbMapPin size={18} /> Manage venues</button>
          : <Link href="/venues" className={button}><TbMapPin size={18} /> Manage venues</Link>)}
        <button className={button} disabled={editingBlocked} onClick={() => void refresh()}>
          <TbRefresh className={refreshing ? "animate-spin" : ""} size={18} /> Refresh
        </button>
      </div>
    </header>
    {error && !editing && !draft && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {!data && !error && <div className={`${panel} p-8 text-center text-sm text-gray-500`} role="status">Loading schedule…</div>}

    {navigation && <section className={panel} aria-label="Schedule filters">
      {tab === "scheduled" && dates.length > 0 && <>
        <div className="flex flex-wrap gap-2 border-b border-gray-100 p-3 sm:px-4" role="group" aria-label="Schedule days">
          {dates.map(date => <button key={date} type="button" disabled={editingBlocked} aria-pressed={activeDay === date}
            className={activeDay === date ? primary : button} onClick={() => {
              if (activeDay === date) return;
              setDay(date); setVenueFilter(""); setSearch("");
            }}>{dateLabel(date)}</button>)}
        </div>
        <div className="flex gap-5 overflow-x-auto border-b border-gray-200 px-4 sm:px-5" role="group" aria-label="Stages for selected day">
          {stageTabs.map(stage => <button key={stage.venueId} type="button" disabled={editingBlocked}
            aria-pressed={activeVenue === stage.venueId}
            onClick={() => {
              if (activeVenue === stage.venueId) return;
              setDay(stage.date); setVenueFilter(String(stage.venueId)); setSearch("");
            }}
            className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${activeVenue === stage.venueId ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-800"} disabled:opacity-50`}>
            {stage.venueName} <span className="ml-1 text-xs tabular-nums">({stage.count})</span>
          </button>)}
        </div>
      </>}
      <div className="p-3 sm:p-4">
        <label className="relative block min-w-0">
          <span className="sr-only">Search programs or categories</span><TbSearch className="absolute left-3 top-3.5 text-gray-400" size={17} />
          <input type="search" className={field + " pl-9"} placeholder={tab === "unscheduled" ? "Search unscheduled programs…" : "Search this stage…"} value={search} disabled={hasDraft || dragged !== null} onChange={e => setSearch(e.target.value)} />
        </label>
        {isAdmin && tab === "scheduled" && data?.entries.some(canReorderTimelineItem) && <p className="mt-2 text-xs text-gray-500">
          {needle ? "Clear search to reorder the timeline." : "Drag programs or events between items, or use the arrows. Save when the order is ready."}
        </p>}
      </div>
    </section>}

    {data && <>

      {tab === "scheduled" && (!visibleBoards.length ? <div className={`${panel} grid justify-items-center gap-3 p-8 text-center`}>
        <TbCalendar size={32} className="text-primary-600" />
        <h2 className="font-semibold text-gray-900">{entries.length ? "No matching programs" : "No programs scheduled"}</h2>
        {entries.length ? <button className={button} onClick={() => setSearch("")}>Clear search</button> :
          isAdmin && <button className={primary} onClick={() => setTab("unscheduled")}>View unscheduled programs</button>}
      </div> : <div className="grid gap-4">
        {visibleBoards.map(([key, queue]) => {
          const from = dragged === null ? -1 : queue.findIndex(item => timelineKey(item) === dragged.key);
          const activeGap = from >= 0 ? dropGap : null;
          const gapHeight = dragged?.gapHeight ?? 0;
          return <section key={key} className={panel}>
            <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-50 text-primary-700"><TbMapPin size={19} /></span>
              <div className="mr-auto"><h2 className="font-semibold text-gray-900">{queue[0].venueName}</h2><p className="text-xs text-gray-600">{dateLabel(queue[0].date)}</p></div>
              <span className="text-sm text-gray-500">{queue.filter(matches).length}{needle ? ` of ${queue.length}` : ""} {queue.length === 1 ? "item" : "items"}</span>
            </header>
            <ol className="divide-y divide-gray-100 [overflow-anchor:none]"
              onDragOver={event => {
                if (from < 0 || !canReorder) return;
                const gap = timelineGapAtPointer(event);
                if (gap === null || !timelineOrderAtGap(queue, from, gap)) {
                  setDropGap(null);
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropGap(gap);
              }}
              onDragLeave={event => {
                if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.clientX < bounds.left || event.clientX >= bounds.right ||
                    event.clientY < bounds.top || event.clientY >= bounds.bottom) setDropGap(null);
              }}
              onDrop={event => {
                if (from < 0 || !canReorder) return;
                event.preventDefault();
                const gap = timelineGapAtPointer(event);
                const order = gap === null ? undefined : timelineOrderAtGap(queue, from, gap);
                if (order) previewOrder(order);
                setDragged(null);
                setDropGap(null);
              }}>
              {queue.map((row, index) => {
                if (!matches(row)) return null;
                const rowKey = timelineKey(row);
                const movable = canReorder && canReorderTimelineItem(row);
                const before = activeGap === index;
                const after = activeGap === index + 1;
                return <li key={rowKey}>
                  {isAdmin && <TimelineDropGap index={index} height={before ? gapHeight : 0} />}
                  <div data-timeline-row={index}
                  draggable={movable}
                  onDragStart={event => {
                    if (!movable) { event.preventDefault(); return; }
                    event.dataTransfer.setData("text/plain", rowKey);
                    event.dataTransfer.effectAllowed = "move";
                    if (dragImage.current) event.dataTransfer.setDragImage(dragImage.current, 0, 0);
                    setDragged({ key: rowKey, gapHeight: Math.round(event.currentTarget.getBoundingClientRect().height / 2) });
                  }}
                  onDragEnd={() => { setDragged(null); setDropGap(null); }}
                  className={`relative grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3 px-4 transition-[padding] duration-200 motion-reduce:transition-none sm:px-5 xl:flex xl:items-center ${row.kind ? eventStyles[row.kind] : ""} ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${before ? "pb-2 pt-4" : after ? "pb-4 pt-2" : "py-3"}`}>
                  <span aria-label={`Queue position ${row.position}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-sm font-bold tabular-nums text-primary-700">{row.position}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-semibold text-gray-900">{row.name}</h3>
                    <p className={row.kind ? "text-sm font-medium capitalize" : "text-sm text-gray-500"}>{row.kind ?? categoryMap[row.category] ?? row.category}</p>
                  </div>
                  <div className="col-start-2 flex flex-wrap items-center gap-2 sm:min-w-36">
                    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-gray-600"><TbClock aria-hidden="true" size={16} />{row.time ? <time dateTime={row.time}>{timeLabel(row.time)}</time> : "Time to be announced"}</span>
                    <span className="text-xs text-gray-600">{row.duration} min</span>
                    <Status status={row.status} />
                  </div>
                  {isAdmin && (row.eventId !== null || canMove(row.status)) && <div className="col-start-2 flex flex-wrap gap-2">
                    {[-1, 1].map(offset => {
                      const direction = offset < 0 ? "up" : "down";
                      const order = movable ? timelineOrderAtGap(queue, index, index + (offset < 0 ? -1 : 2)) : undefined;
                      return <IconAction key={offset} className={button} label={`Move ${row.name} ${direction}`} tooltip={`Move ${direction}`}
                        disabled={!order || dragged !== null}
                        onClick={() => { if (order) previewOrder(order); }}>{offset < 0 ? <TbArrowUp size={17} /> : <TbArrowDown size={17} />}</IconAction>;
                    })}
                    <button className={button} disabled={editingBlocked} onClick={() => {
                      if (row.eventId !== null) openEvent(row);
                      else openAssignment(row.programId!, row.name, data.venues.find(v => v.id === row.venueId)?.type === "stage", row);
                    }}><TbEdit size={17} /> {row.eventId !== null ? "Edit event" : "Edit"}</button>
                  </div>}
                  </div>
                  {isAdmin && index === queue.length - 1 && <TimelineDropGap index={queue.length} height={after ? gapHeight : 0} />}
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

    {hasDraft && <div aria-hidden="true" className="h-32 sm:h-24" />}
    {isAdmin && (
      <section aria-label="Unsaved schedule changes" inert={!hasDraft}
        className={`fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-white p-3 shadow-lg transition-[transform,opacity] duration-300 ease-in-out motion-reduce:translate-y-0 motion-reduce:transition-none sm:px-4 lg:bottom-6 lg:left-[19rem] ${hasDraft ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0"}`}>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><TbAlertCircle size={19} /></span>
          <div>
            <p className="text-sm font-semibold text-gray-900" role="status">{busy ? "Saving schedule…" : "Unsaved schedule changes"}</p>
            <p className="text-xs text-gray-500">{data?.focus?.venueName}</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" className={button} disabled={busy || dragged !== null} onClick={() => { setDraft(undefined); setError(""); }}><TbHistory size={17} /> Discard</button>
          <button type="button" className={primary} disabled={busy || dragged !== null} onClick={() => void commitDraft()}><TbCheck size={17} /> Save schedule</button>
        </div>
        {hasDraft && error && <p role="alert" className="w-full text-sm text-red-800">{error}</p>}
      </section>
    )}
    <dialog ref={dialog} aria-labelledby="assignment-title" className="m-auto w-11/12 max-w-lg rounded-2xl p-0 shadow-xl backdrop:bg-gray-950/45" onCancel={e => {
      e.preventDefault();
      if (!busy) setEditing(undefined);
    }}>
      {editing && <form className="space-y-4 p-5 sm:p-6" onSubmit={e => {
        e.preventDefault();
        const slot = { ...destination, venueId: Number(destination.venueId) };
        if (editing.event) {
          void save({ action: "event", revision: data?.revision, id: editing.id || null, destination: { ...slot, name: editing.name, kind: eventKind } });
        } else void move(editing.id, slot);
      }}>
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="assignment-title" className="text-lg font-semibold text-gray-900">{editing.event ? (editing.id ? "Edit event" : "Add event") : editing.source ? "Edit assignment" : "Assign program"}</h2>{!editing.event && <p className="mt-0.5 text-sm text-gray-500">{editing.name}</p>}</div>
          <IconAction label="Close assignment" className={button} disabled={busy} onClick={() => setEditing(undefined)}><TbX size={18} /></IconAction>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {editing.event && <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">Event name<input className={field} required maxLength={150} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">Event type<select className={field} value={eventKind} onChange={e => setEventKind(e.target.value as EventKind)}>
            <option value="launch">Launch</option><option value="break">Break</option><option value="session">Session</option>
          </select></label>
        </div>}
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Venue
          <select className={field} required value={destination.venueId} onChange={e => setDestination({ ...destination, venueId: e.target.value })}>
            <option value="">Select {editing.event ? "a" : editing.stage ? "a Stage" : "an Off-stage"} venue</option>
            {compatibleVenues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        {!compatibleVenues.length && <p className="text-sm text-gray-500">Add a compatible venue before assigning this program.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">Event date<input className={field} type="date" required value={destination.date} onChange={e => setDestination({ ...destination, date: e.target.value })} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">Start time (IST)<input className={field} type="time" required value={destination.time} onChange={e => setDestination({ ...destination, time: e.target.value })} />
            {destination.time && <span className="text-xs font-normal text-gray-500">{timeLabel(destination.time)}</span>}
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">Duration (minutes)<input className={field} type="number" min={1} max={1440} required value={destination.duration || ""} onChange={e => setDestination({ ...destination, duration: Number(e.target.value) })} /></label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4">
          {editing.source && <button type="button" className={button + " mr-auto text-red-700"} disabled={busy} onClick={() => {
            if (editing.event) void save({ action: "event", revision: data?.revision, id: editing.id, destination: null });
            else void move(editing.id, null);
          }}>{editing.event ? "Remove event" : "Unschedule"}</button>}
          <button type="button" className={button} disabled={busy} onClick={() => setEditing(undefined)}>Cancel</button>
          <button className={primary} disabled={busy || !compatibleVenues.length}>{busy ? "Saving…" : editing.event ? "Save event" : "Save assignment"}</button>
        </div>
      </form>}
    </dialog>
  </div>;
}
