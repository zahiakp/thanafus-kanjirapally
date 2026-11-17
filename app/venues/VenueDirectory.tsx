"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tooltip } from "antd";
import IconAction from "../../components/common/IconAction";
import {
  TbEdit,
  TbExternalLink,
  TbMapPin,
  TbPlus,
  TbRefresh,
  TbTrash,
} from "react-icons/tb";
import { FaPenNib } from "react-icons/fa";
import { scheduleRequest } from "../schedule/Queue";
import type { Venue } from "../utils/venueSchedule";
import { coordinatesFromMapLink, googleMapsUrl } from "../utils/mapsLink";
import VenueMap, { type MapVenue } from "./VenueMap";
import { FaMicrophoneLines } from "react-icons/fa6";

type VenueCard = Venue &
  MapVenue & {
    description: string | null;
    mapUrl: string | null;
    programs: number;
    managers: number;
    judges: number;
  };
const empty = {
  name: "",
  type: "stage" as Venue["type"],
  description: "",
  mapUrl: "",
};
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40";
const primary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40";
const field =
  "min-h-10 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
const panel = "rounded-xl border border-gray-200 bg-white shadow-sm";
const pageSize = 6;
const hasCoordinates = (venue: MapVenue) =>
  venue.latitude !== null && venue.longitude !== null;

export default function VenueDirectory() {
  const [venues, setVenues] = useState<VenueCard[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<VenueCard | null>(null);
  const [form, setForm] = useState(empty);
  const dialog = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setVenues(
        (await scheduleRequest<{ venues: VenueCard[] }>("?view=venues")).venues,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function open(venue: VenueCard | null = null) {
    setEditing(venue);
    setForm(
      venue
        ? {
            name: venue.name,
            type: venue.type,
            description: venue.description ?? "",
            mapUrl: venue.mapUrl ?? "",
          }
        : empty,
    );
    setFormError("");
    dialog.current?.showModal();
  }

  async function mutate(body: object, fromForm = false) {
    setBusy(true);
    setFormError("");
    setError("");
    try {
      await scheduleRequest("", body);
      if (fromForm) dialog.current?.close();
      await load();
    } catch (e) {
      (fromForm ? setFormError : setError)((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = (venues ?? []).filter(
    (venue) =>
      (!type || venue.type === type) &&
      [venue.name, venue.description, `stage ${venue.id}`].some((value) =>
        value?.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const located = filtered.filter(hasCoordinates);
  const locationLink = form.mapUrl.trim();
  const coordinates = coordinatesFromMapLink(locationLink);
  const validLink = !locationLink || Boolean(googleMapsUrl(locationLink));

  return (
    <div className="space-y-5">
      <header
        className={`${panel} flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5`}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-700">
            <TbMapPin size={23} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Venues</h1>
            <p className="text-sm text-gray-500">
              Manage Stage and Off-stage venues.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={button}
            disabled={busy || loading}
            onClick={() => void load()}
          >
            <TbRefresh size={18} /> Refresh
          </button>
          <button
            className={primary}
            disabled={busy || loading || !venues}
            onClick={() => open()}
          >
            <TbPlus size={18} /> Add Venue
          </button>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <section aria-label="Venue directory" className="min-w-0 space-y-4">
          <div className={`${panel} grid gap-3 p-3 sm:grid-cols-[1fr_10rem]`}>
            <input
              type="search"
              className={field}
              aria-label="Search venues"
              placeholder="Search by venue or landmark…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              className={field}
              aria-label="Venue type filter"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All types</option>
              <option value="stage">Stage</option>
              <option value="off-stage">Off-stage</option>
            </select>
          </div>
          {loading && !venues && (
            <p role="status" className={`${panel} p-5 text-sm text-gray-500`}>
              Loading venues…
            </p>
          )}
          {venues && !filtered.length && (
            <p className={`${panel} p-5 text-sm text-gray-500`}>
              {venues.length ? "No matching venues." : "No venues added yet."}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {filtered
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((venue) => {
                const stage = venue.type === "stage";
                const mapUrl =
                  venue.mapUrl ||
                  (hasCoordinates(venue)
                    ? `https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`
                    : null);
                return (
                  <article
                    key={venue.id}
                    className={`${panel} min-w-0 overflow-hidden`}
                  >
                    <div
                      className={`relative grid h-28 place-items-center ${stage ? "bg-primary-50 text-primary-600" : "bg-indigo-50 text-indigo-600"}`}
                    >
                      <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold">
                        {stage ? "Stage" : "Off-stage"}
                      </span>
                      {stage ? (
                        <FaMicrophoneLines aria-hidden size={66} />
                      ) : (
                        <FaPenNib aria-hidden size={68} strokeWidth={1.15} />
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="min-w-0 break-words font-semibold text-gray-900">
                          {venue.name}
                        </h2>
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          Stage #{venue.id}
                        </span>
                      </div>
                      <p
                        className="line-clamp-1 text-sm text-gray-500"
                        title={venue.description ?? undefined}
                      >
                        {venue.description || "No landmark added"}
                      </p>
                      <dl className="grid grid-cols-3 gap-1 rounded-lg bg-gray-50 p-2 text-center">
                        {[
                          ["Programs", venue.programs],
                          ["Managers", venue.managers],
                          ["Judges", venue.judges],
                        ].map(([label, count]) => (
                          <div key={label}>
                            <dt className="text-[11px] text-gray-600">
                              {label}
                            </dt>
                            <dd className="font-semibold tabular-nums text-gray-900">
                              {count}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className="flex flex-wrap gap-2">
                        {hasCoordinates(venue) && (
                          <IconAction
                            className={button}
                            tooltip="Show on map"
                            label={`Show ${venue.name} on map`}
                            onClick={() => {
                              setSelected(venue.id);
                              document
                                .getElementById("venue-locations")
                                ?.scrollIntoView({ block: "nearest" });
                            }}
                          >
                            <TbMapPin size={17} />
                          </IconAction>
                        )}
                        {mapUrl && (
                          <Tooltip title="Open in Google Maps" trigger={["hover", "focus"]}><a
                            className={button}
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${venue.name} in Google Maps`}
                          >
                            <TbExternalLink size={17} />
                          </a></Tooltip>
                        )}
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() => open(venue)}
                        >
                          <TbEdit size={16} /> Edit
                        </button>
                        <IconAction
                          className={button + " text-red-700"}
                          disabled={busy}
                          label={`Delete ${venue.name}`}
                          onClick={() => {
                            if (window.confirm(`Delete ${venue.name}?`))
                              void mutate({
                                action: "deleteVenue",
                                id: venue.id,
                              });
                          }}
                        >
                          <TbTrash size={16} />
                        </IconAction>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
          {filtered.length > 0 && (
            <nav
              aria-label="Venue pagination"
              className={`${panel} flex flex-wrap items-center justify-between gap-2 p-3 text-sm text-gray-600`}
            >
              <span>
                Page {currentPage} of {pages} · {filtered.length} venues
              </span>
              <div className="flex gap-2">
                <button
                  className={button}
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <button
                  className={button}
                  disabled={currentPage >= pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </section>
        <VenueMap
          venues={located}
          selected={located.some((v) => v.id === selected) ? selected : null}
          onSelect={setSelected}
        />
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="venue-modal-title"
        className="m-auto max-h-[90dvh] w-11/12 max-w-lg rounded-2xl p-0 shadow-2xl backdrop:bg-gray-950/45"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <form
          className="space-y-4 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate({ action: "venue", id: editing?.id, ...form }, true);
          }}
        >
          <h2
            id="venue-modal-title"
            className="text-lg font-semibold text-gray-900"
          >
            {editing ? "Edit venue" : "Add venue"}
          </h2>
          {formError && (
            <p role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          )}
          <fieldset
            disabled={busy}
            className="space-y-3 text-sm font-medium text-gray-700"
          >
            <label className="block">
              Venue name
              <input
                className={field}
                maxLength={100}
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block">
              Venue type
              <select
                className={field}
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as Venue["type"] })
                }
              >
                <option value="stage">Stage</option>
                <option value="off-stage">Off-stage</option>
              </select>
            </label>
            <label className="block">
              Description or landmark
              <textarea
                className={field}
                rows={2}
                maxLength={300}
                placeholder="e.g. Near the high school entrance"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label className="block">
              Google Maps link
              <input
                type="url"
                className={field}
                maxLength={2048}
                placeholder="https://maps.app.goo.gl/…"
                value={form.mapUrl}
                onChange={(e) => setForm({ ...form, mapUrl: e.target.value })}
              />
            </label>
            <p
              aria-live="polite"
              className={`text-xs font-normal ${locationLink && !coordinates ? "text-amber-800" : "text-gray-500"}`}
            >
              {!validLink
                ? "Enter a valid HTTPS Google Maps link."
                : coordinates
                  ? `Pin detected at ${coordinates.join(", ")}.`
                  : locationLink
                    ? "This link does not include usable coordinates. Open the pin in Google Maps and copy the full address-bar URL, or save the link for opening in Google Maps."
                    : "Paste the full URL from a dropped pin to place this venue on the map."}
            </p>
          </fieldset>
          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button className={primary} disabled={busy || !validLink}>
              {busy ? "Saving…" : "Save venue"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
