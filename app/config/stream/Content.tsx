"use client";
import { useEffect, useState } from "react";
import StreamDisplay from "../../stream/main/StreamDisplay";

export default function Content() {
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState("");
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/stream/admin", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.success) throw Error(data.message || "Unable to load controls");
      setEnabled(data.channel.enabled); setTitle(data.channel.eventTitle); setReady(true);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  async function command(body: object) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/stream/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.success) throw Error(data.message || "Unable to save");
      if (data.token) setToken(data.token);
      setRefreshKey(value => value + 1);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); return false; }
    finally { setBusy(false); }
  }
  const link = token && typeof window !== "undefined" ? window.location.origin + "/stream/main#" + encodeURIComponent(token) : "";
  return <main className="space-y-5">
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h1 className="text-2xl font-bold">Stage results stream</h1>
      <p className="text-sm text-gray-600">Each program opens with a 4-second introduction, followed by 8 seconds per first- and second-place winner, then 10 seconds of branding. Tied winners appear on separate slides. After every five program results (and the final smaller group), the team score board shows all categories, five published programs and up to seven teams per 15-second slide, with overall totals. Results refresh every five minutes, including corrections and withdrawals.</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <label className="flex items-center gap-3"><input type="checkbox" checked={enabled} disabled={!ready || busy} onChange={async e => {
        const value = e.target.checked;
        if (await command({ action: "toggle_enabled", enabled: value })) setEnabled(value);
      }} />Enable stream</label>
      <label className="block">Event title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} className="mt-2 block w-full rounded border p-3" /></label>
      <button disabled={!ready || busy || !title.trim()} onClick={() => command({ action: "set_event_title", eventTitle: title })} className="rounded bg-primary-600 px-4 py-2 text-white">Save title</button>
      <p className="text-sm text-gray-500">Display settings and token changes take effect on each screen’s next five-minute refresh. Reload a screen to apply sooner.</p>
      <div className="flex flex-wrap gap-3">
        <button disabled={!ready || busy} onClick={() => command({ action: "regenerate_token" })} className="rounded border px-4 py-2">Generate new display link</button>
        {link && <button onClick={async () => { try { await navigator.clipboard.writeText(link); } catch { setError("Select and copy the display link below."); } }} className="rounded border px-4 py-2">Copy link</button>}
      </div>
      {link && <input aria-label="Secure display link" readOnly value={link} className="w-full rounded border p-3" />}
      <p className="text-xs text-gray-500">Generating a link replaces the previous display token. Save the link before leaving this page.</p>
    </section>
    {ready && <section className="overflow-hidden rounded-xl border"><h2 className="bg-white p-4 font-semibold">Results preview</h2><StreamDisplay preview refreshKey={refreshKey} /></section>}
  </main>;
}
