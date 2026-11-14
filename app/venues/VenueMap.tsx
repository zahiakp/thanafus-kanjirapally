"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { TbMapPin } from "react-icons/tb";

export type MapVenue = { id: number; name: string; latitude: number | string | null; longitude: number | string | null };

export default function VenueMap({ venues, selected, onSelect }: {
  venues: MapVenue[]; selected: number | null; onSelect: (id: number) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const pins = useRef<LayerGroup | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then(L => {
      if (disposed) return;
      const instance = L.map(element, { scrollWheelZoom: false });
      map.current = instance;
      pins.current = L.layerGroup().addTo(instance);
      let tilesLoaded = false;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).on("loading", () => { tilesLoaded = false; })
        .on("tileload", () => { tilesLoaded = true; })
        .on("load", () => setState(tilesLoaded ? "ready" : "error")).addTo(instance);
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(element);
    }).catch(() => { if (!disposed) setState("error"); });
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      pins.current = null;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void import("leaflet").then(L => {
      const instance = map.current;
      const layer = pins.current;
      if (disposed || !instance || !layer) return;
      layer.clearLayers();
      const bounds = L.latLngBounds([]);
      for (const venue of venues) {
        const point = L.latLng(Number(venue.latitude), Number(venue.longitude));
        bounds.extend(point);
        const label = document.createElement("span");
        label.textContent = venue.name;
        L.circleMarker(point, {
          radius: selected === venue.id ? 10 : 7,
          color: "#fff",
          weight: 2,
          fillColor: selected === venue.id ? "#9d174d" : "#db2777",
          fillOpacity: 1,
        }).bindTooltip(label).on("click", () => onSelect(venue.id)).addTo(layer);
      }
      const active = venues.find(venue => venue.id === selected);
      if (active) {
        const zoom = instance.getZoom();
        instance.setView([Number(active.latitude), Number(active.longitude)], Number.isFinite(zoom) ? Math.max(zoom, 16) : 17);
      } else if (bounds.isValid()) instance.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
    }).catch(() => { if (!disposed) setState("error"); });
    return () => { disposed = true; };
  }, [venues, selected, onSelect]);

  const active = venues.find(venue => venue.id === selected) ?? venues[0];
  return <aside id="venue-locations" className="scroll-mt-20 self-start overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:sticky xl:top-5">
    <header className="flex items-center gap-2 border-b p-4">
      <TbMapPin className="text-primary-600" size={20} /><h2 className="font-semibold text-gray-900">Venue locations</h2>
    </header>
    <div hidden={!active} className="relative isolate">
      <div ref={canvas} aria-label="OpenStreetMap venue locations" className="h-96 bg-gray-100" />
      {state === "loading" && <p role="status" className="pointer-events-none absolute inset-x-0 top-5 z-[1000] text-center text-sm text-gray-600">Loading map…</p>}
    </div>
    {!active && <div className="grid min-h-48 place-content-center px-6 text-center text-sm text-gray-500">Add a map pin link to see a venue here.</div>}
    {state === "error" && active && <div role="status" className="bg-gray-50 px-4 py-3 text-sm text-gray-700">
      The map could not load. <a href={`https://www.openstreetmap.org/?mlat=${active.latitude}&mlon=${active.longitude}#map=17/${active.latitude}/${active.longitude}`}
        target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 underline">Open {active.name} in OpenStreetMap</a>
    </div>}
    {venues.length > 0 && <div className="flex flex-wrap gap-2 border-t p-3">
      {venues.map(venue => <button type="button" key={venue.id} aria-pressed={selected === venue.id}
        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 aria-pressed:border-primary-200 aria-pressed:bg-primary-50 aria-pressed:text-primary-700"
        onClick={() => onSelect(venue.id)}>{venue.name}</button>)}
    </div>}
  </aside>;
}
