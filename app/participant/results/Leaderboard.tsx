"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCrown } from "react-icons/fa";
import { MdOutlineLeaderboard } from "react-icons/md";

type LeaderboardRow = {
  teamId: string;
  teamName: string;
  shortName: string;
  point: number;
  after: number;
  updatedAt: string;
};

function ranks(rows: LeaderboardRow[]) {
  let rank = 0;
  let previous: number | null = null;
  return rows.map((row, index) => {
    if (previous !== row.point) rank = index + 1;
    previous = row.point;
    return { ...row, rank };
  });
}

export default function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to load team standings");
      setRows(Array.isArray(result.data) ? result.data : []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load team standings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const ranked = useMemo(() => ranks(rows), [rows]);
  const updatedAt = ranked[0]?.updatedAt;

  if (loading || message || ranked.length === 0) return null;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 bg-gradient-to-r from-primary-700 to-primary-500 px-4 py-5 text-white sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75"><MdOutlineLeaderboard className="text-lg" /> Live team points</p>
          <h2 className="mt-1 text-2xl font-black sm:text-3xl">Team leaderboard</h2>
        </div>
        {updatedAt && <p className="text-xs text-white/75">After {ranked[0].after} results · Synced {new Date(updatedAt).toLocaleString()}</p>}
      </div>

      {loading ? (
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-6">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-gray-100" />)}</div>
      ) : message ? (
        <p className="p-6 text-center text-sm text-amber-700">{message}</p>
      ) : ranked.length === 0 ? (
        <p className="p-6 text-center text-sm text-gray-500">The leaderboard will appear after an administrator syncs team points.</p>
      ) : (
        <>
          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-6">
            {ranked.slice(0, 3).map((team) => (
              <article key={team.teamId} className={`rounded-xl border p-4 ${team.rank === 1 ? "border-amber-200 bg-amber-50" : team.rank === 2 ? "border-slate-200 bg-slate-50" : "border-orange-200 bg-orange-50"}`}>
                <div className="flex items-center justify-between gap-3"><span className="text-sm font-black">#{team.rank}</span>{team.rank === 1 && <FaCrown className="text-amber-500" />}</div>
                <h3 className="mt-3 truncate font-bold text-gray-900">{team.teamName}</h3>
                <p className="text-xs text-gray-500">ID: {team.teamId}</p>
                <p className="mt-3 text-3xl font-black text-primary-700">{team.point}<span className="ml-1 text-xs font-semibold uppercase text-gray-500">pts</span></p>
              </article>
            ))}
          </div>
          {ranked.length > 3 && <div className="border-t border-gray-100 px-4 py-2 sm:px-6">{ranked.slice(3).map((team) => <div key={team.teamId} className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"><span className="w-8 text-center text-sm font-bold text-gray-500">#{team.rank}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{team.teamName}</p><p className="text-xs text-gray-400">{team.teamId}</p></div><strong className="text-primary-700">{team.point} pts</strong></div>)}</div>}
        </>
      )}
    </section>
  );
}
