"use client";

import { useEffect, useState } from "react";
import { scheduleRequest } from "../../schedule/Queue";
import type { Venue } from "../../utils/venueSchedule";

export default function VenueScopeModal({ id, username, close }: { id: number; username: string; close: () => void }) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [scope, setScope] = useState<number[] | null>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    scheduleRequest<{ venues: Venue[]; scope: number[] | null }>("?accessId=" + id)
      .then(data => { if (current) { setVenues(data.venues); setScope(data.scope); } })
      .catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [id]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-gray-950/45 p-4" role="dialog" aria-modal="true" aria-label="Venue access">
    <form className="max-h-[85vh] w-full max-w-md space-y-4 overflow-auto rounded-xl bg-white p-6" onSubmit={async e => {
      e.preventDefault();
      if (scope === undefined) return;
      setBusy(true);
      setError("");
      try { await scheduleRequest("", { action: "staff", accessId: id, venueIds: scope }); close(); }
      catch (err) { setError((err as Error).message); }
      finally { setBusy(false); }
    }}>
      <h2 className="text-lg font-semibold">Venue access for {username}</h2>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {scope !== undefined && <fieldset disabled={busy} className="space-y-3">
        <label className="block"><input type="radio" name="venueScope" checked={scope === null} onChange={() => setScope(null)} /> All venues</label>
        <label className="block"><input type="radio" name="venueScope" checked={scope !== null} onChange={() => setScope([])} /> Selected venues</label>
        {scope !== null && venues.map(venue => <label key={venue.id} className="ml-5 block">
          <input type="checkbox" checked={scope.includes(venue.id)} onChange={e => setScope(e.target.checked ? [...scope, venue.id] : scope.filter(id => id !== venue.id))} /> {venue.name}
        </label>)}
        {scope?.length === 0 && <p className="text-sm text-gray-600">This account will have no venue access.</p>}
      </fieldset>}
      <div className="flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={close}>Cancel</button>
        <button disabled={busy || scope === undefined} className="rounded bg-primary-700 px-4 py-2 text-white disabled:opacity-50">Save access</button>
      </div>
    </form>
  </div>;
}
