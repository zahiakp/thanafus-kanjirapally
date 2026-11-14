import { ApiError } from "./apiAuth";
import { coordinatesFromMapLink, googleMapsUrl } from "./mapsLink";

export function venueLocation(body: Record<string, unknown>) {
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const url = typeof body.mapUrl === "string" ? body.mapUrl.trim() : "";
  if (description.length > 300) throw new ApiError("Landmark notes must be 300 characters or fewer.", 400);
  if (url && !googleMapsUrl(url)) throw new ApiError("Enter a valid HTTPS Google Maps link.", 400);
  const pair = coordinatesFromMapLink(url);
  return [description || null, url || null, pair?.[0] ?? null, pair?.[1] ?? null] as const;
}
