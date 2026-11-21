"use client";
import { useEffect, useRef, useState } from "react";
import StreamRenderer from "../../../components/stream/StreamRenderer";
import { playlistState, RESULT_REFRESH_MS, type ResultPlaylist } from "../playlist";

export default function StreamDisplay({ preview = false, refreshKey = 0 }: { preview?: boolean; refreshKey?: number }) {
  const playbackStarted = useRef(false);
  const [token, setToken] = useState("");
  const [list, setList] = useState<ResultPlaylist | null>(null);
  const [position, setPosition] = useState({ tick: 0, startedAt: new Date().toISOString() });
  const [error, setError] = useState("");
  useEffect(() => {
    if (preview) return;
    try { setToken(decodeURIComponent(window.location.hash.slice(1).trim())); }
    catch { setError("Invalid display link."); }
  }, [preview]);
  useEffect(() => {
    if (!preview && !token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    let cacheKey = "";
    const poll = async () => {
      try {
        const response = await fetch("/api/stream/results" + (preview ? "?preview=1" : ""), {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
          headers: preview ? {} : { Authorization: "Bearer " + token },
        });
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.results)) {
          if (response.status === 401 || response.status === 403) {
            setList(null);
            try { localStorage.removeItem(cacheKey); } catch {}
          }
          throw new Error(data.message || "Unable to refresh results");
        }
        if (stopped) return;
        if (!playbackStarted.current) { playbackStarted.current = true; setPosition({ tick: 0, startedAt: new Date().toISOString() }); }
        setList(data); setError("");
        try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* Playback works in memory when storage is full. */ }
      } catch (failure) {
        if (!stopped) setError(failure instanceof Error ? failure.message : "Unable to refresh results");
      } finally {
        if (!stopped) timer = setTimeout(poll, RESULT_REFRESH_MS);
      }
    };
    const start = async () => {
      if (!preview) {
        try {
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
          cacheKey = "thanafus-results-v1-" + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
          const saved = JSON.parse(localStorage.getItem(cacheKey) || "null");
          if (!stopped && saved?.success && Array.isArray(saved.results)) { playbackStarted.current = true; setPosition({ tick: 0, startedAt: new Date().toISOString() }); setList(saved); }
        } catch { /* Storage is optional. */ }
      }
      if (!stopped) void poll();
    };
    void start();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [token, preview, refreshKey]);

  const state = list ? playlistState(list, position.tick, position.startedAt) : null;
  const duration = state?.scene.durationSeconds;
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => setPosition(current => ({
      tick: current.tick + 1, startedAt: new Date().toISOString(),
    })), duration * 1000);
    return () => clearTimeout(timer);
  }, [duration, position]);
  const content = state ? <StreamRenderer state={state} /> :
    <div className="grid aspect-video place-items-center bg-[#080817] p-8 text-center text-white">
      {error || (!preview && !token ? "Open the secure display link from Config → Stream." : "Loading published results…")}
    </div>;
  return <div className={preview ? "relative" : "relative flex min-h-screen items-center justify-center bg-black"}>
    <div className={preview ? "w-full" : "w-full max-w-[177.777vh]"}>{content}</div>
    {error && list && <p className="absolute right-3 top-3 rounded bg-black/60 px-3 py-1 text-xs text-amber-200">Offline · Playing cached results</p>}
    {!preview && <button onClick={() => document.documentElement.requestFullscreen?.()} className="absolute bottom-4 right-4 rounded bg-black/30 px-3 py-2 text-xs text-white/50">Fullscreen</button>}
  </div>;
}
