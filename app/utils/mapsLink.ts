export function googleMapsUrl(value: string) {
  if (!URL.canParse(value) || value.length > 2048) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (url.hostname === "maps.app.goo.gl" || (url.hostname === "goo.gl" && url.pathname.startsWith("/maps/"))) return url;
  if (["maps.google.com", "maps.google.co.in"].includes(url.hostname)) return url;
  return /^(?:www\.)?google\.(?:com|co\.in)$/.test(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname) ? url : null;
}

export function coordinatesFromMapLink(value: string): [number, number] | null {
  const url = googleMapsUrl(value);
  if (!url || url.hostname.endsWith("goo.gl")) return null;
  const path = url.pathname.replace(/%21/gi, "!").replace(/%2c/gi, ",");
  const pin = path.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)(?=!|$)/);
  const candidates = [
    pin?.slice(1).join(","),
    url.searchParams.get("query"),
    url.searchParams.get("q"),
    path.match(/\/maps\/place\/([^/]+)/)?.[1]?.replace(/\+/g, " "),
  ];
  for (const candidate of candidates) {
    const pair = candidate?.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (!pair) continue;
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
  }
  return null;
}
