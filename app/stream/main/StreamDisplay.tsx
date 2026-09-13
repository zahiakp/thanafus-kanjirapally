"use client";

import { useEffect, useRef, useState } from "react";
import StreamRenderer from "../../../components/stream/StreamRenderer";
import { StreamPublicState, StreamUnchangedState } from "../types";

const CACHE_KEY = "thanafus-stream-main-state";
const BACKOFF = [3_000, 5_000, 10_000, 30_000];

export default function StreamDisplay() {
  const [token, setToken] = useState("");
  const [state, setState] = useState<StreamPublicState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const knownVersion = useRef<string | undefined>(undefined);
  const failureCount = useRef(0);

  useEffect(() => {
    const fragment = decodeURIComponent(window.location.hash.slice(1).trim());
    setToken(fragment);
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as StreamPublicState | null;
      if (cached?.success && cached.changed) { setState(cached); knownVersion.current = cached.version; }
    } catch { localStorage.removeItem(CACHE_KEY); }
  }, []);

  useEffect(() => {
    if (!token) return;
    let disposed = false; let timer: number | undefined; let controller: AbortController | null = null; let immediateRequested = false;
    const schedule = (delay: number) => { window.clearTimeout(timer); timer = window.setTimeout(poll, delay); };
    const poll = async () => {
      if (disposed || controller) return;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 6_000);
      try {
        const query = new URLSearchParams({ screen: "main" });
        if (knownVersion.current) query.set("version", knownVersion.current);
        const response = await fetch(`/api/stream/state?${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        const result = await response.json().catch(() => null) as StreamPublicState | StreamUnchangedState | { message?: string } | null;
        if (!response.ok || !result || !("success" in result)) throw new Error(result && "message" in result ? result.message : "Unable to load the display");
        failureCount.current = 0; setConnected(true); setError(""); knownVersion.current = result.version;
        if (result.changed) { setState(result); localStorage.setItem(CACHE_KEY, JSON.stringify(result)); }
        schedule(result.nextPollMs || 3_000);
      } catch (pollError) {
        if (disposed) return;
        setConnected(false); setError(pollError instanceof Error ? pollError.message : "Connection lost");
        failureCount.current = Math.min(failureCount.current + 1, BACKOFF.length - 1);
        schedule(BACKOFF[failureCount.current]);
      } finally { window.clearTimeout(timeout); controller = null; }
    };
    const refresh = () => { if (!disposed) { immediateRequested = true; controller?.abort(); controller = null; schedule(0); } };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("online", refresh); document.addEventListener("visibilitychange", visible); poll();
    return () => { disposed = true; window.clearTimeout(timer); controller?.abort(); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [token]);

  if (!token) return <main className="flex min-h-screen items-center justify-center bg-[#080817] p-8 text-center text-white"><div><h1 className="text-3xl font-black">Display token required</h1><p className="mt-3 text-white/60">Copy the secure display link from Config → Stream.</p></div></main>;
  if (!state) return <main className="flex min-h-screen items-center justify-center bg-[#080817] text-white"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /><p className="mt-4 text-white/60">Connecting to the Digital Stage…</p>{error && <p className="mt-2 text-sm text-red-300">{error}</p>}</div></main>;
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black"><StreamRenderer state={state} className="max-h-screen max-w-[177.777vh]" /><div className={`absolute right-4 top-4 z-50 rounded-full px-3 py-1 text-xs font-bold backdrop-blur ${connected ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/20 text-red-200"}`}>{connected ? "Connected" : `Reconnecting${error ? ` · ${error}` : ""}`}</div><button onClick={() => document.documentElement.requestFullscreen?.()} className="absolute bottom-4 right-4 z-50 rounded-lg bg-black/30 px-3 py-2 text-xs text-white/50 opacity-0 backdrop-blur transition hover:opacity-100 focus:opacity-100">Fullscreen</button></main>;
}

