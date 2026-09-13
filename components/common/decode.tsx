import { Buffer } from "buffer";

export function encodeId(id: any): string {
  const encodedId = Buffer.from(String(id ?? "")).toString("base64");
  return encodedId.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeId(encodedId: string): string | null {
  // Buffer.from(..., "base64") never throws: it silently skips characters it does
  // not recognise, so arbitrary text decodes to garbage rather than failing. The
  // old try/catch therefore never caught anything, and any unrelated QR code was
  // accepted and routed to a profile that cannot exist. Re-encoding the result and
  // comparing it to the input is the only reliable check that the payload really
  // was one of our ids.
  if (typeof encodedId !== "string" || !/^[A-Za-z0-9_-]+$/.test(encodedId)) return null;
  const decodedId = Buffer.from(encodedId.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  if (decodedId === "" || decodedId.includes("�") || encodeId(decodedId) !== encodedId) return null;
  return decodedId;
}
