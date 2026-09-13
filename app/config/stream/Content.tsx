"use client";

import { Checkbox, Select, Switch } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { MdContentCopy, MdLiveTv, MdOutlineSkipNext, MdRefresh, MdStopCircle } from "react-icons/md";
import StreamRenderer from "../../../components/stream/StreamRenderer";
import { StreamAdminSnapshot, StreamControlCommand, StreamPublicState, StreamUnchangedState } from "../../stream/types";

const formatTime = (value: string | null) => value ? new Date(value).toLocaleTimeString() : "—";

export default function Content() {
  const [snapshot, setSnapshot] = useState<StreamAdminSnapshot | null>(null);
  const [preview, setPreview] = useState<StreamPublicState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [token, setToken] = useState("");
  const [liveProgram, setLiveProgram] = useState<number | null>(null);
  const [liveEntry, setLiveEntry] = useState<number | null>(null);
  const [nextProgram, setNextProgram] = useState<number | null>(null);
  const [resultProgram, setResultProgram] = useState<number | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [announcement, setAnnouncement] = useState({ title: "", message: "", duration: 15, urgent: false, pin: false });
  const previewVersion = useRef<string | undefined>(undefined);

  const load = useCallback(async (programId?: number | null, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const query = programId ? `?program=${programId}` : "";
      const response = await fetch(`/api/stream/admin${query}`, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.message || "Unable to load the stream control room");
      const data = result as StreamAdminSnapshot;
      setSnapshot(data); setPreview(data.preview); previewVersion.current = data.preview.version;
      setLiveProgram((current) => current ?? data.channel.liveProgramId);
      setLiveEntry((current) => current ?? data.channel.liveEntryId);
      setNextProgram((current) => current ?? data.channel.nextProgramId);
      setEventTitle((current) => current || data.channel.eventTitle);
      setError("");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load stream controls"); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!snapshot) return;
    let disposed = false; let timer: number;
    const poll = async () => {
      try {
        const query = new URLSearchParams({ screen: "main", preview: "1" });
        if (previewVersion.current) query.set("version", previewVersion.current);
        const response = await fetch(`/api/stream/state?${query}`, { cache: "no-store" });
        const result = await response.json() as StreamPublicState | StreamUnchangedState;
        if (response.ok && result.success) { previewVersion.current = result.version; if (result.changed) setPreview(result); }
      } catch { /* The preview keeps its last valid state. */ }
      if (!disposed) timer = window.setTimeout(poll, 3_000);
    };
    timer = window.setTimeout(poll, 3_000);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [snapshot]);

  async function command(value: StreamControlCommand, successMessage: string) {
    setWorking(true); setNotice("");
    try {
      const response = await fetch("/api/stream/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.message || "Stream command failed");
      if (result.token) setToken(result.token);
      setError(""); setNotice(successMessage); await load(liveProgram, true); return true;
    } catch (commandError) { setError(commandError instanceof Error ? commandError.message : "Stream command failed"); return false; }
    finally { setWorking(false); }
  }

  async function changeLiveProgram(value: number | null) {
    setLiveProgram(value); setLiveEntry(null); await load(value, true);
  }

  async function copyDisplayLink() {
    if (!token) { setNotice("Generate a new token first. For security, old display tokens cannot be shown again."); return; }
    await navigator.clipboard.writeText(`${window.location.origin}/stream/main#${encodeURIComponent(token)}`);
    setNotice("Secure display link copied.");
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;
  if (!snapshot) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"><h1 className="text-lg font-bold">Stream setup required</h1><p className="mt-2">{error}</p><p className="mt-3 text-sm">Apply <code>database/stream-schema.sql</code> to the live MySQL database, then reload this page.</p><button onClick={() => load()} className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white">Retry</button></div>;

  const programOptions = snapshot.programs.map((program) => ({ value: program.id, label: `${program.name} · ${program.category}` }));
  const resultOptions = snapshot.resultPrograms.map((program) => ({ value: program.id, label: `${program.order ? `#${program.order} · ` : ""}${program.name} · ${program.category}` }));
  const entryOptions = snapshot.entries.map((entry) => ({ value: entry.id, label: `${entry.chestNo} · ${entry.participantName} · ${entry.teamName}` }));

  return <div className="mx-auto max-w-7xl space-y-6 py-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-primary-600"><MdLiveTv className="text-2xl" /><span className="text-xs font-bold uppercase tracking-[.2em]">Digital Stage</span></div><h1 className="mt-1 text-3xl font-black text-gray-900">Stream control room</h1><p className="mt-2 text-sm text-gray-500">Control the public TV/projector display without touching judging or event workflows.</p></div><div className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3"><span className={`h-2.5 w-2.5 rounded-full ${snapshot.channel.enabled ? "bg-emerald-500" : "bg-gray-300"}`} /><div><p className="text-xs text-gray-500">Main Stage · version {snapshot.channel.version}</p><p className="font-semibold text-gray-800">{snapshot.channel.enabled ? "Stream enabled" : "Stream disabled"}</p></div></div></div>
    {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || notice}</div>}

    <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-sm"><div className="flex items-center justify-between bg-white px-5 py-4"><div><h2 className="font-bold text-gray-900">Live preview</h2><p className="text-xs text-gray-500">Exact renderer used by the public display</p></div><button onClick={() => load(liveProgram, true)} className="rounded-lg border p-2 text-gray-600 hover:bg-gray-50"><MdRefresh /></button></div>{preview && <StreamRenderer state={preview} />}</section>
      <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-gray-900">Broadcast state</h2><p className="text-xs text-gray-500">Automatic rotation and public access</p></div></div><div className="flex items-center justify-between rounded-xl bg-gray-50 p-4"><span className="font-medium">Enable stream</span><Switch checked={snapshot.channel.enabled} loading={working} onChange={(enabled) => command({ action: "toggle_enabled", enabled }, enabled ? "Stream enabled." : "Stream disabled.")} /></div><div className="flex items-center justify-between rounded-xl bg-gray-50 p-4"><div><p className="font-medium">Automatic rotation</p><p className="text-xs text-gray-500">Priority cues interrupt the normal loop</p></div><Switch checked={snapshot.channel.automatic} loading={working} onChange={(automatic) => command({ action: "toggle_automatic", automatic }, automatic ? "Automatic rotation enabled." : "Automatic rotation paused.")} /></div>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-600">Event title</span><div className="flex gap-2"><input value={eventTitle} maxLength={160} onChange={(event) => setEventTitle(event.target.value)} className="min-w-0 flex-1 border px-3 py-2" /><button disabled={working || !eventTitle.trim()} onClick={() => command({ action: "set_event_title", eventTitle }, "Event title updated.")} className="rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-50">Save</button></div></label>
        <div className="border-t pt-4"><p className="text-xs font-semibold text-gray-600">Secure display link</p><p className="mt-1 text-xs text-gray-500">The raw token is shown only after generation or regeneration.</p>{token && <input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/stream/main#${token}`} className="mt-3 w-full border bg-gray-50 px-3 py-2 text-xs" />}<div className="mt-3 flex gap-2"><button disabled={working} onClick={() => command({ action: "regenerate_token" }, "New display token generated. Existing display links are now invalid.")} className="flex-1 rounded-lg border border-primary-600 px-3 py-2 text-sm font-semibold text-primary-700">{snapshot.channel.tokenReady ? "Regenerate token" : "Generate token"}</button><button onClick={copyDisplayLink} className="rounded-lg bg-primary-600 px-4 py-2 text-white"><MdContentCopy /></button></div></div>
      </section>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><div><h2 className="font-bold text-gray-900">Live and up next</h2><p className="text-xs text-gray-500">Participant selection is enabled only after choosing a live program.</p></div><label className="block"><span className="mb-1 block text-xs font-semibold text-gray-600">Live program</span><Select allowClear value={liveProgram} onChange={(value) => changeLiveProgram(value ?? null)} options={programOptions} showSearch optionFilterProp="label" className="w-full" size="large" /></label><label className="block"><span className="mb-1 block text-xs font-semibold text-gray-600">Current participant</span><Select allowClear disabled={!liveProgram} value={liveEntry} onChange={(value) => setLiveEntry(value ?? null)} options={entryOptions} showSearch optionFilterProp="label" className="w-full" size="large" /></label><div className="flex flex-wrap gap-2"><button disabled={working} onClick={() => command({ action: "set_live", programId: liveProgram, entryId: liveEntry }, "Live selection saved.")} className="rounded-lg border px-4 py-2 font-semibold">Save live selection</button><button disabled={working || !liveProgram} onClick={async () => { if (await command({ action: "set_live", programId: liveProgram, entryId: liveEntry }, "Live selection saved.")) await command({ action: "show_scene", sceneType: "live", duration: 20, pin: false }, "Live scene is now showing."); }} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Show live</button><button disabled={working || !liveProgram} onClick={async () => { if (await command({ action: "set_live", programId: liveProgram, entryId: liveEntry }, "Live selection saved.")) await command({ action: "show_scene", sceneType: "live", duration: 20, pin: true }, "Live scene pinned."); }} className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Pin live</button></div>
        <label className="block border-t pt-4"><span className="mb-1 block text-xs font-semibold text-gray-600">Up-next program</span><Select allowClear value={nextProgram} onChange={(value) => setNextProgram(value ?? null)} options={programOptions} showSearch optionFilterProp="label" className="w-full" size="large" /></label><div className="flex gap-2"><button disabled={working} onClick={() => command({ action: "set_next", programId: nextProgram }, "Up-next program saved.")} className="rounded-lg border px-4 py-2 font-semibold">Save</button><button disabled={working || !nextProgram} onClick={async () => { if (await command({ action: "set_next", programId: nextProgram }, "Up-next program saved.")) await command({ action: "show_scene", sceneType: "next", duration: 15, pin: false }, "Up-next scene is now showing."); }} className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Show up next</button></div></section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><div><h2 className="font-bold text-gray-900">Announcement</h2><p className="text-xs text-gray-500">Urgent and pinned messages receive the highest priority.</p></div><input placeholder="Announcement title" maxLength={120} value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} className="w-full border px-3 py-2" /><textarea placeholder="Message" maxLength={600} rows={5} value={announcement.message} onChange={(event) => setAnnouncement({ ...announcement, message: event.target.value })} className="w-full resize-none border px-3 py-2" /><div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block text-xs font-semibold text-gray-600">Duration</span><Select value={announcement.duration} onChange={(duration) => setAnnouncement({ ...announcement, duration })} options={[10,15,20,30,45,60].map((value) => ({ value, label: `${value} seconds` }))} className="w-full" /></label><div className="flex items-end gap-4 pb-1"><Checkbox checked={announcement.urgent} onChange={(event) => setAnnouncement({ ...announcement, urgent: event.target.checked })}>Urgent</Checkbox><Checkbox checked={announcement.pin} onChange={(event) => setAnnouncement({ ...announcement, pin: event.target.checked })}>Pin</Checkbox></div></div><div className="flex gap-2"><button disabled={working || !announcement.title.trim() || !announcement.message.trim()} onClick={() => command({ action: "queue_announcement", ...announcement, showNow: false }, "Announcement queued.")} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Add to queue</button><button disabled={working || !announcement.title.trim() || !announcement.message.trim()} onClick={() => command({ action: "queue_announcement", ...announcement, showNow: true }, announcement.pin ? "Announcement pinned." : "Announcement is now showing.")} className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Show now</button></div></section>
    </div>

    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><div><h2 className="font-bold text-gray-900">Results and quick scenes</h2><p className="text-xs text-gray-500">Only announced results are selectable.</p></div><div className="grid gap-3 md:grid-cols-[1fr_auto_auto]"><Select value={resultProgram} onChange={(value) => setResultProgram(value)} options={resultOptions} showSearch optionFilterProp="label" placeholder="Choose an announced result" className="w-full" size="large" /><button disabled={!resultProgram || working} onClick={() => command({ action: "show_result", programId: resultProgram!, duration: 20, showNow: false }, "Result queued.")} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Queue result</button><button disabled={!resultProgram || working} onClick={() => command({ action: "show_result", programId: resultProgram!, duration: 20, showNow: true }, "Result reveal started.")} className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-amber-950 disabled:opacity-50">Reveal now</button></div><div className="flex flex-wrap gap-2"><button onClick={() => command({ action: "show_scene", sceneType: "scoreboard", duration: 20, pin: false }, "Scoreboard is now showing.")} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Show scoreboard</button><button onClick={() => command({ action: "show_scene", sceneType: "idle", duration: 15, pin: false }, "Idle scene is now showing.")} className="rounded-lg bg-gray-700 px-4 py-2 text-white">Show idle</button><button onClick={() => command({ action: "unpin" }, "Pinned scene released.")} className="rounded-lg border px-4 py-2">Unpin</button><button onClick={() => command({ action: "skip" }, "Current scene skipped.")} className="flex items-center gap-1 rounded-lg border px-4 py-2"><MdOutlineSkipNext /> Skip</button><button onClick={() => command({ action: "clear_queue" }, "Queued scenes cleared.")} className="flex items-center gap-1 rounded-lg border border-red-200 px-4 py-2 text-red-700"><MdStopCircle /> Clear queue</button></div></section>

    <div className="grid gap-6 lg:grid-cols-2"><section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-bold">Upcoming queue</h2></div><div className="divide-y">{snapshot.queue.length ? snapshot.queue.map((cue) => <div key={cue.id} className="flex items-center justify-between px-5 py-3 text-sm"><div><span className="font-semibold capitalize">{cue.type}</span><span className="ml-2 text-xs text-gray-400">priority {cue.priority}</span></div><div className="text-right"><p className={cue.status === "playing" ? "font-semibold text-emerald-600" : "text-gray-600"}>{cue.status}</p><p className="text-xs text-gray-400">{cue.durationSeconds}s</p></div></div>) : <p className="p-6 text-center text-sm text-gray-500">Queue is empty.</p>}</div></section><section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-bold">Recent history</h2></div><div className="max-h-72 divide-y overflow-auto">{snapshot.history.length ? snapshot.history.map((cue) => <div key={cue.id} className="flex items-center justify-between px-5 py-3 text-sm"><div><span className="font-semibold capitalize">{cue.type}</span><span className="ml-2 text-xs text-gray-400">by {cue.createdBy}</span></div><div className="text-right"><p className="capitalize text-gray-600">{cue.status}</p><p className="text-xs text-gray-400">{formatTime(cue.startsAt)}</p></div></div>) : <p className="p-6 text-center text-sm text-gray-500">No stream history yet.</p>}</div></section></div>
  </div>;
}

