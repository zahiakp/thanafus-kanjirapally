"use client";

import { useEffect, useState } from "react";
import { scheduleRequest } from "../../schedule/Queue";
import type { StaffVenueAssignment } from "../../utils/venueAccess";
import type { Venue } from "../../utils/venueSchedule";

export default function VenueScopeModal({ id, username, close, saved }: {
  id: number; username: string; close: () => void; saved: (assignment: StaffVenueAssignment) => void;
}) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [scope, setScope] = useState<number[] | null>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    scheduleRequest<{ venues: Venue[]; scope: number[] | null }>("?accessId=" + id, undefined, controller.signal)
      .then(data => { setVenues(data.venues); setScope(data.scope); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-gray-950/45 p-4" role="dialog" aria-modal="true" aria-label="Venue access">
    <form className="max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-xl bg-white p-4 sm:p-6" onSubmit={async e => {
      e.preventDefault();
      if (busy || scope === undefined) return;
      setBusy(true);
      setError("");
      try {
        const { assignment } = await scheduleRequest<{ assignment?: StaffVenueAssignment }>("", { action: "staff", accessId: id, venueIds: scope });
        if (!assignment) throw new Error("Could not confirm the saved venue access. Reopen this dialog to check the current assignment.");
        saved(assignment);
        close();
      }
      catch (err) { setError((err as Error).message); }
      finally { setBusy(false); }
    }}>
      <h2 className="text-lg font-semibold">Venue access for {username}</h2>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {scope === undefined && !error && <p role="status" className="text-sm text-gray-600">Loading venue access…</p>}
      {scope !== undefined && <fieldset disabled={busy} className="space-y-3">
        <label className="block"><input type="radio" name="venueScope" checked={scope === null} onChange={() => setScope(null)} /> All venues</label>
        <label className="block"><input type="radio" name="venueScope" checked={scope !== null} onChange={() => setScope(current => current ?? [])} /> Selected venues</label>
        {scope !== null && venues.map(venue => <label key={venue.id} className="ml-5 block">
          <input type="checkbox" checked={scope.includes(venue.id)} onChange={e => setScope(e.target.checked ? [...scope, venue.id] : scope.filter(id => id !== venue.id))} /> {venue.name}
        </label>)}
        {scope?.length === 0 && <p className="text-sm text-gray-600">This account will have no venue access.</p>}
      </fieldset>}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" disabled={busy} onClick={close}>Cancel</button>
        <button type="submit" disabled={busy || scope === undefined} className="rounded bg-primary-700 px-4 py-2 text-white disabled:opacity-50">{busy ? "Saving…" : "Save access"}</button>
      </div>
    </form>
  </div>;
}
